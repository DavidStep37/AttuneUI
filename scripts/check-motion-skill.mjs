import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, [path.join(root, 'scripts/build-motion-skill.mjs')], { cwd: root, stdio: 'inherit' });
const skill = path.join(root, '.backup/releases/attune-motion');
const entry = await readFile(path.join(skill, 'SKILL.md'), 'utf8');
assert(entry.startsWith('---\nname: attune-motion\ndescription:'));
// Relative references must resolve in the actual distribution, not just the maintainer tree.
for (const [, ref] of entry.matchAll(/\]\(([^)#]+)(#[^)]*)?\)/g)) await readFile(path.join(skill, ref));
await mkdir(path.join(root, '.backup'), { recursive: true });
const consumer = await mkdtemp(path.join(root, '.backup/skill-consumer-'));
const target = path.join(consumer, 'attune'), example = path.join(consumer, 'example');
execFileSync(process.execPath, [path.join(skill, 'scripts/install.mjs'), '--target', target, '--example', example], { stdio: 'inherit' });
const before = await readFile(path.join(target, 'index.ts'), 'utf8');
// Custom-UI mode installs only the dependency-free data contract, and it typechecks on its own.
const customTarget = path.join(consumer, 'custom-model');
execFileSync(process.execPath, [path.join(skill, 'scripts/install.mjs'), '--ui', 'custom', '--target', customTarget], { stdio: 'pipe' });
assert.deepEqual(await readdir(customTarget), ['model.ts']);
assert(!/from ["']/.test(await readFile(path.join(customTarget, 'model.ts'), 'utf8')), 'model.ts must have no imports');
assert.notEqual(spawnSync(process.execPath, [path.join(skill, 'scripts/install.mjs'), '--ui', 'custom', '--target', path.join(consumer, 'x'), '--example', path.join(consumer, 'y')]).status, 0, 'custom + example rejected');
await readFile(path.join(skill, 'references/custom-ui.md'));
await readFile(path.join(skill, 'assets/example/motion-tokens.ts'));
const refusal = spawnSync(process.execPath, [path.join(skill, 'scripts/install.mjs'), '--target', target], { encoding: 'utf8' });
assert.notEqual(refusal.status, 0);
assert.match(refusal.stderr, /Refusing to overwrite/);
assert.equal(await readFile(path.join(target, 'index.ts'), 'utf8'), before);
const manifest = JSON.parse(await readFile(path.join(skill, 'assets/source-manifest.json'), 'utf8'));
for (const name of manifest.files) assert.equal(await readFile(path.join(target, name.replace(/^src\//, '')), 'utf8'), await readFile(path.join(root, name), 'utf8'), `Stale source ${name}`);
await writeFile(path.join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
  target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true, types: ['vite/client'],
}, include: ['attune', 'example', 'custom-model'] }, null, 2));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(consumer, 'tsconfig.json')], { cwd: consumer, stdio: 'inherit' });
await writeFile(path.join(consumer, 'index.html'), '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Installed Skill Consumer</title><div id="root"></div><script type="module" src="./example/main.tsx"></script></html>');
await writeFile(path.join(root, '.backup/last-skill-consumer.json'), JSON.stringify({ directory: consumer, url: `http://localhost:5188/.backup/${path.basename(consumer)}/index.html` }, null, 2));
assert((await readdir(path.join(skill, 'assets/example'))).includes('main.tsx'));
// Cross-machine fidelity: reference screenshots, visual spec and the browser self-check ship in the package.
const refs = await readdir(path.join(skill, 'assets/reference'));
for (const name of ['01-toolbar.png', '02-toolbar-menu.png', '03-panel-collapsed.png', '03-panel.png', '04-group-hover-card.png', '05-bezier-framed.png', '06-tokens.png', '07-token-custom.png']) assert(refs.includes(name), `Missing reference ${name}`);
await readFile(path.join(skill, 'references/visual-spec.md'));
const verify = await readFile(path.join(skill, 'scripts/verify-example.mjs'), 'utf8');
assert(verify.includes('ATTUNE_MOTION_URL') && verify.includes('chromeCandidates'), 'verify-example must be the portable browser check');
// No maintainer-machine paths may leak into the distributed instructions or scripts.
for (const file of ['SKILL.md', 'references/integration.md', 'references/verification.md', 'references/visual-spec.md', 'references/custom-ui.md', 'scripts/install.mjs', 'scripts/verify-example.mjs']) {
  const text = await readFile(path.join(skill, file), 'utf8');
  assert(!/\/Users\/|E:\/CodexHome|shuaijie/i.test(text), `Machine-specific path in ${file}`);
}
console.log(`PASS: portable skill, complete source snapshot, isolated installer + 3-animation consumer typecheck, repeat install refuses overwrite.\nConsumer: ${consumer}`);
