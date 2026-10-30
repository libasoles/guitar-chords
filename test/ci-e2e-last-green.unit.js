const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SUITES, targetsSinceGreen } = require('../scripts/ci-e2e-targets');

// Exercise the actual CLI while replacing only GitHub and retry delays.
function runCli(t, failures, failJobs = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-last-green-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const preload = path.join(dir, 'github.cjs');
  fs.writeFileSync(preload, `
    const failures = ${JSON.stringify(failures)};
    global.setTimeout = (callback) => { callback(); };
    global.fetch = async (url, options) => {
      if (!options.signal) console.error('NO_TIMEOUT');
      const jobs = url.includes('/jobs?');
      if (jobs === ${failJobs} && failures.length) {
        const status = failures.shift();
        console.error('FAILED_REQUEST');
        if (status === 'network') throw new TypeError('fetch failed');
        if (status === 'timeout') throw new DOMException('Request timed out', 'TimeoutError');
        return { ok: false, status };
      }
      return { ok: true, json: async () => jobs
        ? { jobs: ${JSON.stringify(Object.keys(SUITES).map((n) => ({ name: `e2e (${n})`, conclusion: 'success' })))} }
        : { workflow_runs: [{ id: 2, head_sha: 'current' }, { id: 1, head_sha: 'previous' }] }
      };
    };
  `);
  return spawnSync(process.execPath, ['--require', preload, path.resolve(__dirname, '../scripts/ci-e2e-last-green.js')], {
    env: { ...process.env, GITHUB_REPOSITORY: 'test/repo', GITHUB_TOKEN: 'test-token', GITHUB_RUN_ID: '2' },
    encoding: 'utf8', timeout: 5000,
  });
}

for (const [name, failures, failJobs] of [
  ['history is available', [], false],
  ['workflow listing returns 502', [502], false],
  ['job listing returns 502', [502], true],
  ['GitHub rate limits a request', [429], true],
  ['network request fails', ['network'], true],
  ['request times out', ['timeout'], true],
]) {
  test(`the CLI recovers when ${name}`, (t) => {
    const result = runCli(t, failures, failJobs);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), Object.fromEntries(Object.keys(SUITES).map((n) => [n, 'previous'])));
    assert.doesNotMatch(result.stderr, /NO_TIMEOUT/);
  });
}

for (const failJobs of [false, true]) {
  test(`persistent API failures run all suites (${failJobs ? 'jobs' : 'runs'})`, (t) => {
    const result = runCli(t, [502, 502, 502, 502], failJobs);
    assert.equal(result.status, 0, result.stderr);
    const green = JSON.parse(result.stdout);
    assert.ok(Object.values(green).every((sha) => sha === null));
    assert.deepEqual(targetsSinceGreen(green, () => assert.fail('must not diff an unknown commit')), Object.keys(SUITES));
    assert.equal(result.stderr.match(/FAILED_REQUEST/g)?.length, 3);
    assert.match(result.stderr, /::warning::/);
  });
}

test('authorization errors fall back without retrying', (t) => {
  const result = runCli(t, [403, 403, 403]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.match(/FAILED_REQUEST/g)?.length, 1);
  assert.ok(Object.values(JSON.parse(result.stdout)).every((sha) => sha === null));
});
