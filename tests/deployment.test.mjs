import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { successfulRun, assertSourcePaths, schemaFingerprint, activateWithRollback } from '../deploy/automation/policy.mjs';

const sha = 'a'.repeat(40);
const passed = { head_sha: sha, head_branch: 'main', event: 'push', run_number: 1, run_attempt: 1, status: 'completed', conclusion: 'success' };
test('only a successful main workflow for the exact commit allows deployment', () => {
  assert.equal(successfulRun([passed], sha), passed);
  for (const change of [{ head_sha: 'b'.repeat(40) }, { head_branch: 'feature' }, { event: 'pull_request' }, { status: 'in_progress' }, { conclusion: 'failure' }])
    assert.equal(successfulRun([{ ...passed, ...change }], sha), null);
});
test('a failed newer run cannot be bypassed by an older successful run', () => {
  assert.equal(successfulRun([passed, { ...passed, run_number: 2, conclusion: 'failure' }], sha), null);
});
test('source exports reject credentials, runtime data, symlinks and traversal', () => {
  assert.doesNotThrow(() => assertSourcePaths([{ mode: '100644', name: '.env.example' }, { mode: '100755', name: 'deploy/staging/run.sh' }]));
  for (const entry of [{ mode: '100644', name: '.env' }, { mode: '100644', name: 'src/.env.local' }, { mode: '100644', name: 'src/generated/prisma/client.ts' }, { mode: '100644', name: 'node_modules/pkg/index.js' }, { mode: '120000', name: 'link' }, { mode: '160000', name: 'submodule' }, { mode: '100644', name: '../escape' }])
    assert.throws(() => assertSourcePaths([entry]));
});
test('schema and migration changes alter the deployment compatibility fingerprint', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barista-deploy-policy-'));
  try {
    fs.mkdirSync(root + '/prisma/migrations/initial', { recursive: true });
    fs.writeFileSync(root + '/prisma/schema.prisma', 'schema'); fs.writeFileSync(root + '/prisma/migrations/initial/migration.sql', 'initial');
    const original = schemaFingerprint(root);
    fs.writeFileSync(root + '/prisma/schema.prisma', 'changed'); assert.notEqual(schemaFingerprint(root), original);
    fs.writeFileSync(root + '/prisma/schema.prisma', 'schema'); assert.equal(schemaFingerprint(root), original);
    fs.writeFileSync(root + '/prisma/migrations/initial/migration.sql', 'changed'); assert.notEqual(schemaFingerprint(root), original);
  } finally {
    // This helper creates a unique directory directly under the OS temp root.
    const resolved = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), temp); fs.rmSync(resolved, { recursive: true });
  }
});
test('successful activation selects and restarts once', async () => {
  const calls = [];
  await activateWithRollback({ previous: 'old', next: 'new', select: value => calls.push(value), restart: () => calls.push('restart'), healthy: async () => true });
  assert.deepEqual(calls, ['new', 'restart']);
});
test('failed new health check restores and verifies the old release', async () => {
  const calls = []; let checks = 0;
  await assert.rejects(activateWithRollback({ previous: 'old', next: 'new', select: value => calls.push(value), restart: () => calls.push('restart'), healthy: async () => ++checks > 1 }), /previous release restored/);
  assert.deepEqual(calls, ['new', 'restart', 'old', 'restart']); assert.equal(checks, 2);
});
test('restart errors also restore the previous release', async () => {
  const calls = []; let restarts = 0;
  await assert.rejects(activateWithRollback({ previous: 'old', next: 'new', select: value => calls.push(value), restart: () => { if (++restarts === 1) throw Error('restart failed'); }, healthy: async () => true }), /previous release restored/);
  assert.deepEqual(calls, ['new', 'old']);
});
