---
kind: moc
id: sources-moc
alias: [MOC sources, sources overview]
status: active
date: 2026-10-01
sources:
  - "[[source-conventional-commits-article]]"
  - "[[source-git-notes-staging-and-gitignore]]"
  - "[[source-python-notes-comprehensions-and-defaults]]"
originals:
  - "[[conventional-commits-article]]"
  - "[[2026-09-29-git-notes-staging-and-gitignore]]"
  - "[[2026-09-28-python-notes-comprehensions-and-defaults]]"
source-count: 3
last-ingest: 2026-10-01
source-hash: 0ed657
---

# Sources — what this whole wiki was built from

This page is a **table**, not sections — one row per source, so it doesn't grow a paragraph every time a new source is ingested. The breakdown of a single source into pages lives on that source's own page, not here.

| Source | Type | About | What came out | Coverage |
|---|---|---|---|---|
| [[source-python-notes-comprehensions-and-defaults]] | note | own debugging notes, comprehensions + a mutable-default bug in Budget CLI | [[list-comprehensions]], [[mutable-default-arguments]] | both concepts extracted |
| [[source-git-notes-staging-and-gitignore]] | note | own notes explaining a teammate's git confusion | [[staging-area]], [[gitignore-untracked-only]] | both concepts extracted |
| [[source-conventional-commits-article]] | article | clipped explainer on Conventional Commits | [[commit-messages]] | scope syntax and full footer grammar not extracted, see the source page's gaps note |

## What this base stands on

Every source so far is either a same-day own note (`source-type: note`) or one clipped article — no course transcripts, no documentation dumps yet. That means `source-count: 1` on most pages: single-source, not yet cross-checked against a second account of the same mechanism.

## What's not here yet

- Two items are still waiting in `Library/sources/inbox/` — virtual environments and an f-strings-vs-`.format()` forum clip — neither has been compiled into a page yet.
- No course material has been ingested yet, only self-written notes and one web article.

## Related

- **[[python-moc]]** — where the python-topic sources ended up
- **[[git-moc]]** — where the git-topic sources ended up

## Sources

- **[[2026-09-28-python-notes-comprehensions-and-defaults]]** — original in the vault · our summary: [[source-python-notes-comprehensions-and-defaults]]
- **[[2026-09-29-git-notes-staging-and-gitignore]]** — original in the vault · our summary: [[source-git-notes-staging-and-gitignore]]
- **[[conventional-commits-article]]** — original in the vault (clipped copy) · our summary: [[source-conventional-commits-article]]
