---
source-type: note
topics: [python]
date: 2026-09-28
---

# quick notes — comprehensions and mutable defaults

stuff from tonight's Budget CLI session, writing it down before I forget why the bug happened

## list comprehensions

`[x for x in items]` is just a for-loop that builds a list, but faster and the intent is clearer at a glance. found out today it can also filter:

```python
big_expenses = [e for e in expenses if e["amount"] > 100]
```

that reads as "give me e for e in expenses, but only where amount > 100" — the `if` at the end is a filter, not a condition on the whole expression. tried putting the filter in the middle by accident and got a syntax error, order matters: `expression for item in iterable if condition`.

also there's a conditional *expression* version, different from the filter:

```python
label = ["big" if e["amount"] > 100 else "small" for e in expenses]
```

this one keeps every item, just changes what gets put in the list. easy to confuse with the filter version above — the `if/else` before `for` picks a value, the `if` after `for` drops items.

nested version for the CLI's category totals — flattening a dict of lists:

```python
all_tags = [tag for tags in expense["tags"] for tag in tags]
```

read left to right like nested for-loops: outer loop first (`for tags in expense["tags"]`), inner loop second (`for tag in tags`). took me three tries to get the order right, kept writing it backwards.

## mutable default arguments — the bug that ate my evening

this is the actual bug from tonight. simplified version of what I had:

```python
def add_expense(item, bucket=[]):
    bucket.append(item)
    return bucket
```

called `add_expense("coffee")` twice in two different tests, expected two separate one-item lists, got one two-item list instead. the default value `[]` is created **once**, when the function is defined, not once per call. every call that doesn't pass `bucket` explicitly reuses the *same* list object.

fix: use `None` as the sentinel and create the real default inside the function body.

```python
def add_expense(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket
```

now every call that doesn't pass `bucket` gets a fresh list. same trap applies to `dict()` and any other mutable default — not just lists.
