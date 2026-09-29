#!/usr/bin/env python3
"""Move John's demo week to the current week.

The demo data describes one week (Mon 2026-10-05 -> Sun 2026-10-11). Command
Center always shows *today*, so on any other date the Overview looks empty.
This script shifts every date in Life/ and Library/books/ by a whole number of
weeks, so weekdays stay the same (Tuesday's missed minimum stays a Tuesday).

It rewrites file contents and renames files whose name starts with a date.
Library/wiki and Library/sources are left alone on purpose: their pages carry
hashes of the source files, and changing a date inside a source would make
lint mark the page stale.

Skips itself once the demo is cleared (`demo.py clear`, run by the `avatar`
skill removes System/demo/.demo-active).

Usage (from the repo root):
    python3 System/demo/shift-demo-week.py          # shift to this week
    python3 System/demo/shift-demo-week.py --dry    # only print what would change

Run it once after cloning. Running it again later shifts from wherever the
demo currently is (it reads the week from Life/Journal/).
"""
import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [ROOT / "Life", ROOT / "Library" / "books"]
DATE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")


def demo_monday():
    """Monday of the week the demo currently sits in (earliest journal day)."""
    days = sorted(p.stem for p in (ROOT / "Life" / "Journal").glob("*.md")
                  if DATE.fullmatch(p.stem))
    if not days:
        sys.exit("No dated notes in Life/Journal/ - nothing to shift.")
    first = dt.date.fromisoformat(days[0])
    return first - dt.timedelta(days=first.weekday())


def shift(text, delta):
    def repl(m):
        try:
            d = dt.date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return m[0]
        return (d + delta).isoformat()
    return DATE.sub(repl, text)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # file names with "—" on a Windows pipe
    dry = "--dry" in sys.argv
    if not (ROOT / "System" / "demo" / ".demo-active").exists():
        print("The demo is already cleared (no System/demo/.demo-active) - nothing to shift.")
        return
    today = dt.date.today()
    this_monday = today - dt.timedelta(days=today.weekday())
    delta = this_monday - demo_monday()
    if delta.days == 0:
        print("Demo week is already this week.")
        return
    print(f"Shifting by {delta.days // 7:+d} week(s) ({delta.days:+d} days)")

    for base in TARGETS:
        for p in sorted(base.rglob("*.md")):
            text = p.read_text(encoding="utf-8")
            new_text = shift(text, delta)
            new_name = shift(p.name, delta)
            if new_text != text:
                print(f"  edit   {p.relative_to(ROOT)}")
                if not dry:
                    p.write_bytes(new_text.encode("utf-8"))   # LF, not CRLF, on Windows
            if new_name != p.name:
                print(f"  rename {p.relative_to(ROOT)} -> {new_name}")
                if not dry:
                    p.rename(p.with_name(new_name))
    if dry:
        print("(dry run - nothing written)")


if __name__ == "__main__":
    main()
