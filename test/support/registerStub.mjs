import { register } from 'node:module';
register(new URL('./stubLoader.mjs', import.meta.url));
