---
name: link-notes
description: Builds and verifies connections (wikilinks, block IDs, embeds) between notes in this vault, so the graph grows on its own instead of turning into a pile of loose files. Use when the user asks to "connect these notes," "link this folder," "build connections," "MOC," "block ID," "embed," "graph," or when you're creating a new note in a topic folder and need to wire it into the existing web. Includes a validator that catches dead links and misplaced block IDs.
---

# Linking notes in the vault

Goal: **an agent should be able to find context by grepping links instead of reading whole files**, and the user should see related material without hunting across folders.

Governing rule: **link concepts, not sentences.** One concept = one target note = one link at its first mention. That's the only thing that keeps this from turning into a mess once there are 50+ notes.

## Three levels — use the right one

| Level | Syntax | For |
|---|---|---|
| "Related" section | `[[note]]` + a description of **why** | Navigation. Always at the end of a note, additive. |
| Inline link | `[[note\|text]]` inside a sentence | A key concept, **first occurrence**, max ~4 per file. |
| Block ID + embed | `^id` and `![[note#^id]]` | A specific paragraph that recurs in two places. |

An embed (`!`) **displays** the content — use it instead of duplicating text. Always wrap it in a collapsible callout (`> [!info]- Title`) so it doesn't clutter reading.

## Process

### 1. Survey
List the files. Read the **content**, not the titles — connections have to be substantive (the same entities, the same mechanism, the same figure), not based on title similarity. If there are many files, work in batches of ~10–15.

### 2. Map the connections
Before you write anything, list out pairs: `A ↔ B, because <specific reason>`. If you can't write the reason, don't link it. Look for:
- the same example/data point appearing in two notes,
- a concept defined in one note and used in another,
- **contradictions between sources** — the most valuable case, always flag it to the user.

### 3. Write
- Frontmatter (tags, type, topic) — if the notes don't have it yet.
- A `## Related` section at the end, every link with a **why**.
- Block IDs only on paragraphs someone would actually cite.
- Embeds only where there's genuine content overlap.

**A block ID has to end its line.** For lists and quotes — on its own line after the block, with a blank line before it.

Prefer a script (prepend/append, or inserting after a matched line) over dozens of manual edits. Have the script report what it couldn't find.

### 4. Validate — ALWAYS, this is not optional
```bash
# Windows: `py` instead of `python3`
python3 .claude/skills/link-notes/validate.py "<folder>"
```
Catches: dead block references, dead wikilinks, **a block ID in the middle of a line** (Obsidian won't recognize it — easy to introduce while editing), duplicate IDs.

Fix misplaced IDs:
```bash
# Windows: `py` instead of `python3`
python3 .claude/skills/link-notes/validate.py "<folder>" --fix
```

### 5. A second pass — for substance
The validator checks syntax, not sense. After it runs, review your **own** links and ask:
- does every one have a real "why," or is some of it filler?
- did any note end up with 10 links (overload)?
- does an embed actually show the paragraph that explains the thing it's sitting next to?

Cut what doesn't pass. Five good links beat twenty automatic ones.

## Boundaries (from the vault's `CLAUDE.md` — these apply here too)

- **Don't touch without explicit instruction:** `Life/Notes/`, the journaling sections in `Life/Journal/`, filled-in frontmatter values, `roadmap-brief.md`.
- The user's own personal notes (profiles, plans): add **alongside** their content (callouts, a "Related" section), never rewrite their sentences or make decisions on their behalf.
- Changes are additive. Before a bulk operation, copy the affected files to a scratch location and diff afterward — expect zero deleted lines.

## Maintenance

The graph only keeps growing if every new note is wired in **at the moment it's created**: check whether a MOC/hub for the topic already exists, add a link there and in the new note's "Related" section. Otherwise, in a month, it's a pile of orphans again.

For a new topic folder: consider an `MOC - <topic>.md` note as a hub (a table of notes + topical paths + an index of key excerpts via block ID).
