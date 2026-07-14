# Agent workflow

When an agent finishes a coding task in this repo:

1. Commit the changes.
2. Merge the branch into `main` (do not just open a PR and stop — merge it).
3. Push `main`.
4. Delete the worktree used for the task (`ExitWorktree` with `action: "remove"`, or `git worktree remove`) and delete the now-merged branch.

This repo does not require draft PRs for routine agent work — merge directly to `main` once the change is verified (tests/build pass, or manual verification done). Only stop to ask the user first if the change is risky, destructive, or ambiguous in scope.
