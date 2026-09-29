#!/usr/bin/env python3
"""Clear John's demo data out of the vault, or put it back.

    python3 System/demo/demo.py clear                 # dry run: prints the plan
    python3 System/demo/demo.py clear --apply         # do it
    python3 System/demo/demo.py clear --apply --keep-library
    python3 System/demo/demo.py restore               # dry run
    python3 System/demo/demo.py restore --apply       # add whatever of John is missing

On Windows use `py` instead of `python3`. Every command is a dry run until
you add --apply. `clear` is what the `avatar` skill runs, after asking you.

The source of truth is `System/demo/john/`: a frozen copy of John's files at
the paths they live at in the vault. `stubs/` holds the empty versions of
the files the plugins and commands need to exist (INBOX, roadmap brief, ...).

clear
  - Moves John's files to the system trash. Nothing is deleted for good.
  - Touches only files that are still John's: a file must match the snapshot
    (content hash with dates masked, so it survives `shift-demo-week.py`).
    A changed file is left alone and reported: your journal entries and your
    own notes are never removed because they sit in John's folder.
  - "Reset" files (INBOX, brief, Patterns, ...) become the empty stubs. One
    you have edited is kept unless you pass --reset-edited.
  - Updates System/demo/.demo-active, the marker the avatar skill looks for: it
    lists which parts of John (`life`, `library`) are still in the vault, and
    disappears when none is. `clear --keep-library` leaves `library` in it, so
    a later plain `clear` can still remove the Library sample.
  - Files that .gitignore covers but git still tracks (INBOX.md, a journal
    note you edited) are dropped from the git index - they stay on disk - so
    your own words are not committed by accident.

restore
  - Additive only: writes the John files that are missing, never overwrites
    anything, and does nothing when John is complete. Delete one John file,
    and only that one comes back.
  - Dates are aligned to what is already there (a John shifted by
    `shift-demo-week.py` gets its missing file in the same week); with no John
    left at all he lands in the current week.
  - An empty stub is replaced by John's version only with --replace-stubs; a
    file you have edited is never replaced.
  - Refuses when `avatar.md` exists (the vault is already yours): --mix
    overrides that.

build (maintainer)
  - Rebuilds `john/` from the git-tracked demo files. Run it from an unshifted
    checkout whenever the demo content changes.
"""
import argparse
import collections
import datetime as dt
import hashlib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "System" / "demo"
MARKER = DEMO / ".demo-active"
JOHN = DEMO / "john"
STUBS = DEMO / "stubs"
AVATAR = ROOT / "Life" / "roadmap" / "avatar.md"

MARKER_HEADER = ("# John's demo data is in this vault. Lines below say which part:\n"
                 "# `life` and/or `library`. `demo.py clear` (or the /avatar skill) removes them.\n")

DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
TEXT_EXT = {".md", ".base", ".txt"}

# Which git-tracked files `build` copies into john/.
DEMO_GLOBS = [
    "Life/Calendar/*.md", "Life/Journal/*.md", "Life/Notes/*.md",
    "Library/books/**/*", "Library/explanations/*.md",
    "Library/sources/articles/**/*", "Library/sources/inbox/**/*",
    "Library/sources/own-notes/**/*", "Library/wiki/**/*",
]
KEEP = {"Life/Calendar/_README-format.md", "Library/books/books.base"}

# Folders the plugins and commands expect to exist - never removed, even empty.
PROTECTED_DIRS = {
    "Life/Calendar", "Life/Journal", "Life/Notes",
    "Library/books", "Library/explanations", "Library/wiki", "Library/workshops",
    "Library/sources", "Library/sources/articles", "Library/sources/inbox",
    "Library/sources/own-notes",
}


# ---- helpers ----------------------------------------------------------------

def scope_of(rel):
    return "life" if rel.startswith("Life/") else "library"


def mask(text):
    return DATE.sub("YYYY-MM-DD", text)


def in_shifted_area(rel):
    """The files shift-demo-week.py moves: Life/ and Library/books/. Wiki and
    sources are left alone there on purpose (pages carry source hashes)."""
    return rel.startswith("Life/") or rel.startswith("Library/books/")


def shift(text, delta):
    def repl(m):
        try:
            d = dt.date.fromisoformat(m[0])
        except ValueError:
            return m[0]
        return (d + delta).isoformat()
    return DATE.sub(repl, text)


def is_text(rel):
    return Path(rel).suffix.lower() in TEXT_EXT


