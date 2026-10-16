# Agent workflow

When an agent finishes a coding task in this repo:

1. Commit the changes.
2. Merge the worktree's branch into `main` locally (run `git merge` from the main checkout; do not just open a PR and stop — merge it).
3. Push `main`.
4. Delete the worktree used for the task (`ExitWorktree` with `action: "remove"`, or `git worktree remove`) and delete the now-merged branch.

This repo does not require draft PRs for routine agent work — merge directly to `main` once the change is verified (tests/build pass, or manual verification done). Only stop to ask the user first if the change is risky, destructive, or ambiguous in scope.

## Browser tooling (offline)

Playwright and Lighthouse are dev dependencies, so `npm ci` is the only install step. Don't download browsers or install tools from the web.

- Chromium is resolved by `scripts/lib/chrome-path.js`: `$CHROME_PATH`, then Playwright's own browser, then any preinstalled `chromium-*` under `$PLAYWRIGHT_BROWSERS_PATH` or `/opt/pw-browsers` (cloud sandboxes ship one). The e2e tests and screenshot scripts already use it.
- `npm run lighthouse [-- /path] [--desktop] [--runs 3] [--skip-build]` builds the site, serves it locally and audits it (mobile by default). Reports go to `dist/lighthouse/`. Sandbox scores are noisy, so compare before/after on the same machine with `--runs 3` rather than trusting absolute thresholds.

## Portable tests and review artifacts

- Keep manual review screenshots in a separate, untracked script or invocation. Commit screenshots in tests only when an assertion consumes them or CI explicitly collects them.
- Resolve test fixtures from the repository. For temporary artifacts, use `os.tmpdir()` with `fs.mkdtemp()` and create output directories before writing; never assume a developer's absolute path exists on the Linux CI runner.
- Before committing test changes, inspect their file reads and writes for machine-specific paths and leftover review artifacts. Local test success alone does not verify filesystem portability; check the pushed CI result before reporting CI as passing.
