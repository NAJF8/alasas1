import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const releaseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const runBuild = (directory) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: resolve(root, directory), stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'al-asas-dental-staging', VITE_RELEASE_SHA: releaseSha },
});
runBuild('customer-app');
runBuild('admin-app');
const output = resolve(root, 'dist-deploy');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'admin'), { recursive: true });
await cp(resolve(root, 'customer-app/dist'), output, { recursive: true });
await cp(resolve(root, 'admin-app/dist'), resolve(output, 'admin'), { recursive: true });
console.log(`Unified Hosting output ready: ${output}`);
