# CAPTURE — how something lands in the Library

*This file is for you, not for the agent.* Lost, or want the why instead of the how, or a command reference? `HANDBOOK.html` (root of the vault) — Library → Idea or Library → Cheatsheet.

Four paths, one queue. Everything lands in `Library/sources/inbox/` and waits until you run `/library ingest`.

> [!important] Capture is automatic, ingest is NOT
> Dropping something in should be mindless and instant — click, done. Compiling into `wiki/` only runs **when you trigger it yourself**. Two reasons: compiling in the middle of a work block eats 40 minutes, and letting other people's web pages into a knowledge base without looking is an open door for prompt injection.

## 1. `/note` — from a coding session

The most important path. Works **from any directory**, because the skill is installed globally.

```
/note why .extend() added the item to both lists
```

or mid-conversation: *"explain this to me and save it as a note."*

One file `YYYY-MM-DD-slug.md` appears in the queue. Takes 10 seconds and **doesn't interrupt the work block**.

## 2. Obsidian Web Clipper — EVERYTHING from the web

**This is the main path.** Videos, articles, repos, threads, docs — one browser shortcut and it's done.

It works **on the page as already rendered**, so it handles SPAs, JS, and content behind a login — everything a plain fetch script would choke on. Verified on a real technical tutorial video: it captures the **full YouTube transcript with timestamps and chapter breaks**, roughly 21k characters ≈ ~6k tokens. No separate transcript tool needed — one shortcut instead of four steps.

> [!note] Why there's no download script here
> There used to be one. It was removed because it duplicated a tool that already existed and had already been verified to work. Two paths to the same thing means one of them rots. Claude **never fetches pages itself**, not with a script and not with a web-fetch tool.

**Configuration (once):**

1. Install the *Obsidian Web Clipper* extension (Firefox / Chrome).
2. Settings → pick your vault.
3. **Note location:** `Library/sources/inbox` ← this is the one step that matters. By default the extension targets a generic clippings folder that nothing ever compiles.
**That's it. Don't touch the template.**

**Don't tag or describe anything while clipping — that stays the rule.** A clip should be free: click and go back to what you were doing. Metadata gets added by the agent at ingest time, when it's reading the content anyway.

> [!note] Exception: `TOPIC` — one field, fill it in ONLY when you know right away
> The Clipper template has an optional `TOPIC` attribute (blank by default). It's an **accelerator, not a requirement** — if you already know an article is about, say, git, type `git` and move on. Don't know or don't feel like it — leave it blank, same as always.
>
> Ingest reads `TOPIC:` when it's non-empty and treats it as a **strong hint** for the topic and the `wiki/` folder — but it still **verifies it against the actual content**, same as it verifies the source type from the `source:` field. A sloppy entry (a typo, the wrong word) won't break the ingest, it just gets ignored.

## 3. `/source` — pasted text

For things that don't live on a page: a fragment of a conversation, a note from your head, a piece of documentation from somewhere else.

```
/source <pasted text>
```

**Conversations with LLMs get `source-type: llm`** — and that's not cosmetic. A lecture transcript is verifiable (there's a video, a timestamp, an author). A model's output **has no source, only an author with no accountability**. If both sat in the queue indistinguishable, a synthesis six months later would put an unverified claim on the same footing as documentation — and you wouldn't catch it, because you're asking precisely about what you don't remember.

## 4. Manually

Drag an `.md` file into `Library/sources/inbox/` by hand. Frontmatter format as above; if it's missing, ingest handles it anyway.

---

## What happens after ingest

The file **doesn't disappear and doesn't change** — it moves from `inbox/` to the archive by type:

```
sources/inbox/       ← queue: waiting to be compiled
sources/own-notes/   ← after ingest: what came in through /note (source-type: note)
sources/articles/    ← after ingest: articles and pastes from the web
sources/docs/        ← after ingest: documentation/API pages
sources/reddit/      ← after ingest: Reddit threads
sources/llm-chats/   ← after ingest: pasted conversations with models
sources/transcripts/ ← after ingest: YouTube transcripts
```

Folder = `source-type` by name, not an abbreviation to decode — concrete on purpose, so it's easy to find what ended up where.

The raw layer is **immutable**. Nobody ever edits a source's content — only its location changes, so it's clear what's been processed. That lets `lint.py` detect a source change by hash and flag the pages derived from it as `stale`.

## How much is waiting in the queue

```bash
ls -1 "Library/sources/inbox/"*.md 2>/dev/null | wc -l
```

## The rule that's easy to forget

**Drop things without thinking.** Don't judge whether "this is worth it," don't hunt for the right place, don't check if the topic already exists. Resolving identity (a new page or an addition to an existing one) happens at ingest time, by `id` and `alias`, with visibility into the whole wiki — which is, by definition, better than you can do mid-debugging.

The only question worth asking when you drop something is: *do I want to still have this in six months?* If yes — drop it and get back to work.

## Related

- `SCHEMA.md` — the operational rules for ingest
- `HANDBOOK.html` (root of the vault) — the full command reference, Library → Cheatsheet
