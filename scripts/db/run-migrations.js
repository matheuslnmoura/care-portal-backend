import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const migrationsDir = path.resolve(projectRoot, 'scripts/db/migrations');

const loadEnvironment = () => {
  const baseEnvPath = path.resolve(projectRoot, '.env');
  dotenv.config({ path: baseEnvPath });

  const env = process.env.APPLICATION_ENVIRONMENT ?? 'default';
  dotenv.config({ path: path.resolve(projectRoot, `.env.${env}`), override: true });
};

const getDatabaseConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString !== undefined) return connectionString;

  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.POSTGRES_PASS ?? 'postgres';
  const database = process.env.POSTGRES_DB ?? 'care-portal-local';


  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const ensureMigrationsTable = async client => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const getAppliedMigrations = async client => {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC;');
  return new Set(result.rows.map(row => row.filename));
};

const readMigrationFiles = async () => {
  const entries = await fs.readdir(migrationsDir);
  return entries
    .filter(entry => entry.endsWith('.sql'))
    .sort();
};

const applyMigration = async (client, filename, sql) => {
  process.stdout.write(`Applying ${filename}... `);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [filename]);
    await client.query('COMMIT');
    console.log('done');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('failed');
    throw error;
  }
};

const showStatus = async (files, applied) => {
  console.log('Migration status:');
  for (const file of files) {
    const status = applied.has(file) ? '✓ applied' : '✗ pending';
    console.log(`- ${file} ${status}`);
  }
};

const run = async () => {
  loadEnvironment();


  const command = process.argv[2] ?? 'up';
  const connectionString = getDatabaseConfig();
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const files = await readMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(client);

    if (command === 'status') {
      await showStatus(files, appliedMigrations);
      return;
    }

    if (command !== 'up') {
      throw new Error(`Unsupported command "${command}". Use "up" or "status".`);
    }

    for (const file of files) {
      if (appliedMigrations.has(file)) continue;
      const filePath = path.resolve(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');
      await applyMigration(client, file, sql);
    }

    console.log('All migrations applied.');
  } finally {
    await client.end();
  }
};

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

