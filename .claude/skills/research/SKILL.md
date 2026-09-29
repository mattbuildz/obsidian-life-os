---
name: research
description: Deep, multi-source web research — breaks a question into a few independent sub-questions, checks them in parallel with several subagents (WebSearch + WebFetch), then synthesizes one answer with a source list and any contradictions called out. This is the Research-mode pattern from claude.ai, brought into Claude Code. Use when the user wants a thorough/deep investigation, says "check this properly," "do a deep dive," "look into X," calls `/research`, or asks about something where confirmation from multiple sources matters (a contested topic, something time-sensitive, a fact-based decision). Do NOT use it for a simple question with one obvious answer — a plain WebSearch is enough there, without the subagent machinery.
---

# /research — multi-source deep research

Modeled on the architecture Anthropic described for Research mode in their chat product: a lead agent (you) breaks the question into pieces, several subagents search **in parallel**, each on its own piece, and return condensed results (not raw pages) — you synthesize and cite. The difference from an ordinary `WebSearch` call mid-conversation: **several independent angles at once**, not one thread searching sequentially.

## When to use this, and when not to

**Use it** — the question has several independent angles, the topic is contested or changes quickly, or the user explicitly wants thoroughness ("check this properly," "do a deep dive," `/research X`).

**Don't use it** — the question has one simple, checkable answer (a date, a command, a single fact). A plain `WebSearch` in the conversation is enough and cheaper. Don't fire up the subagent machinery "just in case" — it costs real tokens and the user's time, which is exactly what the vault's token-discipline guidance warns against.

## Process

### 1. Break down the question

Before running anything, split the topic into **3–5 independent sub-questions** that together cover it without much overlap. A typical breakdown for "is X safe/good":

- what it is, its history, who's behind it
- current state / known issues / anything that recently changed
- what the community says / independent reviews
- alternatives and how they compare

For simpler topics, 2–3 sub-questions are enough. Don't stretch to 5 if the topic doesn't need it.

### 2. Parallel subagents

In **one message**, launch as many `Agent` calls (`subagent_type: general-purpose`) as you have sub-questions, each with `run_in_background: false`. That's what makes them wait for a result before you proceed, while still running concurrently rather than one after another — see the `Agent` tool's own description of that flag.

Each subagent prompt must be **self-contained** — the subagent doesn't see this conversation:

- the user's original question, for overall context
- the specific sub-question this subagent owns
- instructions: use `WebSearch` to locate sources, then `WebFetch` on the 2–3 best/most primary ones (official documentation / primary source > independent review > blog post > SEO farm). If the topic is time-sensitive, have it check **publication dates**.
- a response limit: **a concise bulleted summary + a list of URLs with titles**, not raw page content. This compression is what keeps your own context from filling up — the subagent reads a lot, returns little.
- if the topic is contested: ask explicitly for where sources disagree, instead of smoothing it into one version.

### 3. Synthesis

Once all the subagents are back:

- compare results — look for **contradictions between them**, that's the most valuable signal; always surface it to the user instead of smoothing it over
- drop duplicate sources
- write one coherent answer, no filler — tell the truth, don't flatter (see `COLLABORATION.md`)
- end with a `Sources:` list with markdown links to every page actually used (same convention as a plain `WebSearch`)

### 4. Saving to the vault — only on explicit request

By default you answer in the chat and save nothing. If the user asks you to save it:

- research about a **tool or something to consume** → `Life/Resources/Tools.md` (or `Recommendations.md` if it's more a consumption thing), format: what it is + **why it matters to them**, per the goals in `Life/roadmap/roadmap-brief.md`
- **technical/how-to** research → a new note in `Life/Notes/programming/`, in the style of the existing notes: commands/facts + **why**, not an encyclopedia entry
- anything else → ask where, don't guess — `Life/Notes/` is human territory, don't touch it without explicit instruction

## Boundaries

- Subagents get `general-purpose` access (every tool), but scope their task to research in the prompt — don't have them edit or save anything.
- Don't launch more than 5 subagents at once without a real need — that's the upper bound from the underlying architecture, not a starting point.
- If the topic touches money, health, or safety and the subagents disagree — say so plainly to the user, don't force a single smooth answer by picking the "majority" version.
