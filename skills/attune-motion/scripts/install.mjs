import { cp, mkdir, readFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--target', '--example'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Usage: node install.mjs --target <new source directory> [--example <new example directory>]');
  options[args[i]] = path.resolve(args[i + 1]);
}
const target = options['--target'], example = options['--example'];
if (!target) throw new Error('--target is required');
const source = path.join(skill, 'assets/attune-source');
try { await access(path.join(source, 'index.ts')); } catch { throw new Error('This skill has no bundled source. In the AttuneUI maintainer repository run npm run skill:pack, then use the generated skill directory.'); }
if (example && (example === target || example.startsWith(target + path.sep) || target.startsWith(example + path.sep))) throw new Error('Target and example directories must not overlap');
for (const directory of [target, example].filter(Boolean)) {
  let exists = true;
  try { await access(directory); } catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
  if (exists) throw new Error(`Refusing to overwrite existing directory: ${directory}`);
}
// Exclusive mkdir prevents accidental replacement if another installer races this one.
await mkdir(path.dirname(target), { recursive: true });
await mkdir(target);
await cp(source, target, { recursive: true, errorOnExist: true, force: false });
if (example) {
  await mkdir(path.dirname(example), { recursive: true });
  await mkdir(example);
  await cp(path.join(skill, 'assets/example'), example, { recursive: true, errorOnExist: true, force: false });
  const relative = path.relative(example, target).split(path.sep).join('/');
  const prefix = relative.startsWith('.') ? relative : `./${relative}`;
  const main = path.join(example, 'main.tsx');
  await writeFile(main, (await readFile(main, 'utf8')).replaceAll('__ATTUNE__', prefix));
}
const manifest = JSON.parse(await readFile(path.join(skill, 'assets/source-manifest.json'), 'utf8'));
console.log(JSON.stringify({ installed: target, example, dependencies: manifest.dependencies,
  next: 'Use the existing project package manager to satisfy compatible dependencies, import attune/styles/attune.css, and bind real animation adapters. No package.json or entrypoint was changed.' }, null, 2));
