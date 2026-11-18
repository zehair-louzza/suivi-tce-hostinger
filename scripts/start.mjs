import 'dotenv/config';
import { fileURLToPath } from 'node:url';

// Keep the Hostinger entry unchanged, but never run database migrations here.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await import('../dist/server/index.js');
