---
kind: schema
status: active
version: 2
date: 2026-08-14
---

# SCHEMA — how to operate the Library

Same operational rules — always loaded, so a hard **150-line limit**. **What this is for, no jargon: `HANDBOOK.html`, Library → Idea** (read it when the user asks "what do you actually do here").

## Three layers
| Layer | Path | Who writes |
|---|---|---|
| Raw sources | `sources/` + `Life/Notes/` in the vault | **NOBODY. Untouchable.** You read, never modify. |
| Wiki | `wiki/` | Only you (the agent). The user reads. |
| Schema | this file | Together, deliberately |

**`sources/inbox/` is one queue for everything** — `/note`, `/source` and the Web Clipper all drop files there. After ingest you **move** the file (never delete, never edit) to the archive, **folder = `source-type` by name**: `own-notes/`, `articles/`, `docs/`, `reddit/`, `llm-chats/`, `transcripts/`. Source content never changes — only its location does, and that is the only write the raw layer allows. Entry points: `CAPTURE.md`.

## Zone boundary — non-negotiable
The life-manager side is allowed to **only add a file to `sources/inbox/`** — it never compiles or touches `wiki/`, `INDEX.md`, `log.md`. Library mode reads `roadmap-brief.md` and `avatar.md`, but **never writes to `Life/Journal/`, `Life/Calendar/`, `Life/INBOX.md`**. **Never two sessions writing to `wiki/` at once** — the conflict is semantic, git won't catch it. Full zone table: `CLAUDE.md`.

## THE DEFAULT RULE — the most important thing in this file

> **What decides a page is the CONTENT, not the number of sources.** A mechanism → a page. A pointer → a line in `wiki/_catalog.md`.

**A page = a MECHANISM:** answers "how does this work" / "how do I do this," can be written out in a dozen-odd lines with a quote, could be asked about on its own. **One source is enough.** — **A line in the catalog = a bare POINTER:** a tool name, a repo, a "someday" link. A sentence that only makes sense inside someone else's mechanism gets added to that page instead.

The guard against empty-shell pages stays, just moved: not "how many sources," but **"is there anything to write."** A page without a mechanism, living off one link, is an orphan — see the `link-notes` skill.

## Folders = TOPIC, frontmatter = KIND
```
wiki/python/  ·  wiki/data-and-files/  ·  wiki/apis-and-networking/  ·  wiki/sources/
```

**One nesting level by default.** Kind lives in the frontmatter and in `wiki.base`, so the folder doesn't duplicate it — it carries the only navigational dimension the user has in the File Explorer. **Open a new topic once it reaches ~5 pages**, not sooner. `sources/` is a layer, not a topic.

> [!warning] When you're allowed to go one level deeper — a threshold, not a hunch
> A subfolder is allowed **if and only if a single MOC SECTION has crossed ~7 pages and is starting to need subsections of its own.** In practice this happens around ~40 atoms in a folder.
> Going down a level too early costs: every subfolder needs its own MOC to fit into on every ingest, bridges between subfolders, and a parent MOC summarizing sub-MOCs. For an 8-page folder that's more machinery than navigation.

