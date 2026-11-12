import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, lstatSync, rmSync, unlinkSync, rmdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../../external-collab/dist/client/', import.meta.url));
const target = fileURLToPath(new URL('../public/external-collab-app/', import.meta.url));
if (!existsSync(source)) throw new Error('Build @fangpian/external-collab before preparing the web app');
const publicRoot = realpathSync(fileURLToPath(new URL('../public/', import.meta.url)));
const resolvedTarget = resolve(target);
const targetWithinPublic = relative(publicRoot, resolvedTarget);
if (isAbsolute(targetWithinPublic) || targetWithinPublic !== 'external-collab-app' || (existsSync(target) && (lstatSync(target).isSymbolicLink() || realpathSync(target) !== resolvedTarget))) {
  throw new Error('Refusing to clean a path outside generated public/external-collab-app assets');
}
rmSync(resolvedTarget, { recursive: true, force: true });
// Some Windows runtimes leave recursive rmSync directories intact; remove remaining generated entries explicitly.
function removeRemaining(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) removeRemaining(child);
    else unlinkSync(child);
  }
  rmdirSync(directory);
}
if (existsSync(resolvedTarget)) removeRemaining(resolvedTarget);
function copyDirectory(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyDirectory(join(from, entry.name), join(to, entry.name));
    else if (entry.isFile()) copyFileSync(join(from, entry.name), join(to, entry.name));
  }
}
copyDirectory(source, target);

