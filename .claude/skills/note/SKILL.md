---
name: note
description: Saves an explanation as a new drop-in file in the Library queue (Library/sources/inbox/), from where the /library command will later compile it into the wiki. Use when the user says something is important, asks for something to be explained and saved, says "save this as a note," "drop this in the notes," "this is important, explain it to me," "note this down," "save this so I remember it," or calls /note.
---

# note — a drop-in for the Library queue

## Target file

**One file per drop**, a new one every time:

```
Library/sources/inbox/YYYY-MM-DD-slug.md
```

`slug` = a kebab-case version of the title, plain ASCII (`mutability-references`, `file-open-modes`). If a file with that name already exists, append `-2`.

**Never append to an existing file** — always a new file per drop. And don't write into `Life/Notes/` for this — that folder is for the user's own free-form notes, not agent-authored drops.

> **This is capture, not compilation.** Your job ends once the file is saved to `inbox/`. **Never compile it, never touch `Library/wiki/`, `INDEX.md`, or `log.md`** — that's a separate command, `/library`, which the user runs deliberately when they have time for it. Compiling mid-task turns a quick save into a 40-minute detour.

## When to use this

When the user signals that something is important and wants it explained and saved — typically after debugging, after understanding some mechanism, or after a design decision.

If it's unclear whether they want just an explanation in chat or also a save — ask in one sentence. If they already said "drop this in the notes" or called `/note` in the same message — don't ask for confirmation, just save it.

Two common variants, both ending in one file:

- `/note <a topic you already covered in this chat>` — the explanation already happened, so don't repeat it in chat; turn the mechanism into a standalone entry and save it.
- `explain X to me and save it as a note` — explain in chat first, then save, without asking again.

## The most important rule: the entry is universal

**The session is only the reason the entry exists. It is not the entry's content.**

The entry should read like a paragraph from documentation, a good Stack Overflow answer, or an explanation from a colleague: the mechanism itself, on a neutral example, understandable to someone who has never seen this project — because in a couple of months, the user will be exactly that person.

That means the entry **excludes**:

- the session's narrative ("we did X, then it turned out that…", "earlier you tried…"),
- file, function, and variable names from the actual project,
- the stages, decisions, and project-specific context needed to understand *that* code,
- anything about what the user was doing before they asked the question.

This isn't a work log. Session context pasted into the entry turns into noise once it's ingested into the wiki, and dilutes the mechanism the entry was actually about — and reading it back in six months means remembering something you no longer remember.

The one exception: when a mechanism **only shows up in a specific configuration** (it needs two threads, a generator consumed twice, a streamed response), describe that configuration **generically** — "when the same list is held in two places" — not through the lens of the specific project.

## Code in the entry

Code should be a **minimal example you could paste into an empty file and run**, with neutral names the way documentation uses them: `data`, `results`, `item`, `key`, `config`, `client`, `response`, `path`. Three to eight lines. No project imports, no API keys (`<YOUR_KEY>`), no local paths.

Test: **would this code block make sense as a documentation example?** If yes — good. If someone would need to know what the project is — rewrite it as neutral.

```python
# BAD — code from the session, only legible with the project in your head
all_items = fetch_items(my_project_id)
today_items.extend(all_items)

# GOOD — same mechanism, generic example
a = [1, 2]
b = a          # not a copy, a second name for the same object
b.append(3)
print(a)       # [1, 2, 3]
```

## File format

````markdown
---
source-type: note
title: Mutability and references — why appending to one list shows up in the other
date: 2026-08-21
topics: [python, data-structures]
---

# Title — what this is about

## The problem

What looks like a bug and what a reasonable person would expect instead. One or two sentences, no session narrative.

```python
# minimal example, neutral names, runnable
```

## Why this happens (or: why it didn't work)

The mechanism. Name it fully (reference, mutation, shallow copy, temperature, mocking) — that's what gets searched for.

## [Additional sections as needed]

Distinctions that are easy to miss. The pitfall in the opposite direction. How to prove it to yourself in code. The practical takeaway.

> **Remember:** one sentence that sticks when the rest is forgotten.
````

Frontmatter — four fields, all mandatory:

| Field | What to put |
|---|---|
| `source-type` | always `note` (this determines which extractor ingest uses) |
| `title` | the full title as a sentence, matching the `#` heading |
| `date` | today's date, `YYYY-MM-DD` |
| `topics` | 1–3 tentative kebab-case tags. Ingest will verify them, so don't agonize over it. |

## Content rules

- Direct, second person ("you"), matter-of-fact tone — no flattery, no "great question."
- No emoji.
- `##` headings matched to the content, not a rigid template. A short entry can have one section. Names worth reusing: `## The problem`, `## Minimal example`, `## Why this happens`, `## The pitfall in the other direction`, `## Practical takeaway`.
- A BAD/GOOD pattern wherever a specific piece of syntax is the point.
- A `| piece | what it's for |` table when breaking down a function call's arguments.
- `> **Remember:**` at the end when there's one rule worth distilling. Skip it for a purely descriptive entry.
- If the entry describes a bug: write **what misleading assumption leads to it** — not "which line changed in this project." The most valuable entries say "this looks like a problem with X, but it's actually Y."
- This is a learning note, not a ready-made fix to copy-paste. Code shows the **mechanism**; describe the direction of the fix in words.

## After saving

Say in chat, **in one sentence**, which file landed in the queue — don't summarize the entry a second time. E.g.:

> Added to the queue: `2026-08-21-mutability-references.md`. Will compile on the next `/library ingest`.

## What not to do

- **Don't compile.** Don't touch `Library/wiki/`, don't update `INDEX.md` or `log.md`. Not your zone.
- **Don't write up the session's play-by-play.** See the universality section above — that's the most common way to ruin an entry.
- Don't save something the user hasn't confirmed they understand. If the chat hasn't reached a conclusion yet — explain first, then ask about saving.
- **Don't worry about duplicates.** If the topic already came up somewhere, save it anyway — identity resolution (whether it's a new page or an addition to an existing one) is ingest's job, done by `id` and `alias`, with visibility into the whole wiki that you don't have. If you *do* remember it recurring, add one sentence in the entry ("this is the same mechanism as with mutability, but…") — that helps ingest connect the pages.
- Don't edit files already sitting in `inbox/`. Every drop is a new file.
