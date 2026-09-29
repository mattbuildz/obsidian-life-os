#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validator for note connections in an Obsidian vault.

Usage:
    python3 validate.py <folder>          # check a folder
    python3 validate.py <folder> --fix    # fix block IDs that don't end their line
    (Windows: `py` instead of `python3`)

Checks:
  1. dead block references  [[note#^id]]  -> the note or block doesn't exist
  2. dead wikilinks          [[note]]      -> the file doesn't exist anywhere in the vault
  3. a block ID in the middle of a line (Obsidian will NOT recognize it)
  4. duplicate block IDs within one file
  5. anchors with no references (informational, not an error)
"""

import os
import re
import sys
import glob
from pathlib import Path

# Vault root computed from this file's own path, not hardcoded — same pattern
# as the Library's lint.py. Reason: this script ships in a public repo, and a
# path hardcoded to one person's machine won't work for anyone else who clones it.
# The file lives at <vault>/.claude/skills/link-notes/validate.py, i.e. four
# levels below the vault root. `resolve()` follows symlinks, so this also
# works when the script is reached through `.agents/skills/`.
# Override with an environment variable for an unusual layout.
VAULT = os.environ.get("OBSIDIAN_VAULT") or str(Path(__file__).resolve().parents[3])

RE_BLOCK_END = re.compile(r"\^([a-z][a-z0-9-]*)\s*$")
# block ID in the middle of a line: ^word followed by more text
RE_BLOCK_MID = re.compile(r"\^([a-z][a-z0-9-]*)\s+\S")
RE_REF_BLOCK = re.compile(r"!?\[\[([^\]#|]+)#\^([a-z0-9-]+)")
RE_WIKILINK = re.compile(r"!?\[\[([^\]#|]+?)(?:[#|][^\]]*)?\]\]")


def collect_vault_notes():
    """Note and attachment names across the whole vault (for wikilink validation)."""
    names = set()
    for p in glob.glob(os.path.join(VAULT, "**", "*"), recursive=True):
        q = p.replace(os.sep, "/")   # glob returns backslashes on Windows
        if "/.obsidian/" in q or "/.claude/" in q or os.path.isdir(p):
            continue
        base = os.path.basename(p)
        names.add(base[:-3] if base.endswith(".md") else base)
    return names


def strip_code_blocks(txt):
    """Strip ``` blocks and inline code — syntax examples in documentation
    aren't real links and shouldn't trigger false positives."""
    txt = re.sub(r"```.*?```", "", txt, flags=re.S)
    return re.sub(r"`[^`\n]*`", "", txt)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # "—" etc. crash a cp1252 pipe
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    target = sys.argv[1]
    do_fix = "--fix" in sys.argv

    files = sorted(glob.glob(os.path.join(target, "**", "*.md"), recursive=True))
    if not files:
        print("No .md files found in:", target)
        sys.exit(1)

    # names from the whole vault + from the target folder (in case it's outside the vault)
    vault_notes = collect_vault_notes()
    vault_notes |= {os.path.basename(p)[:-3] for p in files}
    defined = {}
    refs = []
    links = []
    problems = []

    for p in files:
        name = os.path.basename(p)[:-3]
        with open(p, encoding="utf-8") as f:
            lines = f.read().split("\n")

        ids, seen = set(), {}
        fixed_any = False

        for i, line in enumerate(lines):
            m_end = RE_BLOCK_END.search(line)
            if m_end:
                bid = m_end.group(1)
                if bid in seen:
                    problems.append("DUPLICATE block ID '%s' in %s (lines %d and %d)"
                                    % (bid, name, seen[bid] + 1, i + 1))
                seen[bid] = i
                ids.add(bid)
            else:
                m_mid = RE_BLOCK_MID.search(line)
                # ignore [[x#^id]] links and embeds - there the ^ is part of the reference
                if m_mid and "[[" not in line:
                    bid = m_mid.group(1)
                    if do_fix:
                        lines[i] = re.sub(r"\s*\^" + re.escape(bid) + r"\s+", " ", line).rstrip() \
                                   + " ^" + bid
                        fixed_any = True
                        ids.add(bid)
                    else:
                        problems.append("BLOCK ID MID-LINE: %s:%d  ^%s  (Obsidian will not recognize it)"
                                        % (name, i + 1, bid))

        if fixed_any:
            with open(p, "w", encoding="utf-8", newline="\n") as f:   # LF on Windows too
                f.write("\n".join(lines))
            print("FIXED block ID in:", name)

        defined[name] = ids
        txt = strip_code_blocks("\n".join(lines))
        for m in RE_REF_BLOCK.finditer(txt):
            refs.append((name, m.group(1).strip(), m.group(2)))
        for m in RE_WIKILINK.finditer(txt):
            links.append((name, m.group(1).strip()))

    # 1. dead block references
    for src, tgt, bid in refs:
        if tgt not in defined and tgt not in vault_notes:
            problems.append("DEAD REFERENCE (note not found): %s -> [[%s#^%s]]" % (src, tgt, bid))
        elif tgt in defined and bid not in defined[tgt]:
            problems.append("DEAD BLOCK: %s -> [[%s#^%s]]" % (src, tgt, bid))

    # 2. dead wikilinks (a link may include a path: [[folder/note]])
    for src, tgt in links:
        short = os.path.basename(tgt)
        if tgt not in vault_notes and short not in vault_notes:
            problems.append("DEAD WIKILINK: %s -> [[%s]]" % (src, tgt))

    # report
    print("\n" + "=" * 60)
    print("Files: %d | block IDs: %d | block references: %d | wikilinks: %d"
          % (len(files), sum(len(v) for v in defined.values()), len(refs), len(links)))
    print("=" * 60)

    if problems:
        print("\nPROBLEMS (%d):" % len(problems))
        for x in problems:
            print("  !!", x)
    else:
        print("\nOK — all connections are valid.")

    used = {(t, b) for _, t, b in refs}
    orphan = [(k, b) for k, s in defined.items() for b in s if (k, b) not in used]
    if orphan:
        print("\nAnchors with no references (%d) — not an error, spare capacity for later:" % len(orphan))
        for k, b in sorted(orphan)[:15]:
            print("   %s#^%s" % (k, b))
        if len(orphan) > 15:
            print("   ... and %d more" % (len(orphan) - 15))

    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
