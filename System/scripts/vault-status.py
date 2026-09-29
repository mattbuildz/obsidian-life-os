#!/usr/bin/env python3
"""Facts about the vault, computed by code instead of eyeballed by a model.

    python3 System/scripts/vault-status.py               # print the checks
    python3 System/scripts/vault-status.py --write       # ...and save System/status.json
    python3 System/scripts/vault-status.py --json        # print JSON instead
    python3 System/scripts/vault-status.py --record weekly   # note that /weekly ran today

On Windows use `py` instead of `python3`.

Two consumers, one implementation:
  - `/weekly` runs it at the start (and `--record weekly` at the end);
  - the Life OS Hub Status tab shows System/status.json, and its Refresh
    button runs this script with --write (desktop only).

Read-only apart from the two generated files, System/status.json and
System/runs.json (both git-ignored). Thresholds live in THRESHOLDS below.
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATUS = ROOT / "System" / "status.json"
RUNS = ROOT / "System" / "runs.json"
MARKER = ROOT / "System" / "demo" / ".demo-active"
TODAY = dt.date.today()

THRESHOLDS = {
    "avatar_days": 90,          # avatar older than this: offer an update
    "weekly_days": 9,           # no /weekly for this long: due
    "evening_days": 2,          # no evening entry in Patterns for this long
    "untriaged_tasks": 10,      # tasks waiting in INBOX "New / untriaged"
    "library_queue": 10,        # clips waiting in Library/sources/inbox
    "library_ingest_days": 14,  # ...and no ingest for this long
}

DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


def frontmatter(text):
    out = {}
    if text and text.startswith("---"):
        for line in text.split("\n")[1:]:
            if line.strip() == "---":
                break
            if ":" in line:
                k, v = line.split(":", 1)
                out[k.strip()] = v.strip().strip("\"'")
    return out


def parse_date(s):
    try:
        return dt.date.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def ago(d):
    n = (TODAY - d).days
    if n < 0:
        return f"dated {d.isoformat()} (in the future)"
    return "today" if n == 0 else "yesterday" if n == 1 else f"{n} days ago"


def check(cid, label, value, detail="", level="ok"):
    return {"id": cid, "label": label, "value": value, "detail": detail, "level": level}


# ---- checks -----------------------------------------------------------------

def check_avatar():
    text = read(ROOT / "Life" / "roadmap" / "avatar.md")
    if text is None:
        return check("avatar", "Avatar", "not created", "Run /avatar — a 20–25 minute interview.", "info")
    fm = frontmatter(text)
    updated = parse_date(fm.get("updated"))
    status = fm.get("status", "?")
    if updated is None:
        return check("avatar", "Avatar", f"status: {status}", "No `updated:` date in avatar.md.", "warn")
    age = (TODAY - updated).days
    if status != "complete":
        return check("avatar", "Avatar", f"draft, last saved {ago(updated)}", "Finish it with /avatar.", "warn")
    if age > THRESHOLDS["avatar_days"]:
        return check("avatar", "Avatar", f"updated {age} days ago",
                     f"Older than {THRESHOLDS['avatar_days']} days — /avatar updates it in a few minutes.", "warn")
    return check("avatar", "Avatar", f"updated {ago(updated)}", "", "ok")


def runs():
    try:
        return json.loads(read(RUNS) or "{}")
    except ValueError:
        return {}


def check_weekly():
    last = parse_date(runs().get("weekly"))
    if last is None:
        return check("weekly", "Last /weekly", "not recorded yet",
                     "/weekly records itself when it finishes.", "info")
    age = (TODAY - last).days
    if age > THRESHOLDS["weekly_days"]:
        return check("weekly", "Last /weekly", ago(last), f"Due — more than {THRESHOLDS['weekly_days']} days.", "warn")
    return check("weekly", "Last /weekly", ago(last))


def check_evening():
    text = read(ROOT / "Life" / "Patterns" / "observation-log.md")
    days = sorted({parse_date(m[1]) for m in re.finditer(r"^## (\d{4}-\d{2}-\d{2})", text or "", re.M)} - {None})
    if not days:
        return check("evening", "Last Patterns entry", "none yet", "/morning and /evening write one a day.", "info")
    last = days[-1]
    if (TODAY - last).days > THRESHOLDS["evening_days"]:
        return check("evening", "Last Patterns entry", ago(last), "The daily loop has a gap.", "warn")
    return check("evening", "Last Patterns entry", ago(last))


def check_inbox():
    text = read(ROOT / "Life" / "INBOX.md") or ""
    total = len(re.findall(r"^\s*- \[ \]", text, re.M))
    m = re.search(r"^### New / untriaged\s*\n(.*?)(?=^#{2,3} |\Z)", text, re.M | re.S)
    untriaged = len(re.findall(r"^\s*- \[ \]", m[1], re.M)) if m else 0
    level = "warn" if untriaged > THRESHOLDS["untriaged_tasks"] else "ok"
    return check("inbox", "INBOX", f"{total} open, {untriaged} untriaged",
                 "Triage is due." if level == "warn" else "", level)


def check_library():
    inbox = ROOT / "Library" / "sources" / "inbox"
    queue = len(list(inbox.glob("*.md"))) if inbox.exists() else 0
    log = read(ROOT / "Library" / "log.md") or ""
    ingests = sorted({parse_date(m[1]) for m in re.finditer(r"^## \[(\d{4}-\d{2}-\d{2})\] ingest", log, re.M)} - {None})
    last = ingests[-1] if ingests else None
    since = f"last ingest {ago(last)}" if last else "no ingest yet"
    stalled = queue > THRESHOLDS["library_queue"] and (last is None or (TODAY - last).days > THRESHOLDS["library_ingest_days"])
    return check("library", "Library queue", f"{queue} waiting, {since}",
                 "The queue grows and nothing is ingested — see /weekly step 2b." if stalled else "",
                 "warn" if stalled else "ok")


def check_phase():
    text = read(ROOT / "Life" / "roadmap" / "roadmap-brief.md")
    if text is None or frontmatter(text).get("status") in (None, "stub"):
        return check("phase", "Roadmap phase", "no brief yet", "Run /avatar, then /roadmap.", "info")
    m = re.search(r"^## 3\. Phases\s*\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")]
            for ln in (m[1] if m else "").splitlines() if ln.strip().startswith("|")]
    if len(rows) < 2:
        return check("phase", "Roadmap phase", "no phases in the brief", "Run /roadmap.", "warn")
    head = [h.lower() for h in rows[0]]
    if "status" not in head or "target date" not in head:
        return check("phase", "Roadmap phase", "brief has no target dates", "Run /roadmap to review it.", "warn")
    si, di, gi = head.index("status"), head.index("target date"), 1
    active = [r for r in rows[2:] if len(r) > max(si, di) and r[si].lower() == "active"]
    if not active:
        return check("phase", "Roadmap phase", "no active phase", "Run /roadmap to open the next one.", "warn")
    r = active[0]
    name = f"{r[0]}: {r[gi]}" if len(r) > gi else r[0]
    end = parse_date(r[di])
    if end is None:
        return check("phase", "Roadmap phase", f"{name} — no target date", "", "info")
    left = (end - TODAY).days
    if left < 0:
        return check("phase", "Roadmap phase", f"{name} — {-left} days past its target date",
                     "Run /roadmap to review the definition of done.", "warn")
    return check("phase", "Roadmap phase", f"{name} — {left} days to its target date")


def check_demo():
    if not MARKER.exists():
        return check("demo", "Sample data (John)", "cleared")
    parts = [ln.strip() for ln in (read(MARKER) or "").splitlines() if ln.strip() in ("life", "library")]
    return check("demo", "Sample data (John)", "still here: " + (", ".join(parts) or "yes"),
                 "/avatar offers to clear it.", "info")


def collect():
    checks = [check_avatar(), check_phase(), check_weekly(), check_evening(), check_inbox(), check_library(), check_demo()]
    return {"generated": dt.datetime.now().isoformat(timespec="seconds"), "date": TODAY.isoformat(), "checks": checks}


# ---- main -------------------------------------------------------------------

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Facts about the vault, computed by code.")
    ap.add_argument("--json", action="store_true", help="print JSON instead of text")
    ap.add_argument("--write", action="store_true", help="also save System/status.json")
    ap.add_argument("--record", metavar="NAME", help="note that NAME (e.g. weekly) ran today, then exit")
    args = ap.parse_args()

    if args.record:
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,30}", args.record):
            sys.exit("--record takes a short lowercase name, e.g. weekly")
        data = runs()
        data[args.record] = TODAY.isoformat()
        RUNS.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Recorded: {args.record} ran on {TODAY.isoformat()}.")
        return

    report = collect()
    if args.write:
        STATUS.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return
    mark = {"ok": "ok  ", "warn": "WARN", "info": "info"}
    for c in report["checks"]:
        line = f"[{mark[c['level']]}] {c['label']}: {c['value']}"
        print(line + (f" — {c['detail']}" if c["detail"] else ""))
    if args.write:
        print("\nSaved System/status.json.")


if __name__ == "__main__":
    main()
