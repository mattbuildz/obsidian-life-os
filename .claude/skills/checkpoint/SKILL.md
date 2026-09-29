---
name: checkpoint
description: Save a concise, distilled handoff summary of the current conversation to a file so a fresh chat (which burns far fewer tokens than resuming/continuing the old one) can pick up where this one left off. Use when the user says the current chat is getting expensive/long and wants to continue in a new chat, or explicitly asks to checkpoint, save context, or save the conversation state.
---

# Checkpoint — handoff summary for a fresh chat

## When to use this

The user wants to abandon the current (expensive, token-heavy) conversation and continue in a brand-new chat without losing context. Resuming/continuing the session reloads the *entire* history at the same token cost — this skill instead writes a short, distilled summary a new chat can read cheaply.

## Default location

`System/Checkpoints/summaries/`, resolved relative to the vault root (the directory containing the root `CLAUDE.md`) — ask once if you're unsure where that is. This is settled for **all** of the user's projects, not just this vault; don't ask where to save unless the user passed an explicit path. Full transcripts, if ever needed, go to `System/Checkpoints/full-chats/`.

## What to do

1. **Determine the target directory.** If the user passed an argument (a path), use it. Otherwise use the default location above.

2. **Write ONE markdown file**, named `<project-or-topic>_checkpoint_<YYYY-MM-DD_HHhMM>.md` (use the actual current date/time). Do not overwrite a prior checkpoint — each save is a new file, so the user keeps a trail if they checkpoint repeatedly.

3. **Content — keep it a distilled resume, NOT a transcript dump.** Aim for something a fresh model instance can read once and act on immediately. Include, in this order:
   - **Project / context** — one paragraph: what this is, where the code/project lives (an absolute path if outside this vault), what the goal is.
   - **Where to find durable context** — if the project already has living docs (a project instruction file, a brief/assumptions file, a changelog-style file), point to them by path instead of duplicating their content. Only duplicate content here if no such file exists.
   - **What happened in this session** — concise bullets of decisions made, changes applied, tests run and their outcomes, bugs found — things NOT already captured in a living doc. Skip anything already logged elsewhere; link to it instead.
   - **Current state** — the exact current state of whatever's being worked on (e.g. "file X now has version Y with changes A, B").
   - **Next step** — the one concrete thing to do next, precise enough that a fresh chat doesn't have to guess.
   - **Collaboration rules / feedback** — if the user has stated preferences for how you should work with them on this project (don't write their code for them, don't run expensive operations casually, etc.) and those aren't already in a project instruction file the new chat will auto-load, restate them here so they aren't lost.

4. **Tell the user, plainly, how to use it in the new chat**: open a new chat (in the same project directory if relevant, so the project instruction file auto-loads too), and paste something like "Read `<full path>` and let's continue from there." Give them the exact path to paste — don't make them hunt for it.

5. **Do not** try to resume/continue the old session as part of this — that is the alternative this skill exists to avoid.

## Style

- Match whatever language the conversation has been in.
- No filler, no restating things twice. If in doubt about whether something belongs in the checkpoint, ask: "would a fresh model instance need this to act correctly next turn?" — if no, cut it.
