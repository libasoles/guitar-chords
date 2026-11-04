'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { REPO, BRANCH, pinnedSha, validateManifestUpdate, validatePullRequest, validateCI } = require('../scripts/lib/partitura-update');
const old = 'a'.repeat(40), next = 'b'.repeat(40), headSha = 'c'.repeat(40);
const spec = (sha) => `github:libasoles/partitura#${sha}`;
const base = { name: 'guitar-chords', devDependencies: { partitura: spec(old), esbuild: '^0.28.2' } };
const head = { ...base, devDependencies: { ...base.devDependencies, partitura: spec(next) } };
const lock = { packages: { '': { devDependencies: head.devDependencies }, 'node_modules/partitura': { resolved: `git+ssh://git@github.com/libasoles/partitura.git#${next}` } } };
const files = ['package.json', 'package-lock.json'].map((filename) => ({ filename, status: 'modified' }));
const pr = { state: 'open', draft: false, user: { login: 'github-actions[bot]' }, base: { ref: 'main', repo: { full_name: REPO } }, head: { ref: BRANCH, sha: headSha, repo: { full_name: REPO } } };
const run = { event: 'workflow_dispatch', head_branch: BRANCH, head_sha: headSha, path: '.github/workflows/ci.yml' };
const jobs = ['changes', 'test-and-build', 'ci-ok', 'e2e (score-editor)', 'e2e (score-loading)'].map((name) => ({ name, conclusion: 'success' }));

test('only immutable commits of the expected upstream are accepted', () => {
  assert.equal(pinnedSha(spec(next)), next);
  assert.equal(pinnedSha(`git+https://github.com/libasoles/partitura.git#${next}`), next);
  for (const value of ['github:libasoles/partitura#main', `github:someone/partitura#${next}`, `github:libasoles/partitura#${next.slice(0, 7)}`]) assert.throws(() => pinnedSha(value));
});
test('an editor update must agree with the lockfile and cannot change another dependency', () => {
  assert.equal(validateManifestUpdate(base, head, lock), next);
  const unrelated = structuredClone(head); unrelated.devDependencies.esbuild = '*';
  assert.throws(() => validateManifestUpdate(base, unrelated, lock), /Only the Partitura/);
  const wrong = structuredClone(lock); wrong.packages['node_modules/partitura'].resolved = spec(old);
  assert.throws(() => validateManifestUpdate(base, head, wrong), /Installed revision/);
  assert.throws(() => validateManifestUpdate(head, head, lock), /actually change/);
});
test('auto-merge rejects human PRs, forks, new commits and unrelated changed files', () => {
  validatePullRequest(pr, files, headSha);
  for (const change of [
    (p) => { p.user.login = 'human'; },
    (p) => { p.head.repo.full_name = 'fork/guitar-chords'; },
    (p) => { p.head.sha = next; },
    (p) => { p.base.ref = 'other'; },
  ]) { const wrong = structuredClone(pr); change(wrong); assert.throws(() => validatePullRequest(wrong, files, headSha)); }
  assert.throws(() => validatePullRequest(pr, [...files, { filename: 'src/site/score-editor.js', status: 'modified' }], headSha));
});
test('every required job must succeed on this exact revision before merging', () => {
  const suites = ['score-editor', 'score-loading'];
  validateCI(run, jobs, headSha, suites);
  for (const conclusion of ['failure', 'cancelled', 'skipped', null]) {
    const wrong = structuredClone(jobs); wrong[3].conclusion = conclusion;
    assert.throws(() => validateCI(run, wrong, headSha, suites), /must pass/);
  }
  assert.throws(() => validateCI(run, jobs.slice(0, -1), headSha, suites), /must pass/);
  assert.throws(() => validateCI({ ...run, head_sha: next }, jobs, headSha, suites));
  assert.throws(() => validateCI({ ...run, event: 'pull_request' }, jobs, headSha, suites));
});