def hash_bytes(data, rel):
    if is_text(rel):
        text = data.replace(b"\r\n", b"\n").decode("utf-8", errors="replace")
        data = mask(text).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def hash_file(path, rel):
    return hash_bytes(path.read_bytes(), rel)


def marker_scopes():
    """Which parts of John are (still) in the vault, from the marker file."""
    if not MARKER.exists():
        return set()
    return {ln.strip() for ln in MARKER.read_text(encoding="utf-8").splitlines()
            if ln.strip() in ("life", "library")}


def write_marker(scopes):
    if scopes:
        MARKER.write_text(MARKER_HEADER + "".join(f"{s}\n" for s in sorted(scopes)), encoding="utf-8")
    elif MARKER.exists():
        MARKER.unlink()


def stub_text(rel):
    return (STUBS / rel).read_text(encoding="utf-8")


def stub_hash(rel):
    """Hash of a stub as it looks once written (placeholder -> any date)."""
    data = stub_text(rel).replace("{{today}}", "2000-01-01").encode("utf-8")
    return hash_bytes(data, rel)


def rel_files(base):
    for p in sorted(base.rglob("*")):
        if p.is_file() and p.name != ".DS_Store" and "__pycache__" not in p.parts:
            yield p, p.relative_to(base).as_posix()


def vault_files():
    for top in ("Life", "Library"):
        for p, rel in rel_files(ROOT / top):
            yield p, f"{top}/{rel}"


def snapshot():
    """John's files: {rel path: (kind, hash of the snapshot copy)}; kind is
    'reset' for files that have an empty stub, else 'demo'."""
    if not JOHN.exists():
        sys.exit("Missing System/demo/john/ - nothing to work from.")
    stubs = {rel for _, rel in rel_files(STUBS)}
    return {rel: ("reset" if rel in stubs else "demo", hash_file(p, rel))
            for p, rel in rel_files(JOHN)}


def snapshot_monday(snap):
    days = sorted(m[0] for rel in snap if rel.startswith("Life/Journal/")
                  for m in [DATE.search(rel)] if m)
    if not days:
        sys.exit("No dated notes in the John snapshot's Life/Journal/.")
    first = dt.date.fromisoformat(days[0])
    return first - dt.timedelta(days=first.weekday())


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return {n.decode("utf-8") for n in out.split(b"\0") if n}


def untrack_ignored():
    """`git rm --cached` files that .gitignore covers but git still tracks:
    what is left of John there (INBOX.md, a journal note you edited) would
    otherwise be committed with your own words in it. Stays on disk. Life/ only."""
    try:
        out = subprocess.run(["git", "ls-files", "-ci", "--exclude-standard", "-z"],
                             cwd=ROOT, capture_output=True, check=True).stdout
        todo = sorted(n.decode("utf-8") for n in out.split(b"\0") if n.startswith(b"Life/"))
        if todo:
            subprocess.run(["git", "rm", "--cached", "-q", "--"] + todo, cwd=ROOT, check=True)
            for rel in todo:
                print(f"  untracked (kept on disk, git-ignored): {rel}")
    except (OSError, subprocess.CalledProcessError):
        pass


# ---- trash ------------------------------------------------------------------

def _unique(dest):
    if not dest.exists():
        return dest
    n = 2
    while True:
        cand = dest.with_name(f"{dest.stem} {n}{dest.suffix}")
        if not cand.exists():
            return cand
        n += 1


def _recycle_windows(path):
    import ctypes
    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [("hwnd", wintypes.HWND), ("wFunc", wintypes.UINT),
                    ("pFrom", wintypes.LPCWSTR), ("pTo", wintypes.LPCWSTR),
                    ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", wintypes.BOOL),
                    ("hNameMappings", ctypes.c_void_p), ("lpszProgressTitle", wintypes.LPCWSTR)]

    op = SHFILEOPSTRUCTW()
    op.wFunc = 3                                   # FO_DELETE
    op.pFrom = str(path) + "\0\0"
    op.fFlags = 0x0040 | 0x0010 | 0x0004 | 0x0400  # ALLOWUNDO | NOCONFIRMATION | SILENT | NOERRORUI
    if ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op)) or op.fAnyOperationsAborted:
        raise OSError("could not move to the Recycle Bin")


