import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const production = process.argv.includes('--production');
const api = Bun.spawn(
  production ? ['bun', 'apps/api/src/index.ts'] : ['bun', '--watch', 'apps/api/src/index.ts'],
  { cwd: root, stdout: 'inherit', stderr: 'inherit', env: process.env },
);
const web = Bun.spawn(['bun', 'run', '--cwd', 'apps/web', production ? 'start' : 'dev'], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: production ? '.next' : '.next-dev' },
});
function stop() {
  api.kill();
  web.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const code = await Promise.race([api.exited, web.exited]);
stop();
process.exit(code);
