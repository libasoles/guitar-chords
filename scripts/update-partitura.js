#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const { REPO, UPSTREAM, BRANCH, pinnedSha, validateManifestUpdate, command, api, ancestor, automationContext } = require('./lib/partitura-update');

function main() {
  automationContext();
  command('git', ['fetch', 'origin', 'main']);
  const base = JSON.parse(command('git', ['show', 'origin/main:package.json']));
  const current = pinnedSha(base.devDependencies.partitura);
  const latest = api(`repos/${UPSTREAM}/commits/main`).sha;
  if (current === latest) { console.log('Partitura is already up to date.'); return; }
  if (!/^[a-f0-9]{40}$/.test(latest)) throw new Error('Invalid upstream commit');

  const prs = api(`repos/${REPO}/pulls?state=open&base=main&head=libasoles:${BRANCH}`);
  if (prs.length > 1) throw new Error('More than one update PR is open');
  let pr = prs[0];
  if (pr && pr.user.login !== 'github-actions[bot]') throw new Error('The update branch belongs to another author');
  let head;
  if (pr) {
    command('git', ['fetch', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
    const pkg = JSON.parse(command('git', ['show', `origin/${BRANCH}:package.json`]));
    if (pinnedSha(pkg.devDependencies.partitura) === latest && ancestor('origin/main', `origin/${BRANCH}`)) head = pr.head.sha;
  }
  if (!head) {
    const remote = command('git', ['ls-remote', 'origin', `refs/heads/${BRANCH}`]).split(/\s/)[0];
    command('git', ['checkout', '-B', BRANCH, 'origin/main']);
    command('npm', ['install', '--save-dev', `git+https://github.com/${UPSTREAM}.git#${latest}`], { stdio: 'inherit' });
    validateManifestUpdate(base, JSON.parse(fs.readFileSync('package.json')), JSON.parse(fs.readFileSync('package-lock.json')));
    command('git', ['config', 'user.name', 'github-actions[bot]']);
    command('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
    command('git', ['add', 'package.json', 'package-lock.json']);
    command('git', ['commit', '-m', `Update Partitura to ${latest.slice(0, 12)}`]);
    command('git', ['push', `--force-with-lease=refs/heads/${BRANCH}:${remote}`, 'origin', `HEAD:refs/heads/${BRANCH}`]);
    head = command('git', ['rev-parse', 'HEAD']);
  }
  const details = {
    title: `Update Partitura to ${latest.slice(0, 12)}`,
    body: `Updates the build-time editor to https://github.com/${UPSTREAM}/commit/${latest}.\n\nThe full CI (build, unit tests and every browser suite) runs before automatic merge. A failure leaves this PR open. The merge job accepts only these two manifests and the exact tested commit.`,
  };
  if (!pr) pr = api(`repos/${REPO}/pulls`, 'POST', { ...details, head: BRANCH, base: 'main' });
  else api(`repos/${REPO}/pulls/${pr.number}`, 'PATCH', details);
  console.log(pr.html_url);
  const runs = api(`repos/${REPO}/actions/workflows/ci.yml/runs?branch=${BRANCH}&event=workflow_dispatch&per_page=100`).workflow_runs;
  const previous = runs.find((run) => run.head_sha === head);
  if (previous && (previous.status !== 'completed' || previous.conclusion === 'success' || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch')) {
    console.log(`CI already ran or is running for ${head}: ${previous.html_url}`);
    return;
  }
  // GITHUB_TOKEN does not trigger ordinary push CI. Explicit dispatch does.
  api(`repos/${REPO}/actions/workflows/ci.yml/dispatches`, 'POST', { ref: BRANCH });
  console.log(`Dispatched the complete CI for ${head}.`);
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { main };
