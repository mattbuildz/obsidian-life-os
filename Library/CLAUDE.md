# Library zone

**The knowledge zone** — an instance of Karpathy's "LLM Wiki" pattern: what the user knows; it should accumulate over time. Router with shared rules: `../CLAUDE.md`.

**Before writing anything in `wiki/`, read `SCHEMA.md`.** Those are the operating rules — always. What this is for, without the jargon, and a command cheat sheet: `../HANDBOOK.html` — Library tab.

## What's where

| Place | What it is | Rule |
|---|---|---|
| `sources/` | Raw material: `inbox/` (the queue — the `note` skill, the `/source` command, a web clipper), plus an archive by type (`articles/`, `transcripts/`, `own-notes/`…) | **Immutable.** You may only create a **new** file in `inbox/`, or move a file into the archive with `mv`. A hook enforces this. |
| `wiki/` | Pages compiled by the agent (`concepts/`, `entities/`, `moc/`, and topic folders) | Written only by **library mode** (`/library`); ingestion is run manually. |
| `INDEX.md`, `log.md`, `wiki.base` | Catalog, chronicle, a browsing view | `INDEX.md` is the only Library file you may read outside library mode. |
| `books/` | Reading conclusions. One file = one short reading session, created by the vault's Book tab. `books.base` = a table of all conclusions. | **Human — their own thinking, do not write here without instruction.** Check the `.base` file when the user asks what they took away from a book. |
| `explanations/` | Output of the `explain` skill — an in-depth explanation of a concept hit during work, drawn from **all** of the user's projects. Fires only on explicit invocation. | **Fixed location — don't ask where to save**, name `YYYY-MM-DD-slug.md`. Unlike `wiki/`, session context (code, project names) is fair game here — this isn't meant to be universal knowledge. You don't compile this into the wiki yourself; the user moves it to `inbox/` by hand if they want it there. |
| `workshops/` | Working materials from hands-on learning sessions | Working learning materials. Not scanned by the hook or `lint.py`. |

## Rules that run themselves

- **Hooks** (`.claude/hooks/library.py`) block writes to `sources/` other than a new file in `inbox/`, and check every freshly written `wiki/` page.
- **`lint.py`** — wiki health checks (dead links, orphans, missing sources, hashes, length limits). Scans only `wiki/` and `sources/`.

## What this zone never does

It never writes to `../Life/` (zone contract in the router).
