import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(clientRoot, 'dist', 'client');
const target = path.resolve(clientRoot, '..', 'backend', 'static');

try {
  const sourceStats = await stat(source);
  if (!sourceStats.isDirectory()) throw new Error('static export is not a directory');
} catch (error) {
  throw new Error(`Client static export not found at ${source}. Run vinext build first.`, {
    cause: error,
  });
}

// backend/static is generated output. Replace it completely so renamed and
// hashed assets from older builds cannot remain available in production.
await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true });

console.log(`Synced static client to ${target}`);
