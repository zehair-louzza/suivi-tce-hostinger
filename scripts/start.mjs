import 'dotenv/config';
import { fileURLToPath } from 'node:url';

// Keep the Hostinger entry unchanged, but never run database migrations here.
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await import('../dist/server/index.js');
