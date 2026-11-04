import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No migration executed.');
  process.exit(1);
}
let cli;
try {
  cli = require.resolve('prisma/build/index.js');
} catch {
  console.error('Local Prisma CLI missing. Install dependencies including devDependencies.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', path.join(root, 'prisma/schema.prisma')], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  timeout: 180000,
});
if (result.error) console.error('Migration execution failed or timed out.');
process.exit(result.status ?? 1);
