import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);
await import('./node_modules/vite/bin/vite.js');
