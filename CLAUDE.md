# How to work in this vault — router

This vault is a **personal operating system** (calendar + tasks + journaling + coaching + knowledge base), built to take the burden of dropped projects off the user — not to become another project that gets dropped. It has to WORK, not look nice at the expense of function.

**This file loads in every session, so it stays thin** — it says what the zones are and where they live. Zone details live in that zone's own `CLAUDE.md` and load themselves when you enter the zone. The second mandatory file to read at the start: **`COLLABORATION.md`** — how you're expected to work with the user.

> [!info] Every tool reads this file — write neutrally
> `AGENTS.md` next to each `CLAUDE.md` is a **symlink to it** (Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`, Cursor reads both). Don't turn this into two files, and don't write a specific tool's name where "agent" would do.

## Zones

| Zone | What it is | Instructions |
|---|---|---|
| `Life/` | day-to-day operations: calendar, journal, patterns, INBOX, roadmap, user notes, resources | `Life/CLAUDE.md` |
| `Library/` | knowledge: a wiki compiled from sources, books, explanations, workshops | `Library/CLAUDE.md` + `Library/SCHEMA.md` |
| `System/` | machinery: templates, attachments, checkpoints, docs | `System/CLAUDE.md` |

At the root, outside the zones: this file, `COLLABORATION.md`, `START-HERE.html` (a short intro — what this is, why it exists — that hands off to `HANDBOOK.html`), `HANDBOOK.html` (the user's actual day-to-day reference: the loop, commands, formats, glossary, why it works this way, for Life and Library separately — keep it updated as functionality grows), and the hidden directories `.claude/` (commands, skills, hooks), `.obsidian/` (config, the companion plugin).

**How `cd` behaves (measured):**
- A session started in a zone loads this router plus that zone's `CLAUDE.md`. Neighboring zones do not load.
- A `CLAUDE.md` from a subdirectory **below** the working directory loads itself the first time you read a file on that branch.
- A `CLAUDE.md` from a directory **beside** the working directory does not load, even when you read a file from there.
- Commands in `.claude/commands/` at the root work from every zone.
- A zone is **not a wall** — an agent can read files from other zones without refusing. That's intentional: the Life zone knows who the user is, the Library zone knows what they know. Writes are what the hooks guard.
- The root `.claude/settings.json` (hooks) is **not** loaded by a session that starts inside a zone. That's why every zone has `.claude/settings.json` as a symlink to the root one, and the hook command walks up from the zone to find `.claude/hooks/library.py`. A new zone needs the same symlink, or its sessions run without hooks.

Conclusion: **one zone → `cd` into it; two zones → start from the root.** Before you write something in a zone you didn't start in, read its `CLAUDE.md`.

## Boundary: human vs. collaboration
- **Sacred to the user (don't touch without instruction):** `Life/Notes/`, the journaling sections in `Life/Journal/`, filled-in frontmatter values, `Life/roadmap/roadmap-brief.md`, `Life/roadmap/avatar.md` (after its first write it is the user's), `Library/books/` (the user's own conclusions).
- **Collaboration (you write here per the zone's rules):** `Life/Calendar/`, the plan section in a daily note, `Life/INBOX.md` (triage), `Life/Patterns/`, commands, the plugin.
- Don't silently move or delete large sets of files. Deleting means the system trash, never permanent.

## Zone contract (one-directional)
- **Life → Library:** `/morning`, `/evening`, `/weekly` may **only drop a file into `Library/sources/inbox/`**. They never compile, never touch `wiki/`, `INDEX.md`, or `log.md` — compiling mid-block turns a 10-minute check-in into a 40-minute detour.
- **Library → Life:** library mode reads `Life/roadmap/roadmap-brief.md` and `Life/roadmap/avatar.md` so it compiles content that actually serves the user. Read-only — it **never writes to `Life/`**.
- Outside library mode, the only Library file you may pull in is `Library/INDEX.md`.
- **Never two sessions writing to `Library/wiki/` at once** — the conflict is semantic, and git won't catch it.
- Hooks (`.claude/settings.json` → `.claude/hooks/library.py`) block writes to `Library/sources/` other than a new file in `inbox/`, and check every freshly written `wiki/` page. A message on stderr means a rule fired. Don't work around it — fix the underlying issue.

## Work economically
- Read the smallest relevant file first. Don't preload transcripts, logs, or long plans "just in case".
- `grep` in this shell typically respects `.gitignore` — use it normally. If you suspect it's hiding real content (an overly broad ignore rule), double-check with a plain, unfiltered search before concluding something "doesn't exist".
- **Linking:** when you create a new note in a topic folder, wire it into the graph immediately (a MOC/hub plus a "Related" section explaining *why*). Link concepts, not sentences. Process and validator: the `link-notes` skill.

## Windows
- Python is `py`, not `python3` — on Windows `python3` is usually a Microsoft Store stub that runs nothing. Wherever a command or skill says `python3`, use `py` there.
- The symlinks (`AGENTS.md`, each zone's `.claude/settings.json`, `.agents/`, `.codex/skills/<name>`) are **copies** on Windows, made by `System/scripts/setup-symlinks.py`. After editing a `CLAUDE.md`, a skill, or a command, run `py System/scripts/setup-symlinks.py` so the copies catch up. The copies are hidden from git on purpose — don't un-hide or commit them.

## Git
- The vault is version-controlled. **Only commit when the user asks you to.**
- `Life/roadmap/avatar.md`, `roadmap-brief.md`, `backlog.md`, `Life/INBOX.md`, `Life/Journal/`, `Life/Notes/`, `Life/Patterns/observation-log.md`, `patterns.md` and everything in `System/Attachments/` (pasted photos, banner pictures) are in `.gitignore` deliberately (personal data). Never `git add -f` them unless the user asks.
- **Don't run `git stash` on a live vault** — Obsidian may be writing to files while you work, and `stash pop` can fail against that.
