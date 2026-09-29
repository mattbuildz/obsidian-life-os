#!/usr/bin/env python3
"""
lint.py — mechanical health check for the Library.

Zero LLM. Everything here is something a model does badly and expensively:
counting, hash comparison, string matching. The agent is meant to run this,
not do it by hand.

Usage:
    python3 Library/lint.py              # report
    python3 Library/lint.py --fix        # + set status: stale where the hash drifted
    python3 Library/lint.py --links      # + suggested cross-links (mechanical, by alias/id)
    python3 Library/lint.py --recompute  # stamp source-hash onto pages

On Windows use `py` instead of `python3` (there `python3` is a Store stub).

Exit code: 0 = clean, 1 = there are problems.
"""

import argparse
import hashlib
import re
import sys
from collections import defaultdict
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent
LIBRARY = VAULT / "Library"
WIKI = LIBRARY / "wiki"
INDEX = LIBRARY / "INDEX.md"

LINE_LIMIT_PAGE = 120
# `procedure` breaks a mechanism down step by step — cutting it in half is
# exactly the mistake behind an earlier failed test. Limit is higher, not gone.
LINE_LIMIT_PROCEDURE = 250
LINE_LIMIT_INDEX = 300
CHAR_LIMIT_ENTRY = 150
KINDS = {"source", "concept", "entity", "procedure", "moc"}
# System files that live in wiki/ but aren't pages — not subject to the
# checks (no sources, not in the index, nobody links to them)
SYSTEM_KINDS = {"catalog", "hot", "schema"}
STATUSES = {"draft", "active", "stale", "disputed", "archived"}
# A MOC ends with a fixed tail: gaps -> related -> sources. A link to a page
# from the FOLDER has to appear BEFORE the tail, i.e. in some content section.
# This is the mechanical guard against a blind append at the bottom of the file.
TAIL_SECTIONS = ("## What's not here yet", "## Related", "## Sources")
GAPS_SECTION = "## What's not here yet"
# junk-drawer section: exactly what a MOC degrades into when the agent can't
# be bothered to find the right place. The name should say what question the
# group of pages answers.
JUNK_DRAWER = {"other", "misc", "miscellaneous", "various", "rest", "etc"}

WIKILINK = re.compile(r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")


# --------------------------------------------------------------------------
# Frontmatter parsing — a subset of YAML, whatever SCHEMA.md actually uses.
# Deliberately without pyyaml: the script should run with nothing to install.
# --------------------------------------------------------------------------

def read_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end]
    rest = text[end + 4:]

    data, list_key = {}, None
    for line in block.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith(("  - ", "- ")) and list_key:
            data[list_key].append(line.split("- ", 1)[1].strip().strip("\"'"))
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if not value:
            data[key] = []
            list_key = key
        elif value.startswith("[") and value.endswith("]"):
            data[key] = [x.strip().strip("\"'") for x in value[1:-1].split(",") if x.strip()]
            list_key = None
        else:
            data[key] = value.strip("\"'")
            list_key = None
    return data, rest


def write_lf(path, text):
    """Write with LF endings. Path.write_text would turn every "\n" into
    "\r\n" on Windows and rewrite the whole page in git's eyes."""
    path.write_bytes(text.encode("utf-8"))


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:6]


class Page:
    def __init__(self, path):
        self.path = path
        self.rel = path.relative_to(VAULT).as_posix()   # forward slashes on Windows too
        raw = path.read_text(encoding="utf-8")
        self.fm, self.body = read_frontmatter(raw)
        self.lines = len(raw.splitlines())
        self.id = self.fm.get("id", "")
        self.kind = self.fm.get("kind", "")
        self.status = self.fm.get("status", "")
        self.name = path.stem

    def list(self, key):
        v = self.fm.get(key, [])
        return v if isinstance(v, list) else [v]

    @property
    def aliases(self):
        return [a for a in self.list("alias") if a]

    def outgoing_links(self):
        return {m.group(1).strip() for m in WIKILINK.finditer(self.body)}


