// Runs JARVIS from this laptop: the model, the voice server and a Cloudflare tunnel, then tells the
// relay (jarvis-relay.smohith58.workers.dev) where the tunnel is. Anything that stops is restarted.
import { spawn } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const HOME = 'C:/Users/Mohith S/jarvis-host';
const SERVER_DIR = 'C:/Users/Mohith S/Desktop/3d-portfolio/jarvis-server';
const RELAY = 'https://jarvis-relay.smohith58.workers.dev';
const KEY = readFileSync(join(HOME, 'server.key'), 'utf8').trim();
const ADMIN = readFileSync(join(HOME, 'admin.key'), 'utf8').trim();
const log = line => appendFileSync(join(HOME, 'jarvis.log'), `${new Date().toISOString()} ${line}\n`);

function keep(name, command, args, options = {}, onLine) {
  const run = () => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    const read = data => String(data).split('\n').forEach(line => { if (line.trim()) onLine?.(line); });
    child.stdout.on('data', read); child.stderr.on('data', read);
    child.on('exit', code => { log(`${name} exited (${code}); restarting in 3 s`); setTimeout(run, 3000); });
    log(`${name} started`);
  };
  run();
}

keep('mind', join(HOME, 'llama/llama-server.exe'), ['-m', join(HOME, 'models/qwen35-2b-q4km.gguf'), '-c', '16384', '-np', '2', '--cache-reuse', '256', '-t', '4', '--port', '8090', '--jinja']);
keep('ear', join(HOME, 'whisper/Release/whisper-server.exe'), ['-m', join(HOME, 'whisper/turbo.bin'), '--port', '8091', '-l', 'en', '--convert'], { cwd: join(HOME, 'whisper/Release') });
keep('voice', process.execPath, ['server.mjs'], { cwd: SERVER_DIR, env: { ...process.env, JARVIS_SERVER_KEY: KEY, LLM_URL: 'http://127.0.0.1:8090', PORT: '8787' } });
keep('tunnel', join(HOME, 'cloudflared.exe'), ['tunnel', '--url', 'http://localhost:8787', '--no-autoupdate'], {}, async line => {
  const origin = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!origin) return;
  for (let attempt = 0; attempt < 10; attempt++) {
    const ok = await fetch(`${RELAY}/__tunnel`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}`, 'content-type': 'application/json' }, body: JSON.stringify({ origin }) }).then(r => r.ok).catch(() => false);
    if (ok) { log(`relay now points at ${origin}`); return; }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  log(`could not update relay for ${origin}`);
});
