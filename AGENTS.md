# Agent workflow

When an agent finishes a coding task in this repo:

1. Commit the changes.
2. Merge the worktree's branch into `main` locally (run `git merge` from the main checkout; do not just open a PR and stop — merge it).
3. Push `main`.
4. Delete the worktree used for the task (`ExitWorktree` with `action: "remove"`, or `git worktree remove`) and delete the now-merged branch.

Read this file before starting any task, and do not report the task as finished until steps 1–4 are done. Reporting "committed on branch X" is not completion.

Sessions that entered a worktree cannot run git against the main checkout (the harness refuses `cd` to it). So after committing: call `ExitWorktree` with `action: "keep"` to return to the main checkout, run the merge, push and cleanup from there, then remove the worktree and branch.

This repo does not require draft PRs for routine agent work — merge directly to `main` once the change is verified (tests/build pass, or manual verification done). Only stop to ask the user first if the change is risky, destructive, or ambiguous in scope.

## Lab

Everything for the lab (its editor, server, tests, scores and notes) lives under `lab/`, including `lab/folklore-editor/`. `lab/` is local and git-ignored: never version it and never put lab code in `scripts/`, `src/` or elsewhere in the tracked tree. A worktree does not contain `lab/`, so edit it in the main checkout; there is nothing to commit, merge or push for it. Shared tooling the lab needs (e.g. `scripts/lib/chrome-path.js`) stays in the repo and the lab reaches it by relative path.

## Browser tooling (offline)

Playwright and Lighthouse are dev dependencies, so `npm ci` is the only install step. Don't download browsers or install tools from the web.

- Chromium is resolved by `scripts/lib/chrome-path.js`: `$CHROME_PATH`, then Playwright's own browser, then any preinstalled `chromium-*` under `$PLAYWRIGHT_BROWSERS_PATH` or `/opt/pw-browsers` (cloud sandboxes ship one). The e2e tests and screenshot scripts already use it.
- `npm run lighthouse [-- /path] [--desktop] [--runs 3] [--skip-build]` builds the site, serves it locally and audits it (mobile by default). Reports go to `dist/lighthouse/`. Sandbox scores are noisy, so compare before/after on the same machine with `--runs 3` rather than trusting absolute thresholds.

## Tests

- Avoid running the full test suite (`npm test`) or the e2e suite (`npm run test:e2e`) locally; e2e tests take ~10 minutes. Run unit tests (`npm run test:unit`) or target the specific test file (`node --test test/<file>.unit.js`). Only run e2e tests when adding a new e2e test or when diagnosing a suspected breakage, and then run only that specific test file (e.g. `node test/<file>.e2e.js`), never the full suite. Articles are split into one suite per article (`test/articles-<name>.e2e.js`); run only the one you touched, or `node scripts/run-e2e.js articles` for all of them in parallel.
- Keep manual review screenshots in a separate, untracked script or invocation. Commit screenshots in tests only when an assertion consumes them or CI explicitly collects them.
- Resolve test fixtures from the repository. For temporary artifacts, use `os.tmpdir()` with `fs.mkdtemp()` and create output directories before writing; never assume a developer's absolute path exists on the Linux CI runner.
- Before committing test changes, inspect their file reads and writes for machine-specific paths and leftover review artifacts. Local test success alone does not verify filesystem portability; check the pushed CI result before reporting CI as passing.

## New pages

Every new page registers its slug in Spanish and English in `scripts/lib/slugs.js` (see `docs/adr/0003-slugs-por-idioma-y-redireccion-de-urls-viejas.md`). New pages get no redirect.

## Modals

Full-screen modals (`modal-full` in `scripts/lib/modal.js`) always show the home logo top left; pass `locale` and `strings` to `modal()` and it renders it. Do not add per-page logo code.

## Icons

Every icon must be a [Lucide](https://lucide.dev) icon whenever one exists (inline its SVG paths). Only draw a custom icon when Lucide has no equivalent.

## Editor marks

The user marks some scores with editor marks (their own picks) and will ask for more in later sessions. Four exist: **favorite** ("favorita del editor", filled black Lucide `star`), **insightful** (Lucide `square-star`), **effort** (Lucide `square-activity`) and **bookmark** (Lucide `bookmark`). Each shows as an icon with no visible text left of the title in its card and, in the full-score modal, on the score title line flush with the staff left edge (`.modal-pages > .editor-marks`). To mark one, add its number to the collection list in `scripts/lib/editor-marks.js`; if that collection card builder does not yet call `editorMarks(...)` in the `prelude-card-title` h2 and in its modal `.modal-pages` (only Sagreras and Carcassi's progressive pieces do), add it. Each icon shows a black Radix-style tooltip on hover/focus (`.tooltip` + `data-tooltip` in `11-articles.css`; reuse it for any other tooltip). Mark every new one the same way; do not invent another style. Adding scores to editor marks is a trivial data edit in `scripts/lib/editor-marks.js`: do not run local builds or tests when only updating these lists.
