import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, [path.join(root, 'scripts/build-registry.mjs')], { cwd: root, stdio: 'inherit' });
const item = JSON.parse(await readFile(path.join(root, 'public/r/attune-ui.json'), 'utf8'));
const sources = new Set(item.files.map(file => file.path));
const targets = new Set();
const directory = path.join(root, '.backup/registry-consumer');
await mkdir(directory, { recursive: true });
assert.equal(item.type, 'registry:block');
for (const file of item.files) {
  assert.equal(file.type, 'registry:file');
  assert(file.target.startsWith('@components/attune/'));
  assert(!/playground|showcase/.test(file.path));
  assert(!targets.has(file.target), `Duplicate target ${file.target}`);
  targets.add(file.target);
  assert.equal(file.content, await readFile(path.join(root, file.path), 'utf8'), `Stale ${file.path}`);
  // All relative imports must resolve within the distributed file graph.
  for (const match of file.content.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), match[1]));
    assert(['', '.ts', '.tsx', '.css', '/index.ts'].some(extension => sources.has(base + extension)), `Unbundled dependency ${file.path}: ${match[1]}`);
  }
  const target = path.resolve(directory, file.target.replace('@components/', 'components/'));
  assert(target.startsWith(directory + path.sep), `Unsafe target ${file.target}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file.content);
}
await writeFile(path.join(directory, 'consumer.tsx'), `
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AttuneRoot, Panel, SliderField, Select, Toast, Button } from './components/attune';
import './components/attune/styles/attune.css';
function Consumer() {
  const [value, setValue] = useState(300);
  const [choice, setChoice] = useState('a');
  const [open, setOpen] = useState(false);
  return <AttuneRoot theme="dark" material="frosted" colors={{'slider-fill': '#5F738E'}} panelRadius={16}>
    <Panel title="Source consumer" floating>
      <SliderField label="Duration" value={value} onChange={setValue} min={0} max={1000} />
      <Select value={choice} onChange={setChoice} options={[{value:'a',label:'A'}, {value:'b',label:'B'}]} />
      <Button onClick={() => setOpen(true)}>Save</Button>
    </Panel>
    <Toast open={open} onDismiss={() => setOpen(false)}>Saved</Toast>
  </AttuneRoot>;
}
createRoot(document.getElementById('root')!).render(<Consumer />);
`);
await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({
  compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true, types: ['vite/client'] },
  include: ['consumer.tsx', 'components'],
}, null, 2));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.json')], { cwd: directory, stdio: 'inherit' });
console.log(`PASS: ${sources.size} registry files, complete local imports, unique safe targets, isolated React consumer typecheck.`);
