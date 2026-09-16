import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

// Load base .env first
dotenv.config({ path: path.resolve(dirName, '../.env') });

// Ensure APPLICATION_ENVIRONMENT default
process.env.APPLICATION_ENVIRONMENT = process.env.APPLICATION_ENVIRONMENT ?? 'default';

// Then load environment-specific file with override
dotenv.config({ path: path.resolve(dirName, `../.env.${process.env.APPLICATION_ENVIRONMENT}`), override: true });

export {}; // side-effect only module