def load_pages():
    if not WIKI.exists():
        return []
    all_pages = [Page(p) for p in sorted(WIKI.rglob("*.md"))]
    return [p for p in all_pages if p.kind not in SYSTEM_KINDS]


# --------------------------------------------------------------------------
# Checks 1-11
# --------------------------------------------------------------------------

def check(pages, fix):
    problems = defaultdict(list)
    by_id = {p.id: p for p in pages if p.id}
    by_name = {p.name: p for p in pages}
    targets = set(by_id) | set(by_name)
    for p in pages:
        targets.update(p.aliases)

    # 1. dead wikilinks (only within the wiki — links to the rest of the vault are skipped)
    for p in pages:
        for link in p.outgoing_links():
            if link not in targets and not (VAULT / f"{link}.md").exists():
                hits = list(VAULT.rglob(f"{link}.md"))
                if not hits:
                    problems["1. Dead wikilinks"].append(f"{p.rel} → [[{link}]]")

    # 2. wiki <-> INDEX.md drift
    index_entries = set()
    if INDEX.exists():
        # strip code blocks — INDEX.md keeps a format example inside one
        index_text = re.sub(r"```.*?```", "", INDEX.read_text(encoding="utf-8"), flags=re.S)
        index_text = re.sub(r"`[^`\n]*`", "", index_text)
        for m in WIKILINK.finditer(index_text):
            target = m.group(1).strip()
            # INDEX also links things that aren't wiki pages. Anything with a
            # non-.md extension is a pointer, not a page.
            if "." in Path(target).name and not target.endswith(".md"):
                if not ((LIBRARY / target).exists() or (VAULT / target).exists()):
                    problems["2. INDEX links to a file that doesn't exist"].append(target)
                continue
            index_entries.add(target)
    page_keys = {p.id or p.name for p in pages}
    for p in pages:
        if (p.id or p.name) not in index_entries:
            problems["2. Page missing from INDEX.md"].append(str(p.rel))
    for entry in index_entries - page_keys:
        problems["2. INDEX.md entry with no page"].append(entry)

    # 3. orphans — zero incoming links (MOCs are hubs, they aren't linked to)
    incoming = defaultdict(int)
    for p in pages:
        # links from the body AND references from the `sources:` field — a
        # source page isn't an orphan just because only frontmatter points to it
        refs = p.outgoing_links() | {
            re.sub(r"^\[\[|\]\]$", "", s).strip() for s in p.list("sources") if s}
        for link in refs:
            target = by_id.get(link) or by_name.get(link)
            if target and target is not p:
                incoming[target.id or target.name] += 1
    for p in pages:
        if p.kind != "moc" and incoming[p.id or p.name] == 0:
            problems["3. Orphans (zero incoming links)"].append(str(p.rel))

    # 4. empty sources: — a page without a source is a hallucination by definition
    for p in pages:
        if p.kind in {"concept", "entity"} and not [s for s in p.list("sources") if s]:
            problems["4. Page without a source (HALLUCINATION)"].append(str(p.rel))

    # 5. duplicate ids
    by_id_list = defaultdict(list)
    for p in pages:
        if p.id:
            by_id_list[p.id].append(str(p.rel))
        else:
            problems["5. Page without an id field"].append(str(p.rel))
    for ident, files in by_id_list.items():
        if len(files) > 1:
            problems["5. Duplicate id"].append(f"{ident}: {', '.join(files)}")

    # 6. taxonomy drift — the same entity spelled as tool/Tool/tools
    variants = defaultdict(set)
    for p in pages:
        for tag in p.list("tags") + [p.kind, p.status]:
            if tag:
                variants[tag.lower().rstrip("s")].add(tag)
    for stem, forms in variants.items():
        if len(forms) > 1:
            problems["6. Taxonomy drift (variants of the same tag)"].append(
                f"{stem}: {', '.join(sorted(forms))}")

    # 6b. values outside the vocabulary
    for p in pages:
        if p.kind and p.kind not in KINDS:
            problems["6. Unknown kind"].append(f"{p.rel}: {p.kind}")
        if p.status and p.status not in STATUSES:
            problems["6. Unknown status"].append(f"{p.rel}: {p.status}")

    # 7. length limits
    for p in pages:
        if p.kind == "moc":
            # a MOC has no limit — it's the TL;DR of the whole folder, so it
            # grows with it. Capping it would force pages off the map, i.e.
            # make them invisible to the user.
            continue
        limit = LINE_LIMIT_PROCEDURE if p.kind == "procedure" else LINE_LIMIT_PAGE
        if p.lines > limit:
            problems[f"7. Page over {limit} lines (split it, don't raise the limit)"].append(
                f"{p.rel}: {p.lines} lines")
    if INDEX.exists():
        index_lines = INDEX.read_text(encoding="utf-8").splitlines()
        if len(index_lines) > LINE_LIMIT_INDEX:
            problems["7. INDEX.md over 300 lines (split per domain)"].append(
                f"{len(index_lines)} lines")
        for n, line in enumerate(index_lines, 1):
            if line.startswith("- [[") and len(line) > CHAR_LIMIT_ENTRY:
                problems["7. INDEX.md entry over 150 characters"].append(
                    f"line {n}: {len(line)} characters")

    # 10. `originals` field in frontmatter — one entry per source.
    # In the Properties panel it should sit next to `sources`, so a page glued
    # together from 2-5 sources shows at a glance which originals to check.
    # `source`-kind pages are NOT exempt: `originals` also points to a FILE in
    # the vault there, exactly like on atoms. The external address lives in
    # the page body, in a `▶ ORIGINAL` callout — check 9 enforces that.
    for p in pages:
        sources_fm = p.fm.get("sources") or []
        originals = p.fm.get("originals") or []
        if isinstance(sources_fm, str):
            sources_fm = [sources_fm]
        if isinstance(originals, str):
            originals = [originals]
        if not originals:
            problems["10. Missing `originals` field in frontmatter"].append(str(p.rel))
        elif len(originals) != len(sources_fm):
            problems["10. `originals` doesn't match `sources` in length"].append(
                f"{p.rel}: sources={len(sources_fm)}, originals={len(originals)}"
            )
        else:
            for o in originals:
                o = str(o).strip()
                # MUST be a wikilink to a file in the vault, not a URL. The
                # source file carries the user's own thoughts, comments, and
                # notes on how to use it — the vault file is RICHER than the
                # external original. The external address lives on the
                # `source` page, not here.
                if not o.startswith("[["):
                    problems["10. `originals` must point to a vault FILE, not a URL"].append(
                        f"{p.rel}: {o[:60]}"
                    )
                    continue
                # check 1 (dead wikilinks) only reads the page BODY, not
                # frontmatter, so a typo in a filename here would go unnoticed
                target = o.strip("[]").split("|")[0].split("#")[0].strip()
                if not list(VAULT.rglob(f"{target}.md")):
                    problems["10. `originals` points to a file that doesn't exist"].append(
                        f"{p.rel} → [[{target}]]"
                    )
                    continue
                # on a `source` page both paths to the file must agree, or
                # `file:`/`file-hash:` watch one file while the user clicks another
                if p.kind == "source" and p.fm.get("file"):
                    if target != Path(str(p.fm["file"])).stem:
                        problems["10. `originals` doesn't match the `file` field"].append(
                            f"{p.rel}: file={p.fm['file']}, originals=[[{target}]]"
                        )

    # 9. visible "## Sources" section + link to the ORIGINAL — frontmatter
    # isn't enough, since properties are invisible in reading mode, and this
    # is the only way back to the source.
    for p in pages:
        if p.kind == "source":
            # the source page itself must point to the original — in the
            # body, not just in the `file` field
            if not re.search(r"https?://", p.body) and not re.search(r"\[\[(?!source-)", p.body):
                problems["9. Source page without a link to the ORIGINAL"].append(str(p.rel))
            continue
        if "## Sources" not in p.body:
            problems["9. Page without a visible ## Sources section"].append(str(p.rel))
            continue
        section = p.body[p.body.index("## Sources"):]
        # original = an http address or a wikilink outside the wiki (e.g. the
        # user's own note). A bare [[source-...]] isn't enough: it leads to
        # our summary, not the original.
        has_url = bool(re.search(r"https?://", section))
        has_link_outside_wiki = bool(re.search(r"\[\[(?!source-)[^\]]+\]\]", section))
        if not (has_url or has_link_outside_wiki):
            problems["9. ## Sources section without a link to the ORIGINAL"].append(str(p.rel))

    # 11. one MOC per folder — completeness of the navigation map.
    # The rule "every folder has a MOC" lived in the schema unenforced for a
    # while, and an unenforced rule rots. Here the rot is silent and the
    # worst kind possible: the page exists, but the user doesn't know it,
    # because no navigation leads to it.
    by_folder = defaultdict(list)
    for p in pages:
        if p.path.parent != WIKI:
            by_folder[p.path.parent].append(p)

    for folder, in_folder in sorted(by_folder.items()):
        mocs = [p for p in in_folder if p.kind == "moc"]
        if not mocs:
            problems["11. Folder without a MOC (its pages are invisible to the user)"].append(
                f"{folder.relative_to(VAULT)}: {len(in_folder)} pages, missing {folder.name}-moc")
            continue
        if len(mocs) > 1:
            problems["11. Folder with more than one MOC"].append(
                f"{folder.relative_to(VAULT)}: {', '.join(sorted(m.name for m in mocs))}")
        moc = mocs[0]
        if moc.name != f"{folder.name}-moc":
            problems["11. MOC named something other than `<folder>-moc`"].append(
                f"{moc.rel} (expected: {folder.name}-moc)")

        # body = everything before the tail (gaps / related / sources)
        body = moc.body
        for marker in TAIL_SECTIONS:
            cut = body.find(f"\n{marker}")
            if cut != -1:
                body = body[:cut]
        in_body = {m.group(1).strip() for m in WIKILINK.finditer(body)}
        in_whole = moc.outgoing_links()

        for p in in_folder:
            if p is moc:
                continue
            keys = {p.id, p.name} | set(p.aliases)
            keys.discard("")
            if keys & in_body:
                continue
            if keys & in_whole:
                # the link exists, but only in the tail — meaning it got
                # appended at the bottom instead of fitted into a section.
                # This is exactly what turns the map back into a bag of files.
                problems["11. Page in the MOC only in the tail (fit it into a section)"].append(
                    f"{moc.name} → {p.name}")
            else:
                problems["11. Page missing from its folder's MOC"].append(
                    f"{moc.name} → {p.name}")

        headings = [h.strip() for h in re.findall(r"^##\s+(.+)$", moc.body, flags=re.M)]
        tail = ("What's not here yet", "Related", "Sources")
        content_headings = [h for h in headings if not h.startswith(tail)]
        for h in content_headings:
            first = re.sub(r"[^\w]", "", h.split()[0].lower()) if h.split() else ""
            if first in JUNK_DRAWER:
                problems["11. Junk-drawer section in a MOC (name it as a question, not 'Other')"].append(
                    f"{moc.name}: ## {h}")
        if GAPS_SECTION not in moc.body:
            problems["11. MOC without a `## What's not here yet` section"].append(str(moc.rel))
        if len(content_headings) < 2 and len(in_folder) - 1 >= 5:
            problems["11. MOC without structure (< 2 content sections at 5+ pages)"].append(
                f"{moc.rel}: {len(content_headings)} sections for {len(in_folder) - 1} pages")

    # 12. Bridges between MOCs — completeness of the map ACROSS folder
    # boundaries. Check 11 only guards the inside of a folder, so a
    # neighboring page cited repeatedly from this folder's atoms is invisible
    # from its MOC. The MOC is the only entry point into the wiki, so this
    # isn't a mistake in one file, it's a rule that was too narrow.
    #
    # Threshold: the page must be cited by >=2 DIFFERENT atoms in this
    # folder. We count atoms, not occurrences, because one chatty page
    # shouldn't be able to pull a foreign concept onto someone else's map —
    # only two independent pages mean the folder actually depends on it. At
    # threshold 1, noise from "Related" sections leaks in and the MOC bloats
    # with names, i.e. goes back to being a bag of files.
    key_to_page = {}
    for p in pages:
        for k in {p.id, p.name} | set(p.aliases):
            if k:
                key_to_page.setdefault(k, p)

    for folder, in_folder in sorted(by_folder.items()):
        # sources/ is a layer, not a topic: source-* pages link to everything
        # that came out of them, so a bridge check would turn the sources
        # MOC into an index of the whole wiki.
        if folder.name == "sources":
            continue
        mocs = [p for p in in_folder if p.kind == "moc"]
        if not mocs:
            continue  # check 11 already flags a missing MOC
        moc = mocs[0]
        in_moc = moc.outgoing_links()

        citing = defaultdict(set)
        for p in in_folder:
            if p is moc:
                continue
            for link in p.outgoing_links():
                target = key_to_page.get(link)
                if target is None or target.kind == "moc":
                    continue
                if target.path.parent == folder or target.path.parent.name == "sources":
                    continue
                citing[target].add(p.name)

        for target, citers in sorted(citing.items(), key=lambda kv: kv[0].name):
            if len(citers) < 2:
                continue
            if ({target.id, target.name} | set(target.aliases)) & in_moc:
                continue
            problems["12. Page cited 2+ times from a neighboring folder, missing from its MOC"].append(
                f"{moc.name} → {target.name} (from {folder.name}/: {', '.join(sorted(citers))})")

    # 8. source-hash — the source changed, so everything derived from it is suspect
    current_source_hash = {}
    for p in pages:
        if p.kind != "source":
            continue
        file = p.fm.get("file", "")
        if not file:
            problems["8. Source-kind page without a file field"].append(str(p.rel))
            continue
        target = VAULT / file
        if not target.exists():
            problems["8. Source points to a file that doesn't exist"].append(f"{p.rel} → {file}")
            continue
        current = sha(target.read_text(encoding="utf-8", errors="replace"))
        current_source_hash[p.id or p.name] = current
        if p.fm.get("file-hash") and p.fm["file-hash"] != current:
            problems["8. Source changed since the last ingest"].append(
                f"{p.rel} (recorded {p.fm['file-hash']}, now {current})")

    to_fix = []
    for p in pages:
        sources = [re.sub(r"^\[\[|\]\]$", "", s).strip() for s in p.list("sources") if s]
        if not sources or not p.fm.get("source-hash"):
            continue
        parts = [current_source_hash.get(s, "?") for s in sorted(sources)]
        expected = sha("".join(parts))
        if p.fm["source-hash"] != expected:
            problems["8. source-hash drifted → status: stale"].append(str(p.rel))
            if p.status != "stale":
                to_fix.append((p, expected))

    if fix and to_fix:
        for p, new in to_fix:
            text = p.path.read_text(encoding="utf-8")
            text = re.sub(r"^status:.*$", "status: stale", text, count=1, flags=re.M)
            text = re.sub(r"^source-hash:.*$", f"source-hash: {new}", text, count=1, flags=re.M)
            write_lf(p.path, text)
        print(f"  → set status to 'stale' on {len(to_fix)} pages\n")

    return problems


