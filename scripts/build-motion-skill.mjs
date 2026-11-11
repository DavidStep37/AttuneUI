import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, [path.join(root, 'scripts/build-registry.mjs')], { cwd: root, stdio: 'inherit' });
const destination = path.join(root, '.backup/releases/attune-motion');
// Start from an empty directory so no stale file from an older build ships.
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(path.join(root, 'skills/attune-motion'), destination, { recursive: true });
const item = JSON.parse(await readFile(path.join(root, 'public/r/attune-ui.json'), 'utf8'));
for (const file of item.files) {
  const target = path.join(destination, 'assets/attune-source', file.path.replace(/^src\//, ''));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file.content);
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(path.join(destination, 'assets/source-manifest.json'), JSON.stringify({ version: '1.0.0', source: 'AttuneUI working tree',
  dependencies: pkg.dependencies, files: item.files.map(f => f.path), license: 'Not selected; local preview distribution only.' }, null, 2) + '\n');
await mkdir(path.join(destination, 'assets/example'), { recursive: true });
let example = await readFile(path.join(root, 'src/demos/motion-lab.tsx'), 'utf8');
example = example.replaceAll('../workbench/', '__ATTUNE__/workbench/').replace('../styles/attune.css', '__ATTUNE__/styles/attune.css')
  .replaceAll('href="/showcase.html"', 'href="#"').replaceAll('href="/"', 'href="#"').replace('查看组件库', '返回顶部');
await writeFile(path.join(destination, 'assets/example/main.tsx'), example);
await cp(path.join(root, 'src/demos/motion-lab.css'), path.join(destination, 'assets/example/motion-lab.css'));
// Sample design-team token set used by the example (and as a format reference).
await writeFile(path.join(destination, 'assets/example/motion-tokens.ts'), (await readFile(path.join(root, 'src/demos/motion-tokens.ts'), 'utf8')).replaceAll('../workbench/', '__ATTUNE__/workbench/'));
// The maintainer browser regression ships with the skill so another machine can verify the installed copy.
await cp(path.join(root, 'scripts/check-motion-workbench.mjs'), path.join(destination, 'scripts/verify-example.mjs'));
console.log(`Built self-contained skill v1.0.0: ${destination}`);
