---
kind: moc
id: python-moc
alias: [MOC python, python overview, python where to start]
status: active
date: 2026-10-01
sources:
  - "[[source-python-notes-comprehensions-and-defaults]]"
originals:
  - "[[2026-09-28-python-notes-comprehensions-and-defaults]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: 6cf9d8
---

# Python — how this folder fits together

The page that spans the `python/` folder. Individual mechanisms get their own page; this one is the order you make sense of them in, and why. Read top to bottom.

## Building a list in one line

[[list-comprehensions]] is the first stop because it shows up constantly in Budget CLI's category-totals code. The one thing to get right early: the `if` **after** `for` filters items out, the `if/else` **before** `for` picks a value but keeps every item. Nested comprehensions read left to right, outer loop first — easy to write backwards the first few times.

## A trap that looks like correct code

[[mutable-default-arguments]] comes right after comprehensions because it's the pitfall that actually broke Budget CLI once: `def f(bucket=[])` shares one list object across every call that doesn't pass `bucket` explicitly. The fix — `bucket=None`, then create the real list inside the function — is short, but the *why* only makes sense once you've seen the bug happen.

## What's not here yet

Written plainly, so it's visible what's missing instead of pretending this is complete:

- **Functions, `*args`/`**kwargs`, scope** — nothing here yet, even though Budget CLI's argument parsing uses all of it.
- **Classes and OOP** — untouched.
- **Exceptions, `try`/`except`** — Budget CLI's CSV parser already needs this (the encoding crash from 2026-10-05), not written up yet.
- **Virtual environments** — a note is sitting in `Library/sources/inbox/`, not yet compiled into a page.
- **Generators, `yield`** — untouched.

## Related

- **[[git-moc]]** — version control for the code written here

## Sources

- **[[2026-09-28-python-notes-comprehensions-and-defaults]]** — original in the vault (own note + debugging context) · our summary: [[source-python-notes-comprehensions-and-defaults]]