# --------------------------------------------------------------------------
# Mechanical cross-link suggestions — links from a literal name/alias hit,
# NEVER from the model "sensing" a connection. Hallucinated connections
# wreck the graph.
# --------------------------------------------------------------------------

def link_suggestions(pages):
    suggestions = defaultdict(list)
    targets = []
    for p in pages:
        for phrase in {p.name, p.id, *p.aliases}:
            if phrase and len(phrase) >= 4:
                targets.append((phrase, p))

    for p in pages:
        no_code = re.sub(r"```.*?```", "", p.body, flags=re.S)
        no_code = re.sub(r"`[^`]*`", "", no_code)
        already = p.outgoing_links()
        for phrase, target in targets:
            if target is p or (target.id or target.name) in already:
                continue
            if re.search(rf"(?<!\[)\b{re.escape(phrase)}\b(?!\])", no_code, re.I):
                entry = f"“{phrase}” → [[{target.id or target.name}]]"
                if entry not in suggestions[str(p.rel)]:
                    suggestions[str(p.rel)].append(entry)
    return suggestions


def recompute_hashes(pages):
    """Last step of an ingest: stamping pages with current hashes.

    The model won't compute sha256 by hand — that's what this function is
    for. First file-hash on `source` pages (from the real source file's
    content), then source-hash on everything derived from them.
    """
    changed = 0
    current = {}

    for p in pages:
        if p.kind != "source":
            continue
        target = VAULT / p.fm.get("file", "")
        if not p.fm.get("file") or not target.exists():
            print(f"  ⚠ {p.rel}: missing 'file' field or file doesn't exist — skipping")
            continue
        new = sha(target.read_text(encoding="utf-8", errors="replace"))
        current[p.id or p.name] = new
        if p.fm.get("file-hash") != new:
            text = p.path.read_text(encoding="utf-8")
            if re.search(r"^file-hash:", text, re.M):
                text = re.sub(r"^file-hash:.*$", f"file-hash: {new}", text, count=1, flags=re.M)
            else:
                text = re.sub(r"^(file:.*)$", rf"\1\nfile-hash: {new}", text, count=1, flags=re.M)
            write_lf(p.path, text)
            changed += 1

    for p in pages:
        sources = [re.sub(r"^\[\[|\]\]$", "", s).strip() for s in p.list("sources") if s]
        if not sources:
            continue
        new = sha("".join(current.get(s, "?") for s in sorted(sources)))
        if p.fm.get("source-hash") != new:
            text = p.path.read_text(encoding="utf-8")
            if re.search(r"^source-hash:", text, re.M):
                text = re.sub(r"^source-hash:.*$", f"source-hash: {new}", text, count=1, flags=re.M)
            else:
                text = re.sub(r"^(last-ingest:.*)$", rf"\1\nsource-hash: {new}", text,
                               count=1, flags=re.M)
            write_lf(p.path, text)
            changed += 1

    print(f"  → stamped {changed} hash fields across {len(pages)} pages\n")


