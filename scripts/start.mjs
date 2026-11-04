import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const require = createRequire(import.meta.url);

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  stop('DATABASE_URL is required. Server not started.');
}
try {
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    stop('DATABASE_URL must point to PostgreSQL. Server not started.');
  }
} catch {
  stop('DATABASE_URL is invalid. Server not started.');
}

const schema = path.join(root, 'prisma/schema.prisma');
const server = path.join(root, 'dist/server/index.js');
if (!fs.existsSync(schema) || !fs.existsSync(server)) {
  stop('Schema or compiled server missing. Run npm run build first.');
}

let cli;
try {
  cli = require.resolve('prisma/build/index.js');
} catch {
  stop('Local Prisma CLI missing. Install dependencies with NPM_CONFIG_INCLUDE=dev.');
}

console.log('Applying pending PostgreSQL migrations before starting Express...');
const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  timeout: 180000,
});
if (result.error || result.status !== 0) {
  stop('Database migration failed or timed out. Express was not started. Check connectivity, permissions and migration logs.');
}
console.log('Migrations complete. Starting Express...');
try {
  await import('../dist/server/index.js');
} catch (error) {
  console.error('Express startup failed:', error);
  process.exit(1);
}
