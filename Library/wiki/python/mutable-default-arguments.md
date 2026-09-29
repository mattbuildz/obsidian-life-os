---
kind: concept
id: mutable-default-arguments
alias: [mutable default argument, default argument trap, None sentinel]
status: active
sources:
  - "[[source-python-notes-comprehensions-and-defaults]]"
originals:
  - "[[2026-09-28-python-notes-comprehensions-and-defaults]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: 6cf9d8
---

# Mutable default arguments

> **TL;DR:** a default argument like `bucket=[]` is created **once**, when the function is defined — not once per call. Every call that doesn't pass `bucket` explicitly reuses the *same* list object, so calls silently pile up into one shared list.

## The bug, as it actually happened

```python
def add_expense(item, bucket=[]):
    bucket.append(item)
    return bucket
```

Calling `add_expense("coffee")` twice, in two places that each expected a fresh one-item list, produced one shared two-item list instead. Nothing raised an error — the function "worked," it just silently shared state between unrelated calls.

## Why it happens

Python evaluates default argument values **once**, at `def` time, not at call time. `bucket=[]` builds exactly one list object and attaches it to the function itself. Every call that omits `bucket` gets a reference to that same object — so `.append()` on one call is visible on the next.

This is the same aliasing rule that makes shared mutable state surprising everywhere else in Python: no new object is created just because a function "looks like" it should get a clean one per call.

## The fix: `None` as a sentinel

```python
def add_expense(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket
```

`None` is immutable, so reusing it across calls is harmless — no shared state to alias. The real, fresh list is only created **inside the function body**, which runs on every call.

**Applies to any mutable default**, not just lists — `dict()`, `set()`, and default arguments that are instances of your own mutable classes all have the identical trap.

## Related

- **[[python-moc]]** — folder map: where this fits next to comprehensions

## Sources

- **[[2026-09-28-python-notes-comprehensions-and-defaults]]** — original in the vault (own note + debugging context) · our summary: [[source-python-notes-comprehensions-and-defaults]]
