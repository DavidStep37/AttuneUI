import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, [path.join(root, 'scripts/build-registry.mjs')], { cwd: root, stdio: 'inherit' });
const destination = path.join(root, '.backup/releases/attune-motion');
await mkdir(destination, { recursive: true });
await cp(path.join(root, 'skills/attune-motion'), destination, { recursive: true });
const item = JSON.parse(await readFile(path.join(root, 'public/r/attune-ui.json'), 'utf8'));
for (const file of item.files) {
  const target = path.join(destination, 'assets/attune-source', file.path.replace(/^src\//, ''));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file.content);
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(path.join(destination, 'assets/source-manifest.json'), JSON.stringify({ version: '0.1.1', source: 'AttuneUI working tree',
  dependencies: pkg.dependencies, files: item.files.map(f => f.path), license: 'Not selected; local preview distribution only.' }, null, 2) + '\n');
await mkdir(path.join(destination, 'assets/example'), { recursive: true });
let example = await readFile(path.join(root, 'src/demos/motion-lab.tsx'), 'utf8');
example = example.replaceAll('../workbench/', '__ATTUNE__/workbench/').replace('../styles/attune.css', '__ATTUNE__/styles/attune.css')
  .replaceAll('href="/showcase.html"', 'href="#"').replaceAll('href="/"', 'href="#"').replace('查看组件库', '返回顶部');
await writeFile(path.join(destination, 'assets/example/main.tsx'), example);
await cp(path.join(root, 'src/demos/motion-lab.css'), path.join(destination, 'assets/example/motion-lab.css'));
console.log(`Built self-contained skill v0.1.1: ${destination}`);
