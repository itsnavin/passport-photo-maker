import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const packages = ['pdf-lib', '@pdf-lib/standard-fonts', '@pdf-lib/upng', 'pako', 'tslib'];
const sections = ['Third-party notices for locally bundled runtime dependencies\n'];
for (const name of packages) {
  const root = join('node_modules', name);
  const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const names = (await readdir(root)).filter(file => /^(license|copyright|notice)/i.test(file));
  if (!names.length) throw new Error(`Missing license notice for ${name}`);
  const notices = await Promise.all(names.map(async file => `${file}\n\n${await readFile(join(root, file), 'utf8')}`));
  sections.push(`${name} ${metadata.version}\n${'='.repeat(60)}\n\n${notices.join('\n\n')}`);
}
await mkdir('public', { recursive: true });
await writeFile(join('public', 'third-party-notices.txt'), sections.join('\n\n\n'), 'utf8');
