import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const fromRoot = (...parts) => path.join(root, ...parts);
const files = ['src/index.ts'];
for (const directory of ['components', 'core', 'tokens', 'styles']) {
  for (const entry of (await readdir(fromRoot('src', directory))).sort()) {
    if (/\.(tsx?|css)$/.test(entry)) files.push(`src/${directory}/${entry}`);
  }
}
const pkg = JSON.parse(await readFile(fromRoot('package.json'), 'utf8'));
const item = {
  $schema: 'https://ui.shadcn.com/schema/registry-item.json',
  name: 'attune-ui',
  type: 'registry:block',
  title: 'Attune UI — tool panel starter',
  description: 'Preview source bundle. Graphite React controls, scoped tokens and optional frosted panels. License and support policy pending public release.',
  dependencies: ['motion', 'lucide-react'].map(name => `${name}@${pkg.dependencies[name]}`),
  files: await Promise.all(files.map(async source => ({
    path: source,
    type: 'registry:file',
    target: `@components/attune/${source.replace(/^src\//, '')}`,
    content: await readFile(fromRoot(source), 'utf8'),
  }))),
  docs: 'Preview only. Requires React 19 and react-dom. Import the installed attune/styles/attune.css and wrap controls in AttuneRoot. Do not call injectTokens for a scoped mount. See getting-started.md. The public license has not yet been selected.',
};
const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'attune-ui',
  homepage: 'https://github.com/DavidStep37/AttuneUI',
  items: [{ ...item, files: item.files.map(({ content: _content, ...file }) => file) }],
};
await mkdir(fromRoot('public/r'), { recursive: true });
await writeFile(fromRoot('registry.json'), JSON.stringify(registry, null, 2) + '\n');
await writeFile(fromRoot('public/r/attune-ui.json'), JSON.stringify(item, null, 2) + '\n');
await copyFile(fromRoot('docs/getting-started.md'), fromRoot('public/getting-started.md'));
console.log(`Built Attune preview registry: ${files.length} source files, no Playground or showcase dependencies.`);
