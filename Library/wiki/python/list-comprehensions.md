---
kind: concept
id: list-comprehensions
alias: [comprehensions, list comprehension, filter vs conditional expression, nested comprehension]
status: active
sources:
  - "[[source-python-notes-comprehensions-and-defaults]]"
originals:
  - "[[2026-09-28-python-notes-comprehensions-and-defaults]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: 6cf9d8
---

# List comprehensions

> **TL;DR:** `[expression for item in iterable if condition]` is a for-loop that builds a list. The `if` at the end **filters** items out; an `if/else` placed before the `for` instead **picks a value** for every item. Confusing the two is the most common mistake.

## The two `if` forms are not the same thing

Filter — drops items that don't match:

```python
big_expenses = [e for e in expenses if e["amount"] > 100]
```

Reads as "give me `e` for `e` in `expenses`, but only where `amount` > 100." Every item that fails the check is left out of the result entirely.

Conditional expression — keeps every item, changes what gets stored:

```python
label = ["big" if e["amount"] > 100 else "small" for e in expenses]
```

The result has exactly as many items as `expenses`. The `if/else` decides *what value* goes in the list for each item, not *whether* the item is included.

**Rule of thumb:** `if` before `for` = value picker, keeps everything. `if` after `for` = filter, drops things. Putting the filter form in the middle of the expression is a syntax error — order is fixed: `expression for item in iterable if condition`.

## Nested comprehensions read like nested loops, left to right

```python
all_tags = [tag for tags in expense["tags"] for tag in tags]
```

This flattens a list of lists. Read the `for` clauses left to right as if they were nested loops written normally:

```python
all_tags = []
for tags in expense["tags"]:      # outer loop = first `for`
    for tag in tags:              # inner loop = second `for`
        all_tags.append(tag)
```

The outer loop is whichever `for` comes first in the comprehension, not whichever iterable "looks" outer. Writing it backwards is an easy mistake when the comprehension is first getting nested.

## Related

- **[[python-moc]]** — folder map: where this fits next to the mutable-default-argument pitfall

## Sources

- **[[2026-09-28-python-notes-comprehensions-and-defaults]]** — original in the vault (own note + debugging context) · our summary: [[source-python-notes-comprehensions-and-defaults]]
