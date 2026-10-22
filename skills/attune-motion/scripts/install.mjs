import { cp, mkdir, readFile, readdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const options = {};
const usage = 'Usage: node install.mjs --target <new source directory> [--example <new example directory>] [--ui attune|custom]';
for (let i = 0; i < args.length; i += 2) {
  if (!['--target', '--example', '--ui'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(usage);
  options[args[i]] = args[i] === '--ui' ? args[i + 1] : path.resolve(args[i + 1]);
}
const target = options['--target'], example = options['--example'], ui = options['--ui'] ?? 'attune';
if (!target) throw new Error('--target is required');
if (!['attune', 'custom'].includes(ui)) throw new Error(`--ui must be "attune" or "custom". ${usage}`);
if (ui === 'custom' && example) throw new Error('--example installs the AttuneUI example and cannot be combined with --ui custom.');
const source = path.join(skill, 'assets/attune-source');
try { await access(path.join(source, 'index.ts')); } catch { throw new Error('This skill has no bundled source. In the AttuneUI maintainer repository run npm run skill:pack, then use the generated skill directory.'); }
if (example && (example === target || example.startsWith(target + path.sep) || target.startsWith(example + path.sep))) throw new Error('Target and example directories must not overlap');
for (const directory of [target, example].filter(Boolean)) {
  let exists = true;
  try { await access(directory); } catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
  if (exists) throw new Error(`Refusing to overwrite existing directory: ${directory}`);
}
// Exclusive mkdir prevents accidental replacement if another installer races this one. Copy the
// directory's *entries* into it: copying the directory itself onto the freshly created (existing)
// target makes some Node versions (e.g. 22 on macOS) fail with EEXIST.
const copyInto = async (from, to) => {
  await mkdir(path.dirname(to), { recursive: true });
  await mkdir(to);
  for (const entry of await readdir(from)) await cp(path.join(from, entry), path.join(to, entry), { recursive: true, errorOnExist: true, force: false });
};
if (ui === 'custom') {
  // Custom UI: only the dependency-free data contract (config, JSON export, tokens, panel geometry).
  // The agent draws its own panel in the host's design language — see references/custom-ui.md.
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(target);
  await cp(path.join(source, 'workbench/model.ts'), path.join(target, 'model.ts'), { errorOnExist: true, force: false });
  console.log(JSON.stringify({ installed: target, ui, files: ['model.ts'], dependencies: {},
    next: 'Build the panel with the host project\'s own components, following references/custom-ui.md. Import createMotionConfig, serializeMotionConfig, parseMotionTokens, tokensForField and snapConfigToTokens from model.ts.' }, null, 2));
  process.exit(0);
}
await copyInto(source, target);
if (example) {
  await copyInto(path.join(skill, 'assets/example'), example);
  const relative = path.relative(example, target).split(path.sep).join('/');
  const prefix = relative.startsWith('.') ? relative : `./${relative}`;
  for (const file of await readdir(example)) {
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const full = path.join(example, file);
    await writeFile(full, (await readFile(full, 'utf8')).replaceAll('__ATTUNE__', prefix));
  }
}
const manifest = JSON.parse(await readFile(path.join(skill, 'assets/source-manifest.json'), 'utf8'));
console.log(JSON.stringify({ installed: target, ui, example, dependencies: manifest.dependencies,
  next: 'Use the existing project package manager to satisfy compatible dependencies, import attune/styles/attune.css, and bind real animation adapters. No package.json or entrypoint was changed.' }, null, 2));
