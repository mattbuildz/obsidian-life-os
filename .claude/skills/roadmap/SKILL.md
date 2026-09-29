---
name: roadmap
description: Builds Life/roadmap/roadmap-brief.md from your avatar — phases with a definition of done, priority order, closed decisions, what to do now. Run again at the end of a phase to review it.
disable-model-invocation: true
---

# roadmap — writes and reviews `Life/roadmap/roadmap-brief.md`

**Input:** `Life/roadmap/avatar.md` (written by `/avatar`). **Output:** the roadmap brief, the file `/morning`, `/evening`, `/weekly` and the Library read as the constitution. Skeleton: [template.md](template.md). Content and completion criterion per section: [sections.md](sections.md) — read it before step 3.

**Voice:** plain words, as in `/avatar`. No commands, git, or file-format talk unless the user asks; name a file only where they need to find it ("the backlog", "your brief").

## Rules that hold in every mode

- **You propose, the user chooses.** Offer concrete options with a stated recommendation and a cost; never an open "what do you want to do?", and never a plan built silently. When the avatar gives nothing to build an option on (a next phase, a first step), ask one open question, then turn the answer into options. Lines marked *planning read* in the avatar are hypotheses: propose from them, do not take them as given.
- **The avatar is the input, not something to ask again.** Ask about a gap in it one question at a time, only when a decision needs it.
- **Limits are hard.** Weekly hours planned never exceed the free hours in the avatar's section 5, and the avatar's non-negotiables (section 8) are written as *protected time*, never traded for a project. When the user says they will find more hours, the plan still runs on the number in the avatar: if the real number changed, `/avatar` (update mode) changes it and `/roadmap` reruns from there.
- **The verdict is yours.** Whether a definition of done is met is settled from the facts the user gives, criterion by criterion. Change a verdict only when they give a fact you didn't have, never because they push back.
- **Write only after confirmation, and show the change first** (before / after) for anything that replaces existing text.

## Steps

### 1. Explore

Check in this order — the first check can end the run before any mode is chosen:

1. **John first.** If `System/demo/.demo-active` lists `life`, the brief, calendar and inbox in the vault belong to the sample person John, and the brief would otherwise look like an existing one to the mode check below. **Refuse to continue.**
   - Run `python3 System/demo/demo.py clear` (`py` on Windows) as a dry run, so the offer can quote its counts.
   - Say in plain words, without command names: writing a brief next to John's data would mix two people in a file the coaching commands take as truth; his files go to the system trash and can be brought back; offer to clear them now. Ask about `Life/` first (recommended: clear); only on yes ask whether the Library sample goes too (recommended: clear). Then run it again with `--apply` (add `--keep-library` when the Library stays), **read the brief again — it is a stub now — and go on to check 2.**
   - **On no, or a push:** restate the reason once in a sentence; after a second push give the plain answer to "why does it matter" — the coaching commands would follow John's brief, not theirs — and leave the offer open. A push is not a new fact: do not repeat the offer again, do not continue. Nothing is written, and the run ends.
   - (This is deliberately stricter than `/avatar`, which continues with a warning: `/avatar` writes only its own new file, while this skill overwrites the brief John's commands read.)
2. `Life/roadmap/avatar.md`. Missing → stop and say plainly that `/avatar` comes first. `status: draft` → say so, and continue only if the user wants to.
3. `Life/roadmap/roadmap-brief.md`: missing, or `status: stub` → **create mode**. Anything else → **review mode** (below).
4. In create mode also read `Life/roadmap/backlog.md` and `Life/Patterns/patterns.md` (confirmed patterns only), and the tags in `Life/INBOX.md` for projects already named there.

**Done when** the mode is stated to the user in one sentence — in review mode, in the same message as the first content (the phase and its days left) — and they said go, or the run ended at check 1 with nothing written.

### 2. Propose (create mode)

Read [sections.md](sections.md), "Variants". Present **2–3 variants**, each in a few lines: what wins a collision, the phases in one line each, the weekly hours split, and what it gives up. Recommend one, tied to something concrete in the avatar. Variants must be really different — a different top priority, or an hours split that differs by a quarter or more.

**Done when** the user picked a variant or told you how to merge two, and you restated the result **with what it gives up** in one sentence and got a "still this one?" yes.

### 3. Write, section by section

Before the first write of this run, copy any existing non-stub brief to `Life/roadmap/roadmap-brief.previous.md` (one copy, replaced each run). Corrections made in step 4 belong to the same run and do not copy again.

Take sections 3, 4, 5, 6, then 1 and 2, as [sections.md](sections.md) describes them, one section per message-and-confirmation. For each: propose, adjust, confirm, write into the brief with `status: draft` (create it from the template on the first section, without the template's authoring comment). `created:` is the date of the first write and `updated:` the day of the last write that changed the text.

**Done when** all six sections are written and confirmed.

### 4. Review and close

Paste the whole brief into the chat. Ask what is wrong or missing and apply corrections; when the user approves the result, set `status: active`.

Close with two lines, in plain words (review mode closes with the one line in step 7):
- `/evening` and `/weekly` read this from now on; `/weekly` proposes changes to section 6 (the current step and the weekly targets) each week, and only that section.
- Run `/roadmap` again when a phase ends — it checks the definition of done, goes through the backlog and opens the next phase.

**Done when** the user has read the full brief and approved it.

## Review mode (the brief exists)

Purpose: close the active phase honestly and open the next. Details per step: [sections.md](sections.md), "Review".

1. Show the active phase, its target date, and how many days are left or overdue.
2. Go through its definition of done one criterion at a time; the user gives facts, you give the verdict for each. Then read section 6 against those facts: a `Current step` that is already behind them (it names work the facts show finished) is stale and gets fixed in step 7.
3. All criteria met → mark the phase `done (YYYY-MM-DD)` with today's date, strip personal names from its row, and go on to step 4. Not met → say which ones, and offer three options with a recommendation: extend the date, cut the scope, or split the phase. **Extend or cut:** the phase stays `active` with its new date or a smaller DoD — skip steps 4–6 and go to step 7, changing only the phase row and a stale section 6. **Split:** the part that shipped closes as `done`, the rest becomes the next phase — continue with step 4.
4. Go through `Life/roadmap/backlog.md` item by item: pull into the next phase, keep, or drop. A pulled or dropped item leaves the backlog file; nothing is written to it until the step-7 confirmation, together with the brief.
5. Open the next phase: expand its one-liner to a full row (goal, definition of done, date), set it `active`, rewrite section 6 for the new phase (its step's date avoids the avatar's deadlines and crunch periods; say why you chose it). If no `next` row is left, offer to define the following `later` phase now — otherwise it stays `later`. Then read sections 4 and 5 for the closed phase's name or project ("the pricing phase") and propose rewording; the changes join the before/after.
6. Propose new closed decisions from what the phase showed; each is answered on its own, as in section 5 of `sections.md`.
7. Show before/after for every changed section (the phase table, and section 6 when the step or targets moved). After the user confirms, copy the brief to `roadmap-brief.previous.md` and write. Close with one line: what changed, and that `/roadmap` runs again at the end of the phase. `status` stays `active`.

In review mode only: if the avatar's `updated:` is newer than the brief's, say so and offer to re-check sections 1 and 4 against it.

## Ownership

The brief belongs to the user. Outside a run of this skill, an agent changes it only on explicit instruction — the one standing exception is `/weekly`, which may propose and, after confirmation, write section 6.
