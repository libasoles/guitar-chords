#!/usr/bin/env node
/* Prints {suite: sha|null}: for each e2e suite, the head commit of the newest
   CI push run on main where its job `e2e (<suite>)` succeeded. Feeds
   `ci-e2e-targets.js --since-green`. Needs GITHUB_REPOSITORY and GITHUB_TOKEN;
   GITHUB_RUN_ID (the current run) is skipped. */
const { SUITES } = require('./ci-e2e-targets');

const MAX_RUNS = 50;

/* `runs` is newest first; `jobsOf(run)` resolves to its jobs. */
async function lastGreen(names, runs, jobsOf) {
  const green = Object.fromEntries(names.map((n) => [n, null]));
  for (const run of runs.slice(0, MAX_RUNS)) {
    if (names.every((n) => green[n])) break;
    for (const job of await jobsOf(run)) {
      const name = /^e2e \((.+)\)$/.exec(job.name)?.[1];
      if (name in green && !green[name] && job.conclusion === 'success') green[name] = run.head_sha;
    }
  }
  return green;
}

async function main() {
  const { GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token, GITHUB_RUN_ID: current } = process.env;
  const api = async (route) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/${route}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`${route}: ${res.status}`);
    return res.json();
  };
  const { workflow_runs } = await api(`actions/workflows/ci.yml/runs?branch=main&event=push&per_page=${MAX_RUNS}`);
  const runs = workflow_runs.filter((r) => String(r.id) !== current);
  const green = await lastGreen(Object.keys(SUITES), runs, async (run) => (await api(`actions/runs/${run.id}/jobs?per_page=100`)).jobs);
  process.stdout.write(JSON.stringify(green) + '\n');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { lastGreen };
