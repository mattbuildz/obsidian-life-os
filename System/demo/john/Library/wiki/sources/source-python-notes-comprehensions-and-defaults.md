---
kind: source
id: source-python-notes-comprehensions-and-defaults
alias: [python notes comprehensions and defaults]
status: active
date: 2026-09-28
file: "Library/sources/own-notes/2026-09-28-python-notes-comprehensions-and-defaults.md"
file-hash: 6b0da4
sources:
  - "[[source-python-notes-comprehensions-and-defaults]]"
originals:
  - "[[2026-09-28-python-notes-comprehensions-and-defaults]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: 6cf9d8
---

# Source: "quick notes — comprehensions and mutable defaults" (own note)

**Own note, 2026-09-28**, 2 KB, `source-type: note`, `topics: [python]`. Written after a real bug in Budget CLI; no external link.

> **▶ ORIGINAL:** file in `Library/sources/own-notes/` (no external address).

## What it's about

Two things from one debugging session: how list comprehensions read (filter vs. conditional expression, nested comprehensions), and a mutable-default-argument bug that actually happened in Budget CLI's `add_expense` function.

## What came out of it

- [[list-comprehensions]] — new page, the filter-vs-conditional-expression distinction and the nested-comprehension reading order.
- [[mutable-default-arguments]] — new page, the exact bug and the `None`-sentinel fix.

## Strengths and limits

**Strong:** a real bug with a before/after fix, not a hypothetical — the kind of thing that's easy to verify by running it.

**Limits:** self-taught understanding, no link to the language reference for the formal grammar of comprehensions. `source-count: 1`.

## Details not carried over

*As of 2026-10-01.* Nothing significant — everything in the note made it into the two pages above.

## Related

- [[python-moc]] — folder map
- [[sources-moc]] — coverage across all sources

## Sources

- **[[2026-09-28-python-notes-comprehensions-and-defaults]]** — original in the vault · our summary: this page
