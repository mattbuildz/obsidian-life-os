---
kind: concept
id: commit-messages
alias: [conventional commits, commit message convention, feat fix chore]
status: active
sources:
  - "[[source-conventional-commits-article]]"
originals:
  - "[[conventional-commits-article]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: 775591
---

# Commit message conventions (Conventional Commits)

> **TL;DR:** the first line of a commit message follows a fixed shape, `<type>: <short summary>`, where `type` is one of a small fixed set (`fix`, `feat`, `docs`, `refactor`, `chore`, …). The type is a promise about what the commit *does*, not a description of which files changed — and because it's fixed, tools can read it mechanically.

## Why a fixed prefix instead of a free-form sentence

`fix` means the commit patches a bug. `feat` means it adds a capability. Once every commit's first word is drawn from a small, known set, a tool can scan the commit log and do things a human previously had to do by hand:

- bump the patch version automatically on a `fix` commit,
- bump the minor version automatically on a `feat` commit,
- generate a changelog straight from the log, grouped by type, instead of someone writing "what changed" after the fact.

None of this works if half the commits are just named `fix` or `updates` — the type has to actually mean something for the automation to trust it.

## Marking a breaking change

A `!` right after the type (`feat!: drop the old CLI flags`) or a `BREAKING CHANGE:` footer flags a commit that breaks backward compatibility. That's the one signal that maps to a **major** version bump instead of a minor or patch one.

```
feat!: rename `--out` flag to `--output`

BREAKING CHANGE: scripts using `--out` will fail until updated.
```

## What this page doesn't cover yet

The scope syntax (`feat(parser): ...`) and the full footer grammar beyond `BREAKING CHANGE:` weren't read closely from the source article — see the gaps note on [[source-conventional-commits-article]].

## Related

- **[[git-moc]]** — folder map: commit messages come after staging in the day-to-day git loop

## Sources

- **[[conventional-commits-article]]** — original in the vault (clipped copy) · our summary: [[source-conventional-commits-article]] · external: [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/)