| `kind` | What it is | Who creates it |
|---|---|---|
| `source` | 1:1 summary of one file from `sources/` | ingest, automatically |
| `concept` | one idea (e.g. a language feature, an algorithm) | ingest, per the default rule above |
| `entity` | a specific thing/person/tool (e.g. an API, a library) | ingest, per the default rule above |
| `procedure` | how something works / how to do it, step by step (reading a CLI's output, environment setup) | ingest, when the content's carrier is **step order or tool output** |
| `moc` | **the page that ties a topic together**: order of use and why, instead of a list of separate pages | **you write it, the user curates** — see rule below |

There's no kind for a thesis/synthesis — synthesis lives inside a `concept` page with a `source-count` field.

> [!important] EVERY folder (and subfolder) has its own `<folder>-moc` — no exceptions
> Without it `wiki/` is a bag of files. `INDEX.md` doesn't replace this — it's **flat and alphabetical**, and navigation needs **order and hierarchy**.
> **The MOC is a COMPLETE overview of the folder: every page in the folder has a link in it, in the section its content belongs to.** A page outside the MOC is invisible to the user — lint enforces this (check 11). **No length limit**: many atoms means a long MOC, and that's fine; overgrowth is a signal to split the folder into subfolders (each then getting its own MOC), never to shorten the map.
> **BRIDGE TO A NEIGHBOR:** a page from a **different** folder, cited by **2+ different atoms** in this folder, gets its own bridge section in the MOC — a heading saying *why* those pages are here, each link with one sentence on *what it answers*, and a link back to the owning folder's MOC at the end. **The bridge goes both ways.** We count **atoms, not occurrences**: one chatty page doesn't pull a foreign concept onto someone else's map; two independent pages mean the folder actually depends on it. Lint enforces this (check 12). Exempt: `sources/` — `source-*` pages link to everything they produced.
> **Open one at the 5th page**; below that threshold it's allowed, but then `status: draft` and the gaps section longer than the body.
> **Template** (pattern: `git-moc`): `# <Topic> — how it fits together` → one core idea everything else follows from → sections in **order of use, never alphabetical** → each link with one sentence on *what it answers* → **`## What's not here yet`** (mandatory) → `## Related` → `## Sources`.
> **Add a page → in the SAME ingest, FIT it into the MOC, don't append it at the bottom.** A blind append turns the map back into a bag of files — exactly what the MOC exists to prevent. Order: **(1)** read the whole MOC first, it's cheap; **(2)** a section already fits the page's content → `Edit` it in, in the place order-of-use dictates, and when the new page changes the meaning of a neighboring sentence, rewrite that sentence instead of adding beside it; **(3)** no section fits → open a new one in the right spot, named as **the question that group of pages answers**, never a tool name; **(4)** a section grew past ~7 items → cut it by criterion, never alphabetically.
> **EXCEPTION — the `sources` MOC is a TABLE, not a set of sections.** One row per source (`Source · Type · What it's about · What came out of it · Coverage`), never a section per source. A section per source grows linearly with every ingest, and every ingest reads this file because every one produces a `source-*` page. Turning it into a table cut it sharply. A single source's own breakdown still lives on its own `source-*` page — a section in the MOC would just be a second copy. Exactly two non-tabular things remain, because they cover the **whole source base** and live on no single page: `## What this base stands on` (extraction patterns per material type) and the gaps section (skew of the base, debt, missing literature).
> **A junk-drawer section ("Other," "Misc," "Various") is forbidden** — lint rejects it. A page that doesn't fit anywhere means: a section is missing, or the page is in the wrong folder. Resolve it immediately, don't defer it to the bottom.

**`procedure` template:** `## Problem` → `## Step by step` (prose + a code block with **real command output**) → `## Pitfalls` → `## Related` → sources. Limit **250 lines, not 120**. This is the one place where "compile, don't transcribe" gives way to a full breakdown — a terse bullet list flattens exactly what the user saved the source for. **One mechanism understood once is one atom** — `procedure` is the purest case of the default rule above.

## Frontmatter — the contract lint stands on
```yaml
---
kind: concept
id: mutability-references        # kebab-case, STABLE, never changes
alias: [references, mutability, shallow copy]
status: active                    # draft|active|stale|disputed|archived
sources:                          # REQUIRED. `source` pages in our wiki
  - "[[source-random-things-i-dump]]"
originals:                        # REQUIRED. A FILE in the vault, 1:1 with `sources`
  - "[[random things i think are important]]"   # wikilink, NEVER a URL
source-count: 2                   # number of independent sources = length of both `sources`/`originals` lists
last-ingest: 2026-08-14
source-hash: 4f2a9c
---
```

`source`-kind pages additionally have two **required** fields, without which lint can't detect a source change: `file:` (path from the vault root) and `file-hash:` (computed by `lint.py --recompute`). **There's no exception to the `originals` rule** — there too it's a wikilink to a file in the vault, and to the **same** file as `file:` (check 10 compares both fields). The external address lives in the body, in a `▶ ORIGINAL` callout under the heading. Pages also end with a **mandatory `## Details left out` section** — specifics (exact flags, command output, step order, numbers) that didn't make it into any atom, timestamped. That turns "lost" into "one grep away," for the cost of a few lines at ingest time.

- `id` never changes (you can rename the file) — it resolves homonyms. `source-hash` = `sha256[:6]` of the concatenated `file-hash` values of sources sorted by `id`; `lint.py` computes and checks it — **don't compute it by hand**.
- **`originals` points to a FILE in the vault, never a URL.** Reason: in the source file the user leaves **their own thoughts, comments, and notes on how to use it** — at the top, bottom, or middle. The vault file is therefore **richer than the external original**, and sending someone to the external site instead sends them to a poorer version than the one already at hand. The external address lives **in the body of the `source` page** (the `▶ ORIGINAL` callout), never in any frontmatter. Check 10 rejects URLs and checks that the file exists.
- **`sources` and `originals` grow together.** Add a source to an atom → add an original and bump `source-count`. Check 10 enforces equal list lengths — that's the moment it's easiest to lose the way back.
- `status: stale` **is not your decision** — `lint.py --fix` sets it when the hash drifts. **A page without `sources:` is a hallucination by definition** — never create one.
- **Every page ends with a visible `## Sources` section**, in order: **the vault file** (bold, first) → our summary `[[source-*]]` → the external address. Frontmatter isn't enough — properties are invisible in reading mode. `lint.py` enforces this, check 9. Write timestamps as links to the second (`[46:39](https://youtu.be/ID&t=2799s)`) — verification should be one click, since that's the only reason the user goes back to the source.

## Core rule: you're an editor, not an author
Every sentence must trace back to raw material. Mark gaps `[TODO: ...]`, **don't fill them with plausible-sounding padding** — without this you get a wiki full of things the user never actually thought. **Cross-links are mechanical too, never invented:** you link when another page's title/`alias`/`id` literally appears in the text, not when you "sense" a connection — that's what `lint.py --links` is for.

**Wiki pages are MUTABLE** — a new source overwrites and extends an existing page, same as in the pattern this is based on. History and rollback are **git**, not version chains in frontmatter: `Library/wiki/` is in the repo. That's why **you commit after every ingest** — without a commit there's nothing to roll back to, and mutable pages stop being safe. What stays immutable is **sources**, not pages.

## INDEX.md
One line per page, a fixed format, **max ~150 characters per entry, hard ceiling of 300 lines per file**:

```
- [[mutability-references]] · concept · active · source-count 2 · lists hold references, not copies — a change in one place shows up in the other
```

Past 300 lines the index splits per domain and `INDEX.md` becomes an index of indexes; update it on **every** ingest.

## log.md
Append-only, fixed prefix (so `rg "^## \[" Library/log.md | tail -5` works): `## [2026-08-14] ingest | Notes/programming — random things I dump`, with one line underneath: `Touched: [[mutability-references]] (new), [[dedup]] (new), INDEX +3`.

## Ingest — a pipeline, not one prompt

**Always run by hand, always one file at a time. There's no auto-ingest on a hook.**

1. **Classify the source type — this sets the ATOM CEILING, not just the style.** A quick user drop ~3 · a pasted article ~8 · **a course transcript or textbook chapter 15–25** · docs/API with no ceiling. You break a **transcript** into mechanisms, each one separate (don't compress it — that flattened a mechanism in an earlier test), quote docs verbatim with parameter names, leave a user's quick drop in their own words.
2. **Extraction.** List candidates for `concept`, `entity`, and `procedure`, **each with a quote from the source**. No quote, the candidate is out. A mechanism explained for more than a minute is a candidate for its own `procedure`, not a bullet in someone else's atom.
3. **Resolve identity — this is where the overlapping-sources problem gets solved.** Search by `id` and `alias`, not by filename. Three cases: **(a) the page already exists** → append to it with `Edit`, add the source to `sources:`, bump `source-count` by 1 — **never create a second page about the same thing**; **(b) it carries a mechanism** (see the default rule) → new page, **one source is enough**; **(c) it's a bare pointer with no content** → a line in `wiki/_catalog.md`. Overlapping sources don't produce duplicates, they raise `source-count`.
4. **Check for contradictions — cheap, here.** New claim vs. what's already on the touched pages. A contradiction **is not a defect to smooth over**: it lands as a `## Dispute` section with both sources, `status: disputed`.
5. **Write.** A `source` page + updates to touched pages + an `INDEX.md` entry + a `log.md` entry. **The lower bound is hard, there is NO upper one.** Under 5 touched pages for a substantial source means the extraction was lazy — go back and redo it. **Writing too much hurts far less than cutting too much**: the user doesn't go back to the original, so a page you didn't write is knowledge lost for good, while a page that's too long is a few lines to scroll. **When in doubt — write.**

> [!danger] Token discipline at write time — the whole arithmetic is here
> Reading a source is cheap (a ~21k-character transcript ≈ ~6k tokens). **Writing is expensive**, because output tokens cost more than input ones, and one source touches several pages.
> **Update pages with targeted `Edit` calls on specific fragments. NEVER `Write` a whole file.** `Write` rewrites 120 lines to add two sentences. If one source eats your usage window, that's a schema bug, not the price of the model.
> Sanity check: `git diff` after an ingest should show fragments, not rewritten files.

After an ingest, **tell the user what you touched** — they review it live in Obsidian.

## Query

`hot.md` → `INDEX.md` → pick pages → read → answer **with citations**. A good answer **goes back into the wiki as a new page** (ask before shelving it) — explorations should accumulate just like sources do.

## Lint

Mechanical — zero LLM. **Don't hand-do what the script does** (counting, hash comparison, string matching — you'd do it wrong and expensively):

```bash
# Windows: `py` instead of `python3`
python3 Library/lint.py            # report: dead links, INDEX drift, orphans,
                                    # pages without a source, duplicate ids, taxonomy drift,
                                    # limits, hashes, GAPS IN MOCS (check 11)
python3 Library/lint.py --fix      # + set status: stale where the hash drifted
python3 Library/lint.py --links    # + suggested cross-links from literal alias/id hits
```

Run it **after every ingest**. Exit code 1 = there are problems.

LLM — rarely, explicitly, one domain at a time: contradictions between pages about the same thing, concepts mentioned 3+ times with no page of their own, claims with no coverage in their assigned source.

## Token budget — hard limits, lint enforces them
**L1 always:** `CLAUDE.md` + this file + `wiki/hot.md`, under **150 lines**. · **L1 in library mode:** `INDEX.md`, **300 lines** (the real scale ceiling — past it the index splits per topic). · **L2 on demand:** `concept`/`entity` **120 lines**, `procedure` **250**, **`moc` NO LIMIT**. · **L3 rarely:** `sources/`, no limit, read rarely.

A `concept`/`entity` page over 120 lines means it holds two concepts — **cut it**. **`procedure` — no.** Cutting a mechanism in half was the mistake behind an earlier failed test: one clean 200-line atom is cheaper than three scattered 120-line ones. The L1 limits are hard — that includes this file.

## What we don't do
Auto-ingest on a hook · two agents in one wiki at once · embeddings/MCP before the **>200 pages** threshold · moving `Life/Notes/` into the wiki · `Life/Calendar/` in the index · pages without `sources:`.
