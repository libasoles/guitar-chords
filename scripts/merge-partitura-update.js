#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { REPO, BRANCH, validateManifestUpdate, validatePullRequest, validateCI, command, api, pages, ancestor, automationContext } = require('./lib/partitura-update');

function main() {
  automationContext();
  assert.equal(process.env.GITHUB_REF, `refs/heads/${BRANCH}`);
  const head = process.env.GITHUB_SHA;
  const run = api(`repos/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  const jobs = JSON.parse(command('gh', ['api', `repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`, '--paginate', '--slurp'])).flatMap((page) => page.jobs);
  validateCI(run, jobs, head);
  const prs = api(`repos/${REPO}/pulls?state=open&base=main&head=libasoles:${BRANCH}`);
  assert.equal(prs.length, 1, 'Exactly one update PR must be open');
  const pr = prs[0];
  validatePullRequest(pr, pages(`repos/${REPO}/pulls/${pr.number}/files?per_page=100`), head);
  command('git', ['fetch', 'origin', 'main']);
  assert.ok(ancestor('origin/main', head), 'Main advanced during CI; the updater must refresh and retest the PR');
  const read = (ref, file) => JSON.parse(command('git', ['show', `${ref}:${file}`]));
  validateManifestUpdate(read('origin/main', 'package.json'), read(head, 'package.json'), read(head, 'package-lock.json'));
  // The API rejects a changed head; this never enables an unconditional auto-merge.
  const merged = api(`repos/${REPO}/pulls/${pr.number}/merge`, 'PUT', { sha: head, merge_method: 'squash', commit_title: pr.title });
  assert.equal(merged.merged, true, 'GitHub did not merge the tested revision');
  // A merge using GITHUB_TOKEN does not emit ordinary push workflows.
  api(`repos/${REPO}/actions/workflows/ci.yml/dispatches`, 'POST', { ref: 'main' });
  api(`repos/${REPO}/git/refs/heads/${BRANCH}`, 'DELETE');
  console.log(`Merged ${pr.html_url} at ${merged.sha}; dispatched CI and deployment on main.`);
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { main };