def to_trash(path):
    """Move to the system trash. Never deletes for good: if no trash is
    reachable this raises, and the run stops."""
    try:
        from send2trash import send2trash
        send2trash(str(path))
        return
    except ImportError:
        pass
    if sys.platform == "darwin":
        shutil.move(str(path), str(_unique(Path.home() / ".Trash" / path.name)))
    elif sys.platform.startswith("win"):
        _recycle_windows(path)
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "Trash"
        (base / "files").mkdir(parents=True, exist_ok=True)
        (base / "info").mkdir(parents=True, exist_ok=True)
        dest = _unique(base / "files" / path.name)
        (base / "info" / (dest.name + ".trashinfo")).write_text(
            f"[Trash Info]\nPath={path}\nDeletionDate={dt.datetime.now():%Y-%m-%dT%H:%M:%S}\n",
            encoding="utf-8")
        shutil.move(str(path), str(dest))


def prune_empty_dirs(path):
    """Remove now-empty parent folders, up to the folders the vault needs."""
    parent = path.parent
    while parent != ROOT:
        rel = parent.relative_to(ROOT).as_posix()
        if rel in PROTECTED_DIRS or any(parent.iterdir()):
            return
        parent.rmdir()
        parent = parent.parent


def write_text_lf(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))   # LF, not CRLF, on Windows


# ---- build ------------------------------------------------------------------

def cmd_build(args):
    tracked = tracked_files()
    stubs = {rel for _, rel in rel_files(STUBS)}
    chosen = set()
    for pattern in DEMO_GLOBS:
        for p in ROOT.glob(pattern):
            rel = p.relative_to(ROOT).as_posix()
            if p.is_file() and rel in tracked and rel not in KEEP:
                chosen.add(rel)
    for rel in sorted(stubs):
        if rel in tracked:
            chosen.add(rel)
        else:
            print(f"  ! stub {rel} has no tracked file in the vault - skipped")
    if JOHN.exists():
        shutil.rmtree(JOHN)
    for rel in sorted(chosen):
        dest = JOHN / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, dest)
    print(f"Rebuilt System/demo/john/: {len(chosen)} files.")


# ---- clear ------------------------------------------------------------------

def cmd_clear(args):
    requested = {"life"} if args.keep_library else {"life", "library"}
    scopes = requested & marker_scopes()
    if not scopes:
        print("Nothing to clear: the marker System/demo/.demo-active does not list "
              + " or ".join(sorted(requested)) + ".")
        return
    snap = snapshot()
    delete_keys = {(mask(rel), h) for rel, (k, h) in snap.items()
                   if k == "demo" and scope_of(rel) in scopes}
    reset_hash = {rel: h for rel, (k, h) in snap.items()
                  if k == "reset" and scope_of(rel) in scopes}
    delete_paths = {p for p, _ in delete_keys}

    trash, resets, skipped = [], [], []
    for p, rel in vault_files():
        npath = mask(rel)
        if rel in reset_hash:
            if hash_file(p, rel) == reset_hash[rel] or args.reset_edited:
                resets.append((p, rel))
            elif hash_file(p, rel) != stub_hash(rel):
                skipped.append((rel, "edited since the demo - kept (--reset-edited replaces it)"))
        elif npath in delete_paths:
            if (npath, hash_file(p, rel)) in delete_keys:
                trash.append((p, rel))
            else:
                skipped.append((rel, "changed since the demo - left alone"))

    for _, rel in trash:
        print(f"  trash  {rel}")
    for _, rel in resets:
        print(f"  reset  {rel}")
    for rel, why in skipped:
        print(f"  skip   {rel}  ({why})")
    for sc in ("life", "library"):
        if sc in scopes:
            print(f"\n{sc.capitalize()}: "
                  f"{sum(scope_of(r) == sc for _, r in trash)} to trash, "
                  f"{sum(scope_of(r) == sc for _, r in resets)} to reset, "
                  f"{sum(scope_of(r) == sc for r, _ in skipped)} left alone.", end="")
    print(f"\nTotal: {len(trash)} to trash, {len(resets)} to reset, {len(skipped)} left alone"
          f"{' (Library kept)' if args.keep_library else ''}.")
    if not args.apply:
        print("(dry run - nothing changed. Add --apply to do it.)")
        return

    today = dt.date.today().isoformat()
    for p, rel in trash:
        to_trash(p)
        prune_empty_dirs(p)
    for p, rel in resets:
        to_trash(p)
        write_text_lf(p, stub_text(rel).replace("{{today}}", today))
    write_marker(marker_scopes() - scopes)
    untrack_ignored()
    print("\nDone. The files are in your system trash (a dropped file can be put back from there).")


# ---- restore ----------------------------------------------------------------

