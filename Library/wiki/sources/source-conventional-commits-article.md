---
kind: source
id: source-conventional-commits-article
alias: [conventional commits article, commit message article]
status: active
date: 2026-09-30
file: "Library/sources/articles/conventional-commits-article.md"
file-hash: bc4caf
sources:
  - "[[source-conventional-commits-article]]"
originals:
  - "[[conventional-commits-article]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: 775591
---

# Source: "Conventional Commits — why the format matters" (clipped article)

**Clipped article, 2026-09-30**, 1 KB, `source-type: article`, `topics: [git]`. Clipped after a teammate's PR had five commits all named "fix".

> **▶ ORIGINAL:** [conventionalcommits.org — Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)

## What it's about

The `<type>: <summary>` shape of a Conventional Commits message, why a fixed set of types (`fix`, `feat`, ...) lets tooling read a commit mechanically, and the `!`/`BREAKING CHANGE:` marker for a major-version bump.

## What came out of it

- [[commit-messages]] — new page, the type-prefix convention and why it exists (automatable versioning and changelogs, not just style).

## Strengths and limits

**Strong:** ties the convention to a concrete payoff (automatic version bumps, generated changelogs) instead of presenting it as a style preference.

**Limits:** the scope syntax (`feat(parser): ...`) and the full footer grammar were not read closely — parked, not in the resulting page. `source-count: 1`.

## Details not carried over

*As of 2026-10-01.* Scope syntax (`feat(scope): ...`) and the full footer grammar — noted above, not extracted into [[commit-messages]].

## Related

- [[git-moc]] — folder map
- [[sources-moc]] — coverage across all sources

## Sources

- **[[conventional-commits-article]]** — original in the vault (clipped copy) · our summary: this page · external: [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/)
