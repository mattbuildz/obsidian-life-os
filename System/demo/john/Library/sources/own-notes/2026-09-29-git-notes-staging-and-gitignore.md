---
source-type: note
topics: [git]
date: 2026-09-29
---

# quick notes — staging area and .gitignore

asked in the group chat why `git add` seemed to "not work" for a teammate, wrote up what I found out.

## the staging area is a snapshot, not a pointer

`git add file.py` copies the CURRENT content of `file.py` into the staging area (also called the index). It is not a link that follows future edits.

so this sequence surprised me:

```
edit file.py
git add file.py       # snapshot taken HERE
edit file.py again     # more changes, staging area does NOT see these
git commit -m "..."    # commits the FIRST snapshot only
```

`git status` after that shows `file.py` as **both** staged (the first edit) and modified (the second edit) — same filename in two states at once, because the staging area is genuinely a separate copy, not a reference.

practical fix: `git add file.py` again before committing, if you keep editing after staging.

## .gitignore only affects untracked files

second thing that confused the teammate: they added a `*.log` line to `.gitignore`, but `debug.log` kept showing up in `git status`.

`.gitignore` only stops git from **starting** to track a file. If the file is already tracked (already committed at least once), `.gitignore` has no effect on it going forward — git keeps watching it.

fix is a separate command, `git rm --cached debug.log`. That untracks the file **without deleting it from disk** (`--cached` = staging area only), and from then on `.gitignore` actually works on it.

so `.gitignore` is an input filter, not an on/off switch for files already inside the repo.
