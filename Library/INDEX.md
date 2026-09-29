# INDEX — Library catalog

*Landed here first? This is a machine catalog, not documentation. What the Library is for, and commands: `HANDBOOK.html` (root of the vault) — Library tab.*

> [!info] Reading order: `wiki/hot.md` → this file → pages
> Fixed format, ~150 chars per entry max: `- [[id]] · kind · status · source-count N · description`
> Hard ceiling: 300 lines — past that this file becomes an index of indexes.
> Pointers (tools, repos, one-off links) are **not here** — see `wiki/_catalog.md`, one line each.

## python/ — language mechanics

- [[python-moc]] · **moc — START HERE** · active · a list comprehension's `if` placement decides filter vs. value picker; everything else follows
- [[list-comprehensions]] · concept · active · source-count 1 · filter `if` after `for` drops items; `if/else` before `for` picks a value
- [[mutable-default-arguments]] · concept · active · source-count 1 · `def f(bucket=[])` shares one list across calls; fix with a `None` sentinel

## git/ — day-to-day git

- [[git-moc]] · **moc — START HERE** · active · tracking state is stickier than it looks, then the commit message itself
- [[staging-area]] · concept · active · source-count 1 · `git add` is a snapshot, not a live link; can be staged and modified at once
- [[gitignore-untracked-only]] · concept · active · source-count 1 · `.gitignore` only stops NEW tracking; `git rm --cached` untracks a tracked file
- [[commit-messages]] · concept · active · source-count 1 · `<type>: summary` prefix lets tools bump versions and build changelogs automatically

## sources/

- [[sources-moc]] · **moc — START HERE** · active · what the whole wiki was built from: three sources, their coverage, as a table
- [[source-python-notes-comprehensions-and-defaults]] · source · active · own note, comprehensions + mutable-default bug from Budget CLI, 2026-09-28
- [[source-git-notes-staging-and-gitignore]] · source · active · own note, staging area + `.gitignore` confusion from a group chat, 2026-09-29
- [[source-conventional-commits-article]] · source · active · clipped article on Conventional Commits, 2026-09-30

## MOCs

*Each folder has its own MOC, living in that folder — that's the entry point, marked **START HERE** above. Rule and template: `SCHEMA.md`.*
