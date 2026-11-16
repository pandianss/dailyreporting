import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '..');
const srcShared = path.join(root, 'src', 'shared');
const libShared = path.join(root, 'lib', 'shared');
const isPost = process.argv.includes('--post');

mkdirSync(srcShared, { recursive: true });

if (!isPost && existsSync(path.join(repoRoot, 'lib', 'portal-core.ts'))) {
  copyFileSync(path.join(repoRoot, 'lib', 'portal-core.ts'), path.join(srcShared, 'portal-core.ts'));
  copyFileSync(path.join(repoRoot, 'lib', 'scorecard-svg.ts'), path.join(root, 'src', 'scorecard-svg.ts'));
  copyFileSync(path.join(repoRoot, 'app', 'model.mjs'), path.join(srcShared, 'model.mjs'));
  copyFileSync(path.join(repoRoot, 'app', 'branches.json'), path.join(srcShared, 'branches.json'));
}

if (isPost) {
  mkdirSync(libShared, { recursive: true });
  copyFileSync(path.join(srcShared, 'model.mjs'), path.join(libShared, 'model.mjs'));
  copyFileSync(path.join(srcShared, 'branches.json'), path.join(libShared, 'branches.json'));
}
