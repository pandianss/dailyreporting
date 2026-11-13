import { existsSync, renameSync, rmSync, cpSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'app', 'api');
const stashDir = path.join(root, '.next-api-stash');
const nextCache = path.join(root, '.next');
const hostingOnly = process.argv.includes('--hosting-only');

if (!existsSync(apiDir) && existsSync(stashDir)) {
  renameSync(stashDir, apiDir);
}

let stashed = false;
let exitCode = 0;
try {
  if (existsSync(apiDir) && !existsSync(stashDir)) {
    renameSync(apiDir, stashDir);
    stashed = true;
  }

  rmSync(path.join(nextCache, 'types'), { recursive: true, force: true });

  const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const res = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NEXT_OUTPUT: 'export' },
  });
  if (res.status !== 0) {
    exitCode = res.status ?? 1;
  }
} finally {
  if (stashed && existsSync(stashDir) && !existsSync(apiDir)) {
    renameSync(stashDir, apiDir);
  }
}

if (exitCode !== 0) {
  process.exit(exitCode);
}

const outDir = path.join(root, 'out');
const outSmaDir = path.join(root, 'out-sma');
if (existsSync(outDir)) {
  rmSync(outSmaDir, { recursive: true, force: true });
  cpSync(outDir, outSmaDir, { recursive: true });
  const smaIndex = path.join(outDir, 'sma', 'index.html');
  if (existsSync(smaIndex)) {
    copyFileSync(smaIndex, path.join(outSmaDir, 'index.html'));
  }
}

if (!hostingOnly) {
  const fnRes = spawnSync(process.execPath, [path.join(root, 'functions', 'sync-shared.mjs')], {
    cwd: path.join(root, 'functions'),
    stdio: 'inherit',
  });
  if (fnRes.status !== 0) process.exit(fnRes.status ?? 1);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const buildRes = spawnSync(npmCmd, ['--prefix', path.join(root, 'functions'), 'run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (buildRes.error) throw buildRes.error;
  if (buildRes.status !== 0) {
    process.exit(buildRes.status ?? 1);
  }
}
