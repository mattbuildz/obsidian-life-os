---
kind: moc
id: git-moc
alias: [MOC git, git overview, git where to start]
status: active
date: 2026-10-01
sources:
  - "[[source-conventional-commits-article]]"
  - "[[source-git-notes-staging-and-gitignore]]"
originals:
  - "[[conventional-commits-article]]"
  - "[[2026-09-29-git-notes-staging-and-gitignore]]"
source-count: 2
last-ingest: 2026-10-01
source-hash: 5e40a0
---

# Git — how this folder fits together

The page that spans the `git/` folder. Follows the order these things actually come up in a normal day of committing code, not the alphabet.

## Before you commit: what git already knows about a file

Two ways git's tracking state trips people up, both from the same real conversation:

- **[[staging-area]]** — `git add` takes a snapshot of the file **at that moment**, not a live link. Edit the file again after staging, and `git status` will show it as both staged and modified at once — that's two real copies of the content, not a bug.
- **[[gitignore-untracked-only]]** — `.gitignore` only stops git from picking up a file it doesn't know about yet. Already-tracked files ignore the rule completely; `git rm --cached` is the actual fix.

Both come down to the same thing: git's tracking state is stickier than it looks, in both directions — staging doesn't update itself, and `.gitignore` doesn't retroactively apply.

## Writing the message itself

**[[commit-messages]]** — once the snapshot is right, the `<type>: <summary>` convention (Conventional Commits) makes the message machine-readable: a `fix` can bump a patch version automatically, a `feat` a minor version, and `feat!`/`BREAKING CHANGE:` a major one. The payoff is automation, not style points.

## What's not here yet

- **Branching, merging, rebasing** — nothing here yet.
- **`git log`, `git diff`, reading output** — untouched, despite being used daily.
- **Undoing things** (`restore`, `reset`, `revert`) — untouched; the one time this was needed, it was figured out live instead of being written up.
- **Remotes, push/pull, PRs** — untouched.

## Related

- **[[python-moc]]** — the code this repository actually tracks

## Sources

- **[[2026-09-29-git-notes-staging-and-gitignore]]** — original in the vault (own note) · our summary: [[source-git-notes-staging-and-gitignore]]
- **[[conventional-commits-article]]** — original in the vault (clipped copy) · our summary: [[source-conventional-commits-article]]
