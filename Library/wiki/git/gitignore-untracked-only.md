---
kind: concept
id: gitignore-untracked-only
alias: [.gitignore, gitignore, git rm --cached]
status: active
sources:
  - "[[source-git-notes-staging-and-gitignore]]"
originals:
  - "[[2026-09-29-git-notes-staging-and-gitignore]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: cd6994
---

# .gitignore only affects untracked files

> **TL;DR:** `.gitignore` stops git from **starting** to track a file. If the file is already tracked (already committed at least once), adding it to `.gitignore` does nothing — git keeps watching it regardless.

## The symptom

Adding `*.log` to `.gitignore` should make `debug.log` disappear from `git status`. It doesn't, if `debug.log` was already committed at some point before the `.gitignore` line was added. Git already knows about the file; the ignore rule only applies to files it doesn't know about yet.

## The fix is a separate step

```
git rm --cached debug.log
```

`--cached` removes the file **from the staging area / git's tracking only** — it stays on disk untouched. From that point on, `debug.log` is untracked again, and the `.gitignore` rule finally has something to apply to.

## The mental model that avoids the confusion

`.gitignore` is an **input filter** — it decides what gets picked up when something new shows up in the working directory. It is not a switch you can flip on a file that's already inside the repo. Think of it as guarding the door, not patrolling the rooms that are already occupied.

## Related

- **[[git-moc]]** — folder map: this pairs with [[staging-area]] as the other place git's tracking state surprises people

## Sources

- **[[2026-09-29-git-notes-staging-and-gitignore]]** — original in the vault (own note from a group-chat explanation) · our summary: [[source-git-notes-staging-and-gitignore]]
