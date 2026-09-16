// Baseline env for every test file. BaseClass/config.ts read process.env directly at
// construction/import time, and TokenManager reads its secrets the same way, so these need to
// exist before any class under test is instantiated.
process.env.APPLICATION_ENVIRONMENT = 'testing';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.REFRESH_TOKEN_HASH_SECRET = 'test-refresh-hash-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
// Real bcrypt salt rounds (the config.ts default) would make every PasswordManager test slow.
process.env.PASSWORD_SALT_ROUNDS = '1';
