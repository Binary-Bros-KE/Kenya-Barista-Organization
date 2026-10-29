import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const repository = 'Binary-Bros-KE/Kenya-Barista-Organization';
export function successfulRun(runs, sha) {
  const relevant = runs.filter(run => run.head_sha === sha && run.head_branch === 'main' &&
    ['push', 'workflow_dispatch'].includes(run.event));
  relevant.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt);
  const latest = relevant[0];
  return latest?.status === 'completed' && latest.conclusion === 'success' ? latest : null;
}
export function assertSourcePaths(entries) {
  for (const { mode, name } of entries) {
    if (!['100644', '100755'].includes(mode) || name.startsWith('/') || name.split('/').includes('..'))
      throw new Error('Unsupported source entry');
    if (name !== '.env.example' && /(^|\/)\.env(?:\.|$)/.test(name)) throw new Error('Environment file in source');
    if (/(^|\/)(node_modules|\.next[^/]*|\.work|\.private-uploads|\.dev-mail)(\/|$)/.test(name) || name.startsWith('src/generated/'))
      throw new Error('Runtime data in source');
  }
}
export function schemaFingerprint(root) {
  const hash = createHash('sha256');
  function visit(relative) {
    const file = path.join(root, relative), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error('Schema symlinks are unsupported');
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(relative + '/' + name);
    else { hash.update(relative + '\0'); hash.update(fs.readFileSync(file)); hash.update('\0'); }
  }
  visit('prisma/schema.prisma'); visit('prisma/migrations');
  return hash.digest('hex');
}
export async function activateWithRollback({ previous, next, select, restart, healthy }) {
  try {
    await select(next); await restart();
    if (!await healthy()) throw new Error('New release health check failed');
  } catch (error) {
    await select(previous); await restart();
    if (!await healthy()) throw new Error('Rollback health check failed');
    throw new Error('Deployment failed; previous release restored', { cause: error });
  }
}
