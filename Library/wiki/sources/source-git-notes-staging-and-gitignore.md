---
kind: source
id: source-git-notes-staging-and-gitignore
alias: [git notes staging and gitignore]
status: active
date: 2026-09-29
file: "Library/sources/own-notes/2026-09-29-git-notes-staging-and-gitignore.md"
file-hash: 598d91
sources:
  - "[[source-git-notes-staging-and-gitignore]]"
originals:
  - "[[2026-09-29-git-notes-staging-and-gitignore]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: cd6994
---

# Source: "quick notes — staging area and .gitignore" (own note)

**Own note, 2026-09-29**, 2 KB, `source-type: note`, `topics: [git]`. Written up after explaining a teammate's git confusion in the group chat; no external link.

> **▶ ORIGINAL:** file in `Library/sources/own-notes/` (no external address).

## What it's about

Two separate confusions from the same conversation: why `git add` looked like it "didn't work" (staging is a snapshot, not a live pointer), and why adding a pattern to `.gitignore` didn't hide an already-tracked file.

## What came out of it

- [[staging-area]] — new page, the snapshot-not-pointer model and the "staged and modified at once" symptom.
- [[gitignore-untracked-only]] — new page, why `.gitignore` only filters untracked files and the `git rm --cached` fix.

## Strengths and limits

**Strong:** both mechanisms come from an actual conversation where the wrong mental model produced a concrete, reproducible symptom.

**Limits:** no reference to git's own documentation, terminology is informal. `source-count: 1`.

## Details not carried over

*As of 2026-10-01.* Nothing significant — everything in the note made it into the two pages above.

## Related

- [[git-moc]] — folder map
- [[sources-moc]] — coverage across all sources

## Sources

- **[[2026-09-29-git-notes-staging-and-gitignore]]** — original in the vault · our summary: this page