def find_delta(snap, by_mask):
    """Whole-week offset between the snapshot's dates and the John that is
    already in the vault (None if no dated John file is there)."""
    votes = collections.Counter()
    for rel in snap:
        if not in_shifted_area(rel) or not DATE.search(rel):
            continue
        d0 = dt.date.fromisoformat(DATE.search(rel)[0])
        for other in by_mask.get(mask(rel), ()):
            delta = dt.date.fromisoformat(DATE.search(other)[0]) - d0
            if delta.days % 7 == 0:
                votes[delta] += 1
    return votes.most_common(1)[0][0] if votes else None


def cmd_restore(args):
    if AVATAR.exists() and not args.mix:
        sys.exit("Life/roadmap/avatar.md exists - this vault is already yours, and John would mix in.\n"
                 "Add --mix if you really want him back next to your data.")
    snap = snapshot()
    scopes = {"life"} if args.keep_library else {"life", "library"}

    have, by_mask = set(), collections.defaultdict(list)
    for p, rel in vault_files():
        have.add((mask(rel), hash_file(p, rel)))
        by_mask[mask(rel)].append(rel)

    delta = find_delta(snap, by_mask)
    if delta is None:
        today = dt.date.today()
        delta = (today - dt.timedelta(days=today.weekday())) - snapshot_monday(snap)
    print(f"Dates: {delta.days // 7:+d} week(s) from the snapshot.\n")

    create, replace, skipped, present = [], [], [], 0
    for rel, (kind, h) in sorted(snap.items()):
        if scope_of(rel) not in scopes:
            continue
        target = shift(rel, delta) if in_shifted_area(rel) else rel
        text = None
        if is_text(rel):
            raw = (JOHN / rel).read_bytes().replace(b"\r\n", b"\n").decode("utf-8")
            text = shift(raw, delta) if in_shifted_area(rel) else raw
        exists = (ROOT / target).exists()
        if (mask(target), h) in have:
            present += 1                      # John's element is there (same content)
        elif not exists:
            create.append((rel, target, text))
        elif kind == "reset" and args.replace_stubs and hash_file(ROOT / target, target) == stub_hash(rel):
            replace.append((rel, target, text))
        elif kind == "reset":
            state = "empty stub" if hash_file(ROOT / target, target) == stub_hash(rel) else "yours"
            skipped.append((target, f"exists ({state}) - kept" +
                            ("; --replace-stubs swaps an empty stub" if state == "empty stub" else "")))
        else:
            skipped.append((target, "a different file has this name - kept"))

    for _, target, _ in create:
        print(f"  create   {target}")
    for _, target, _ in replace:
        print(f"  replace  {target}  (empty stub -> John's, stub goes to the trash)")
    for target, why in skipped:
        print(f"  skip     {target}  ({why})")
    print(f"\n{len(create)} to create, {len(replace)} to replace, {present} already there, {len(skipped)} skipped.")
    if not create and not replace:
        print("Nothing to restore.")
        return
    if not args.apply:
        print("(dry run - nothing changed. Add --apply to do it.)")
        return

    for rel, target, text in create + replace:
        dest = ROOT / target
        if dest.exists():
            to_trash(dest)
        if text is not None:
            write_text_lf(dest, text)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(JOHN / rel, dest)
    write_marker(marker_scopes() | {scope_of(t) for _, t, _ in create + replace})
    print("\nDone. John is (back) in the vault; `python3 System/demo/demo.py clear` removes him again.")


# ---- main -------------------------------------------------------------------

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # file names with "—" on a Windows pipe
    ap = argparse.ArgumentParser(description="Clear John's demo data from the vault, or put it back.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("clear", help="move John's files to the system trash")
    c.add_argument("--apply", action="store_true", help="do it (default: dry run)")
    c.add_argument("--keep-library", action="store_true", help="leave the demo Library alone")
    c.add_argument("--reset-edited", action="store_true",
                   help="also reset INBOX, brief, Patterns... files you have edited since the demo")
    c.set_defaults(func=cmd_clear)

    r = sub.add_parser("restore", help="write back whatever of John is missing")
    r.add_argument("--apply", action="store_true", help="do it (default: dry run)")
    r.add_argument("--keep-library", action="store_true", help="skip the demo Library")
    r.add_argument("--replace-stubs", action="store_true",
                   help="swap an empty stub (INBOX, brief, ...) for John's version")
    r.add_argument("--mix", action="store_true", help="restore even though avatar.md exists")
    r.set_defaults(func=cmd_restore)

    b = sub.add_parser("build", help="maintainer: rebuild john/ from the tracked demo files")
    b.set_defaults(func=cmd_build)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
