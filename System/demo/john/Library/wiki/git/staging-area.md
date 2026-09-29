---
kind: concept
id: staging-area
alias: [git add, index, staged and modified at once]
status: active
sources:
  - "[[source-git-notes-staging-and-gitignore]]"
originals:
  - "[[2026-09-29-git-notes-staging-and-gitignore]]"
source-count: 1
last-ingest: 2026-10-01
source-hash: cd6994
---

# The staging area is a snapshot, not a pointer

> **TL;DR:** `git add file.py` copies the file's content into the staging area **at that moment**. It is not a live link that follows further edits — edit the file again after `git add` and the staging area still holds the old snapshot.

## The sequence that looks broken but isn't

```
edit file.py
git add file.py       # snapshot taken HERE
edit file.py again    # more changes — staging area does NOT see these
git commit -m "..."   # commits the FIRST snapshot only
```

After this, `git status` shows `file.py` as **both** staged (the first edit) and modified (the second edit) — the same filename appearing in two different states at once. That's not a bug or a git quirk: it's two genuinely different copies of the file's content existing at the same time, one in the index, one on disk.

## Why this happens

`git add` takes a snapshot, full stop. It doesn't register the file path for future automatic inclusion — it captures content, right now, and stores it in the index. Whatever the working directory does afterward is a separate story until the next `git add`.

## The practical fix

Run `git add file.py` again before committing, any time you keep editing a file after staging it. There's no way to make staging "follow" edits automatically — re-staging is the only mechanism.

## Related

- **[[git-moc]]** — folder map: staging sits right before commit-message conventions in the day-to-day loop

## Sources

- **[[2026-09-29-git-notes-staging-and-gitignore]]** — original in the vault (own note from a group-chat explanation) · our summary: [[source-git-notes-staging-and-gitignore]]
