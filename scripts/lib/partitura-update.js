'use strict';
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { SUITES } = require('../ci-e2e-targets');

const REPO = 'libasoles/guitar-chords';
const UPSTREAM = 'libasoles/partitura';
const BRANCH = 'automation/update-partitura';
const BOT = 'github-actions[bot]';

function pinnedSha(spec) {
  const match = /^(?:github:libasoles\/partitura|git\+https:\/\/github\.com\/libasoles\/partitura(?:\.git)?|git\+ssh:\/\/git@github\.com\/libasoles\/partitura(?:\.git)?)#([a-f0-9]{40})$/.exec(spec || '');
  assert.ok(match, 'Partitura must point to a full commit in libasoles/partitura');
  return match[1];
}

function validateManifestUpdate(base, head, lock) {
  const previous = pinnedSha(base.devDependencies?.partitura);
  const next = pinnedSha(head.devDependencies?.partitura);
  assert.notEqual(previous, next, 'The dependency must actually change');
  const withoutPin = (pkg) => {
    const copy = structuredClone(pkg);
    delete copy.devDependencies.partitura;
    return copy;
  };
  assert.deepEqual(withoutPin(head), withoutPin(base), 'Only the Partitura dependency may change');
  assert.equal(pinnedSha(lock.packages?.[''].devDependencies?.partitura), next, 'Manifest and lockfile must agree');
  assert.equal(pinnedSha(lock.packages?.['node_modules/partitura'].resolved), next, 'Installed revision must match');
  return next;
}

function validatePullRequest(pr, files, headSha) {
  assert.equal(pr.state, 'open');
  assert.equal(pr.draft, false);
  assert.equal(pr.user.login, BOT, 'Only the updater bot can merge automatically');
  assert.equal(pr.base.repo.full_name, REPO);
  assert.equal(pr.head.repo.full_name, REPO, 'Fork PRs cannot auto-merge');
  assert.equal(pr.base.ref, 'main');
  assert.equal(pr.head.ref, BRANCH);
  assert.equal(pr.head.sha, headSha, 'A newer commit needs its own CI run');
  assert.deepEqual(files.map((f) => [f.filename, f.status]).sort(), [
    ['package-lock.json', 'modified'], ['package.json', 'modified'],
  ], 'The PR may modify only the two dependency manifests');
}

function validateCI(run, jobs, headSha, suites = Object.keys(SUITES)) {
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.head_branch, BRANCH);
  assert.equal(run.head_sha, headSha);
  assert.equal(run.path, '.github/workflows/ci.yml');
  for (const name of ['changes', 'test-and-build', 'ci-ok', ...suites.map((s) => `e2e (${s})`)]) {
    assert.equal(jobs.find((job) => job.name === name)?.conclusion, 'success', `${name} must pass for this revision`);
  }
}

function command(program, args, options = {}) {
  return execFileSync(program, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...options })?.trim();
}
function api(route, method = 'GET', body) {
  const args = ['api', route, '--method', method];
  if (body !== undefined) args.push('--input', '-');
  const result = command('gh', args, { input: body === undefined ? undefined : JSON.stringify(body) });
  return result ? JSON.parse(result) : null;
}
function pages(route) {
  return JSON.parse(command('gh', ['api', route, '--paginate', '--slurp'])).flat();
}
function ancestor(base, head) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', base, head]);
  if (![0, 1].includes(result.status)) throw new Error('Cannot determine branch ancestry');
  return result.status === 0;
}
function automationContext() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run this through GitHub Actions');
  assert.equal(process.env.GITHUB_REPOSITORY, REPO, 'Automation runs only in the consuming repository');
}

module.exports = { REPO, UPSTREAM, BRANCH, BOT, pinnedSha, validateManifestUpdate, validatePullRequest, validateCI, command, api, pages, ancestor, automationContext };
