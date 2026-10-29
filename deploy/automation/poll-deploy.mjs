import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { parseEnv } from 'node:util';
import { repository, successfulRun, assertSourcePaths, schemaFingerprint, activateWithRollback } from './policy.mjs';

const base = '/home/evans/barista-platform', repo = base + '/repository';
const node = base + '/runtime/node/bin/node', npm = base + '/runtime/node/bin/npm';
const stateFile = base + '/shared/deployment-status.json';
const checkOnly = process.argv.includes('--check'), retry = process.argv.includes('--retry');
if (process.argv.slice(2).some(arg => !['--check', '--retry'].includes(arg))) throw new Error('Unsupported deployment option');
const env = { HOME: base + '/shared/deploy-home', USER: 'evans', PATH: base + '/runtime/node/bin:/usr/bin:/bin',
  TZ: 'Africa/Nairobi', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function git(args) {
  const result = spawnSync('/usr/bin/git', args, { cwd: repo, env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Git source operation failed');
  return result.stdout;
}
function readState() { return fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {}; }
function record(data) { const temp = stateFile + '.tmp'; fs.writeFileSync(temp, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 }); fs.renameSync(temp, stateFile); }
function select(release) {
  const resolved = fs.realpathSync(release);
  if (!resolved.startsWith(base + '/releases/') || !fs.existsSync(resolved + '/.barista-built.json')) throw new Error('Invalid built release');
  const temp = base + '/current-deploy-' + process.pid;
  fs.symlinkSync(resolved, temp); fs.renameSync(temp, base + '/current');
}
function restart() {
  for (const unit of ['barista-staging-web.service', 'barista-staging-notifications.service']) {
    const result = spawnSync('/usr/bin/sudo', ['-n', '/usr/bin/systemctl', 'restart', unit], { env, timeout: 120000, stdio: 'ignore' });
    if (result.status !== 0) throw new Error('Barista service restart failed');
  }
}
async function healthy() {
  for (let attempt = 0; attempt < 25; attempt++) {
    try { const response = await fetch('http://127.0.0.1:3210/api/ready', { signal: AbortSignal.timeout(3000) });
      if (response.ok && (await response.json()).status === 'ready') return true;
    } catch {}
    await pause(1000);
  }
  return false;
}
async function preview(release, buildEnv) {
  const available = spawnSync('/usr/bin/ss', ['-lntH', 'sport = :3220'], { encoding: 'utf8' });
  if (available.status !== 0 || available.stdout.trim()) throw new Error('Preview port is occupied');
  const log = fs.openSync(release + '/.preview.log', 'a', 0o600);
  const child = spawn(node, [release + '/node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3220'], { cwd: release, env: buildEnv, stdio: ['ignore', log, log] });
  const exit = once(child, 'exit');
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (child.exitCode !== null || child.signalCode) throw new Error('Preview process exited');
      try { if ((await fetch('http://127.0.0.1:3220/api/ready', { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
      await pause(500);
    }
    if (!ready) throw new Error('Preview did not become ready');
    for (const route of ['/', '/jobs', '/sign-in']) {
      const response = await fetch('http://127.0.0.1:3220' + route, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Preview route failed');
    }
  } finally {
    child.kill('SIGTERM');
    let timer;
    try { await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000); })]); }
    finally { clearTimeout(timer); fs.closeSync(log); }
  }
}

async function main() {
  fs.mkdirSync(env.HOME, { recursive: true, mode: 0o700 });
  if (git(['remote', 'get-url', 'origin']).trim() !== 'https://github.com/' + repository + '.git') throw new Error('Unexpected source remote');
  git(['fetch', '--quiet', '--no-tags', 'origin', 'main']);
  const sha = git(['rev-parse', 'FETCH_HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid source commit');
  const previous = fs.realpathSync(base + '/current');
  if (!previous.startsWith(base + '/releases/')) throw new Error('Unexpected current release');
  const deployed = fs.existsSync(previous + '/.source-commit') ? fs.readFileSync(previous + '/.source-commit', 'utf8').trim() : null;
  if (deployed === sha) { console.log('Already deployed: ' + sha); return; }
  const response = await fetch('https://api.github.com/repos/' + repository + '/actions/workflows/staging.yml/runs?branch=main&head_sha=' + sha + '&per_page=20', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'barista-staging-deployment', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('GitHub workflow status unavailable; deployment held');
  const run = successfulRun((await response.json()).workflow_runs || [], sha);
  if (!run) { console.log('Waiting for successful main-branch checks: ' + sha); return; }
  const runKey = run.id + ':' + run.run_attempt, state = readState();
  if (!retry && state.failedCommit === sha && state.failedRun === runKey) { console.log('Previous attempt failed; push a fix or rerun the GitHub workflow to retry.'); return; }
  console.log('Verified successful CI for ' + sha + ' (' + run.html_url + ')');
  if (checkOnly) { console.log('Check only: no release, application or database changes.'); return; }
  const entries = git(['ls-tree', '-rz', sha]).split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t'); return { mode: line.slice(0, 6), name: line.slice(tab + 1) };
  });
  assertSourcePaths(entries);
  const config = parseEnv(fs.readFileSync(base + '/shared/app.env', 'utf8')), db = new URL(config.DATABASE_URL);
  if (config.APP_URL !== 'https://barista-staging.tanzhotelms.com' || db.hostname !== '127.0.0.1' || db.pathname !== '/barista_staging' || db.username !== 'barista_staging') throw new Error('Unexpected staging configuration');
  const release = path.join(base, 'releases', 'git-' + sha.slice(0, 12) + '-' + Date.now());
  try {
    record({ ...state, status: 'building', commit: sha, workflow: run.html_url });
    fs.mkdirSync(release, { mode: 0o700 });
    const archive = base + '/incoming/deploy-' + sha + '.tar', fd = fs.openSync(archive, 'w', 0o600);
    try { const result = spawnSync('/usr/bin/git', ['archive', '--format=tar', sha], { cwd: repo, env, stdio: ['ignore', fd, 'pipe'], timeout: 120000 }); if (result.status !== 0) throw new Error('Source archive failed'); }
    finally { fs.closeSync(fd); }
    if (spawnSync('/usr/bin/tar', ['-xf', archive, '-C', release], { stdio: 'ignore' }).status !== 0) throw new Error('Source extraction failed');
    fs.unlinkSync(archive);
    if (schemaFingerprint(previous) !== schemaFingerprint(release)) throw new Error('Schema or migration changes require a reviewed database deployment');
    fs.writeFileSync(release + '/.source-commit', sha + '\n');
    const buildEnv = { ...env, ...config, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NPM_CONFIG_CACHE: base + '/shared/npm-cache', XDG_CACHE_HOME: base + '/shared/cache' };
    delete buildEnv.NEXT_DIST_DIR; delete buildEnv.SHADOW_DATABASE_URL;
    const log = fs.openSync(release + '/.deploy-build.log', 'a', 0o600);
    try { for (const args of [['ci', '--include=dev', '--no-audit'], ['run', 'build']]) {
      console.log('Building release: npm ' + args.join(' '));
      const result = spawnSync(npm, args, { cwd: release, env: buildEnv, stdio: ['ignore', log, log], timeout: 900000 });
      if (result.status !== 0) throw new Error('Release build failed; see private release build log');
    } } finally { fs.closeSync(log); }
    fs.writeFileSync(release + '/.barista-built.json', JSON.stringify({ origin: config.APP_URL, node: process.version, commit: sha, builtAt: new Date().toISOString() }));
    await preview(release, buildEnv);
    // A newer commit waits for the next poll; do not activate an obsolete build.
    git(['fetch', '--quiet', '--no-tags', 'origin', 'main']);
    if (git(['rev-parse', 'FETCH_HEAD']).trim() !== sha) { record({ ...state, status: 'superseded', commit: sha }); console.log('Newer main commit found; old build was not activated.'); return; }
    fs.writeFileSync(base + '/shared/previous-release', previous + '\n', { mode: 0o600 });
    await activateWithRollback({ previous, next: release, select, restart, healthy });
    record({ status: 'deployed', commit: sha, release, previous, workflow: run.html_url });
    console.log('Deployed successfully: ' + sha);
  } catch (error) {
    record({ ...state, status: 'failed', failedCommit: sha, failedRun: runKey, release, previous, message: error.message });
    throw error;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
