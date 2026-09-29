---
name: explain
description: Writes an in-depth, self-contained explanation of a concept encountered during work (mostly programming, sometimes research) and saves it as a .md file — because a chat reply would hit a length limit, and this is meant to be a full write-up, not a few sentences. Use ONLY on explicit invocation, `/explain <concept>`. Do not trigger yourself just because jargon shows up in conversation — wait for the command.
license: MIT
---

# /explain — an in-depth explanation on command, saved to a file

## Where this sits next to similar skills — don't confuse them

| Skill | What it does | Difference |
|---|---|---|
| A "simplify my last answer" skill (if installed) | Simplifies YOUR last reply | Doesn't explain a new concept, just rephrases what you already said. No new content. |
| `note` | Saves an explanation to the Library queue | The content has to be **universal, stripped of session context** — it's headed for the wiki as general knowledge. |
| A "teach" skill (if installed) | Builds a full, researched HTML lesson with diagrams and a quiz | A different format (an artifact), heavier machinery, the topic treated as a self-contained course. |
| `research` | Multiple subagents across the web in parallel, synthesized in chat | For contested questions needing several sources at once. Heavier than this. |
| **`explain`** (this one) | **One in-depth write-up about a concept from the current work, saved as a .md file** | **Session context is fair game** (code, project names) — this isn't universal wiki knowledge, it's a personal study document. May use web search, but no subagents — you do it yourself, in one pass. |

## When this fires

**Only on explicit `/explain <concept or question>`.** Don't guess when something seems "unclear" and don't offer this yourself mid-work — the user made a deliberate choice for this to be a command, not an automatic trigger. If the user asks "what is X" without invoking the command — answer normally in chat, briefly; that's not an occasion for a full write-up.

## What to do

1. **Gather context.** Where the question came from — what code/project/conversation is behind it. This is fine to use in the write-up (unlike `note`), because the material is meant to explain the thing **in the context of what the user is actually doing**, not in isolation.

2. **Search the web if needed.** If the topic is new, niche, or something that may have changed (a library version, a new API, a recent standard) — use web search so you don't hallucinate details. For established fundamentals (closures, recursion, database indexes, SOLID) your own knowledge is enough — don't search just to search.

3. **Write the file.** See the sections below — location, name, content.

4. **In chat — one or two sentences, not a summary.** Say what you saved and where, maybe one sentence on the core idea. Don't paste the file's content into the chat — the whole point of the file is to get around the length limit.

## File location

**Always the same fixed location, regardless of which project you're working in** (same pattern as `checkpoint`, which also writes to a fixed vault location no matter the project):

```
Library/explanations/
```

Resolved relative to the vault root (the directory containing the root `CLAUDE.md`) — ask once if you're unsure where that is. Don't ask where to save, and don't create files inside whatever project you're currently in (don't clutter someone else's repo with write-ups).

**Filename:** `YYYY-MM-DD-slug.md`, `slug` = a kebab-case version of the topic, plain ASCII (`javascript-closures`, `b-tree-indexes`). If a file with that name already exists for today (a second `/explain` on the same topic), append `-2`.

## File content

A rough structure, not a rigid template — fit the sections to what the topic actually needs:

```markdown
---
topic: <the concept, one sentence>
date: YYYY-MM-DD
context: <where the question came from — project/file/situation, one sentence>
---

# <Title — the concept in plain words, not a dictionary definition>

## What problem this even solves
Before the name and the mechanism: what pain existed before this concept/tool existed. Without this, the rest hangs in a vacuum.

## Intuition
An analogy or the simplest possible example, before the formalism starts. Goal: give the rest of the explanation something to hook onto.

## How it works — the mechanism
The actual explanation, step by step. Code where it helps — **in the language/stack the user is actually working in**, real names from their project are fine here, since this never goes into any wiki.

## Pitfalls and common misconceptions
What people usually get wrong, where the first mistake tends to happen.

## How this applies to your situation
Come back to the context from the frontmatter — how this concept relates specifically to what the user was working on when they asked.

## Check your understanding
2–4 questions (not a scored quiz — just checks), that the user should be able to answer for themselves after reading. No answers underneath — this is meant to make them recall it, not click through it.

## Sources
Only if you used web search — links. Skip this section if it's all your own knowledge.
```

## How long this should be

**As long as the topic actually needs — not artificially padded.** A simple concept might be one page. Something complex (e.g. "how a garbage collector works") might run several sections, comparable in scope to a multi-lesson course — because this is a file, not a chat reply, so there's no pressure to shorten it at the cost of clarity. The measure is **whether another paragraph explains something**, not length for its own sake.

## Style

- Direct, second person, matter-of-fact tone — no flattery, no "great question."
- No jargon beyond what you're currently explaining — if you have to use another hard term, define it inline, don't send the reader elsewhere.
- Concrete over vague: an example, a number, a code fragment — not "it depends" without saying on what.
- A BAD/GOOD block wherever specific, easy-to-mix-up syntax is involved.

## What not to do

- **Don't fire without an explicit invocation.** See "When this fires" above — the most important rule in this skill.
- **Don't create subagents.** This isn't `research` — one pass, optionally with web search, no splitting into sub-questions.
- **Don't build an artifact/HTML page.** This isn't a full lesson skill — a plain `.md` file, read in Obsidian or an editor.
- **Don't send this to the Library.** Don't write to `Library/sources/inbox/` or anywhere else in `Library/` — this material is embedded in session context (project code, a specific situation), so it doesn't meet the universality bar everything in the Library has to clear. If the user separately wants a universal, wiki-bound version — that's a different request, `note`, not this skill.
- **Don't paste the file's content into the chat.** That's what the file is for.
