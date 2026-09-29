#!/usr/bin/env python3
"""Two automations guarding the Library. Run by .claude/settings.json.

    pre   PreToolUse   — blocks writes to sources/ (raw material is untouchable)
    post  PostToolUse  — checks the file JUST WRITTEN in wiki/

Why `post` checks one file instead of running the full lint: in the middle of
an ingest the base is legitimately inconsistent — a page exists but doesn't
have an INDEX entry yet, a link points to a page that will exist in a moment.
A full lint run would fire on every single write and teach the agent to
ignore it. So this only checks what has to be true IMMEDIATELY after a
single file is written. Cross-file checks (INDEX, MOCs, orphans, hashes)
stay in `lint.py`, run at the end of an ingest.

Exit code 2 = stop and show the agent the stderr text. 0 = allow.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Library"))


def stop(reason):
    print(reason, file=sys.stderr)
    sys.exit(2)


def path_from(event):
    tool_input = event.get("tool_input") or {}
    raw = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not raw:
        return None
    p = Path(raw)
    if not p.is_absolute():
        p = Path(event.get("cwd") or ROOT) / p
    return p


def relative(p):
    """Vault-relative path with forward slashes on every OS — on Windows
    str(Path) uses backslashes, and every "Library/..." check below would
    silently never match."""
    try:
        return p.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return None


# ---------------------------------------------------------------- pre --------

def pre(event, p):
    """Raw material is untouchable — this used to be a promise, now it's a wall."""
    rel = relative(p)
    if rel is None or not rel.startswith("Library/sources/"):
        return

    # /source and the Web Clipper create NEW files in inbox/ — that's the only entry point.
    parts = rel.split("/")
    new_in_inbox = (len(parts) > 2 and parts[2] == "inbox"
                    and event.get("tool_name") == "Write"
                    and not p.exists())
    if new_in_inbox:
        return

    stop(
        f"BLOCKED: {rel}\n"
        "Source content is immutable — every sentence in the wiki has to trace back to "
        "where it came from, and an editable original invalidates that trail.\n"
        "Allowed: create a NEW file in sources/inbox/, or move a file to the archive "
        "with `mv`. Changing content — never.\n"
        "(rule: Library/SCHEMA.md)"
    )


# --------------------------------------------------------------- post --------

def post(event, p):
    rel = relative(p)
    if rel is None:
        return

    if not rel.startswith("Library/wiki/") or p.suffix != ".md":
        return

    import lint  # noqa: E402  (imported here so the hook doesn't cost anything on other writes)

    fm, body = lint.read_frontmatter(p.read_text(encoding="utf-8"))
    kind = fm.get("kind", "")
    if kind in lint.SYSTEM_KINDS:
        return

    complaints = []
    if not fm:
        complaints.append("no frontmatter")
    if kind not in lint.KINDS:
        complaints.append(f"`kind: {kind or '—'}` outside the vocabulary ({', '.join(sorted(lint.KINDS))})")
    if fm.get("status", "") not in lint.STATUSES:
        complaints.append(f"`status: {fm.get('status') or '—'}` outside the vocabulary")
    if not fm.get("id"):
        complaints.append("missing `id`")
    sources = fm.get("sources", [])
    if not (sources if isinstance(sources, list) else [sources]):
        complaints.append("missing `sources:` — a page without a source is a hallucination by definition")

    lines = len(p.read_text(encoding="utf-8").splitlines())
    limit = (lint.LINE_LIMIT_PROCEDURE if kind == "procedure"
             else None if kind == "moc" else lint.LINE_LIMIT_PAGE)
    if limit and lines > limit:
        complaints.append(f"{lines} lines at a {limit}-line limit — "
                           + ("split it, there are two concepts in here" if kind != "procedure"
                              else "procedures don't get split, so shorten it"))

    if complaints:
        stop(f"{rel} — fix this now, not at the end of the ingest:\n"
             + "\n".join(f"  · {c}" for c in complaints))


# --------------------------------------------------------------- main --------

if __name__ == "__main__":
    # The agent sends UTF-8 and reads UTF-8 back. Windows would otherwise use
    # the ANSI code page (cp1250/cp1252): a path with a non-ASCII letter arrives garbled, or
    # the decode fails and the hook quietly lets everything through.
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    try:
        event = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)          # unknown input — don't get in the way

    file = path_from(event)
    if file is None:
        sys.exit(0)

    try:
        (pre if sys.argv[1:2] == ["pre"] else post)(event, file)
    except SystemExit:
        raise
    except Exception as e:                       # the hook never blocks work over its own bug
        print(f"[hook library] skipped: {e}", file=sys.stderr)
    sys.exit(0)