def main():
    # Output is full of → · ⚠ … — a Windows pipe defaults to cp1252 and
    # would crash on the first arrow.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Mechanical Library lint.")
    ap.add_argument("--fix", action="store_true", help="set status: stale where the hash drifted")
    ap.add_argument("--links", action="store_true", help="show suggested cross-links")
    ap.add_argument("--recompute", action="store_true",
                     help="last step of an ingest: compute and write file-hash / source-hash")
    args = ap.parse_args()

    pages = load_pages()
    if args.recompute and pages:
        print(f"\nRecomputing hashes ({len(pages)} pages)\n" + "=" * 60)
        recompute_hashes(pages)
        pages = load_pages()
    print(f"\nLibrary: {len(pages)} pages in wiki/\n" + "=" * 60)
    if not pages:
        print("Empty — nothing to check.")
        return 0

    problems = check(pages, args.fix)

    if problems:
        for category in sorted(problems):
            print(f"\n{category} ({len(problems[category])})")
            for item in problems[category][:15]:
                print(f"  · {item}")
            if len(problems[category]) > 15:
                print(f"  … and {len(problems[category]) - 15} more")
    else:
        print("\nClean. Zero problems.")

    if args.links:
        suggestions = link_suggestions(pages)
        print("\n" + "=" * 60 + f"\nLink suggestions ({sum(len(v) for v in suggestions.values())})")
        print("Literal name/alias hits. Insert by hand — connections aren't guessed.\n")
        for file in sorted(suggestions):
            print(f"  {file}")
            for s in suggestions[file][:8]:
                print(f"    · {s}")

    total = sum(len(v) for v in problems.values())
    print("\n" + "=" * 60 + f"\nTotal problems: {total}\n")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
