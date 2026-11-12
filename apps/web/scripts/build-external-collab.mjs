import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
// The imported React 18/Nest 10 service keeps its original dependency lock.
// It is deliberately isolated from the platform's React 19/Nest 12 workspace.
const directory = fileURLToPath(new URL('../../external-collab/', import.meta.url));
const vite = fileURLToPath(new URL('../../external-collab/node_modules/vite/bin/vite.js', import.meta.url));
if (!existsSync(vite)) throw new Error('Install the independent external-collab dependencies with pnpm install --ignore-workspace before building web');
const result = spawnSync(process.execPath, [vite, 'build'], { cwd: directory, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
