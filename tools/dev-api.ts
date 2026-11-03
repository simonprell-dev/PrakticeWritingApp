// Development with the API: starts node server.js (API on API_PORT, default 3000, reads .env) and the
// Vite dev server, which forwards /api to it. Usage: npm run dev:api (database: docker compose up -d db)
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = process.env.API_PORT || '3000';
const kids: ChildProcess[] = [];

function run(args: string[], env: Record<string, string>): void {
  const p = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  p.on('exit', (code) => {
    // one of them stopped: stop the other too
    for (const k of kids) if (k !== p && k.exitCode === null) k.kill();
    process.exitCode = code ?? 0;
  });
  kids.push(p);
}

run(['--env-file-if-exists=.env', '--watch-path=server', '--watch-path=server.js', 'server.js'], { PORT: port });
run(['node_modules/vite/bin/vite.js', '--open', ...process.argv.slice(2)], { API_PROXY: `http://localhost:${port}` });

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => kids.forEach((k) => k.kill()));
