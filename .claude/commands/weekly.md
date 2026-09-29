---
description: Full weekly review — retrospective, an interview about the coming week, only then blocking time
---

**One command for the whole week:** first a retrospective, then an interview with the user, and only at the end, planning. Role and rules: `Life/roadmap/roadmap-brief.md`.

**First, the facts — computed by code, not by eye:** run `python3 System/scripts/vault-status.py --write` (`py` on Windows) and read its output. It reports the avatar's age, days since the last `/weekly`, gaps in the daily loop, INBOX and Library queues. Say every `WARN` line in one sentence at the start, once, and go on; the same script feeds the Life OS Hub Status tab.

**Who the user is: `Life/roadmap/avatar.md`** (written by `/avatar`; skip this if the file doesn't exist). Read it up front. It exists so your questions can be **precise** — name their actual commitments, limits, and unfinished items instead of asking generic ones — and so the week's plan fits how they really work.

## Step 1 — Retrospective on the past 7 days

Read `Life/Journal/` for the last 7 days (frontmatter: `minimum_done`, `core_hours`, `phone_h`, `gym`, `mood`). Count and show concisely:
- how many days the minimum was met (X/7),
- total core hours vs. the target from the roadmap brief,
- gym sessions (X× vs. target),
- one pattern worth naming (e.g. "the core project slips in evenings, goes easier in the morning" — only if it's actually visible in the data, not forced).

No moralizing. Facts, one sentence of conclusion.

## Step 2 — Project status

Start from the `Current step` lines in the brief's section 6 and what actually happened to each.

Check against the definition-of-done in the roadmap brief: what moved on the core priority project(s) versus what was assumed a week ago. If a project has been stuck in the same place for more than 2 days — say so plainly.

## Step 2b — Library: measurement and an ingest block

**Measurement (30 seconds, just counting):**

```bash
ls -1 "Library/sources/inbox/"*.md 2>/dev/null | wc -l
rg "^## \[" Library/log.md | tail -7
```

State the **ratio of clipped to ingested** for the past week, in one sentence. The read is binary, no hedging:
- **60:4** — the filter is working, that's fine.
- **60:55** — nothing got filtered, just moved up a layer. Say that plainly.
- **queue growing, ingests at zero** — `sources/inbox/` has become exactly the kind of backlog this system exists to avoid. That's a signal to scale the Library back in `roadmap/backlog.md`, not to add another block to it.

If a pattern shows up (3rd repeat) — one sentence to `Life/Patterns/`. The log itself stays in `Library/log.md`, **don't copy it into `Life/Patterns/`**: the log is events, `Life/Patterns/` is one entry per day about the user.

**Ingest block for the coming week — hard rules, driven by data, not intent:**

- **Only on a day off, as the first block of the day.** This follows a pattern confirmed in `Life/Patterns/patterns.md`: a project block scheduled after other commitments tends not to happen — that's a scheduling fact, not a motivation problem.
- **Minimum: ONE source ingested end-to-end.** Not "30 minutes" — the minimum has to be checkable, not time-based.
- **The Library is a lower priority than the core project(s)** (see the roadmap brief). This block **never** eats into the core project's block, and neither does dashboard/tooling work. If there isn't room for both in a week — the Library block drops, no debate.
- If the queue is empty — **don't schedule this block at all.** An empty ingest block is decoration.

## Step 3 — Interview about the coming week (MANDATORY, before blocking anything)

**You don't plan from the files — you plan for the user.** The files (INBOX, roadmap, calendar) say what's recorded; they don't say what actually matters to the user this week, what's weighing on them, or what they have energy for. There's no real plan without the interview — the user wants this explicitly. `/evening` runs a shorter version because it only plans one day and there's less to establish; this is a full week, so it's the full interview.

**How to run it:** ask one question at a time, not a wall of text; for each one, offer **your own recommended answer** for the user to confirm or correct; a vague answer ("I guess", "we'll see") gets pushed on until it's concrete. Before this, **read** INBOX, the roadmap, `Life/Calendar/` for this week and next, and `Life/Patterns/` — only ask about what you can't infer from the files; propose the rest and ask for confirmation. Use structured options where a choice is possible; ask an open question where it's genuinely about how they're feeling.

**Areas — go through all of them, every time.** For areas 4, 5 and 8, where `avatar.md` already has the answer, **state what it says and ask a one-sentence "still true?"** (e.g. "avatar: job Tue/Thu/Sat 12–20, about 5 focused hours a day — still right?"). A "no" opens the full question; a "yes" closes the area. Never skip an area silently on the strength of the file — it goes stale.
1. **Goal for the week** — one sentence: "this week is a win if…". Priority #1 (one thing) and #2.
2. **Tasks** — open items from INBOX and anything hanging from the retrospective: what MUST land, what can wait, what gets cut. Anything pushed ≥2 times already: **do it / cut it / break it down** — don't push it again without a decision.
3. **Deadlines** — hard ones (dates, appointments, payments and subscriptions, coursework) and soft ones; plus what's waiting in the week **after** this one (a two-week horizon), so nothing arrives as a surprise.
4. **Fixed commitments and availability** — work/school (confirm days and hours, schedules can be wrong), travel, people, which days are actually free.
5. **State and energy** — sleep, mood, how much real capacity there is this week, which times of day are dead. Offer patterns as a hint, not a verdict.
6. **Risk** — what hasn't worked in recent weeks and what's supposed to be different this time; where the plan is most likely to break.
7. **Outside the core** — gym, people, things they want to get off their mind this week; what to deliberately leave open.
8. **Core priority project(s)** — actual current state and what's realistically deliverable; not a month-old assumption.
9. **After other commitments** — whether to offer optional low-effort blocks, and what kind (only genuinely low-effort, agent-assisted tasks).

**Close with a summary:** "Here's what I've got: goal for the week, priority #1, deadlines, fixed points, what's out" — the user confirms or corrects it. **Only after confirmation do you move to step 4.** Shorten the interview only if the user says outright they don't have time for it.

## Step 4 — Plan the coming week

Plan **from the interview answers (step 3)**, not from the files alone. This is the only place the rules for laying out a week live.

1. Determine today's date and work out the dates for Monday–Sunday of the coming week.
2. Read (if you haven't already, before the interview):
   - `Life/roadmap/roadmap-brief.md` — current phase, priorities, project definitions-of-done, the week's structure.
   - `Life/INBOX.md` — the user's concrete tasks. Triage "New / untriaged" first into "Project (goes into blocks)" or "Small / admin (outside blocks)". Read the notation (legend in INBOX): `⌛time` (block length), `📅deadline` (priority by proximity), `⏳when-to-do`/date tags (which day). **Project** items get laid out across specific days per those fields plus the roadmap. **Small/admin** items don't get their own project blocks — bundle them into one short shared slot (e.g. "Admin" 15–20 min) on a day that fits their `📅`/`⏳`, or leave them for whenever there's a gap.
   - `Life/Calendar/` — existing events (especially recurring ones: gym, classes) so nothing overlaps.
3. Lay out blocks per the roadmap brief's rules — priority #1 from the interview gets the week's best window; zero new projects without a definition-of-done + GitHub + README on the previous one:
   - **Priority order when things conflict is defined in the roadmap brief** — apply it, don't hardcode or reinvent it here.
   - Work/study days: default to zero extra blocks (see "empty is OK" below); if the window before a fixed commitment allows it, the core project can get a block there. Days off: the core project gets a substantial single block, the rest comes from what's actually pending (INBOX, roadmap) — not ten hours straight of any one thing.
   - Every block has a **concrete MINIMUM** (e.g. "feature X works against three test cases"), not "spend some time on it." This is a hard rule — see the roadmap brief.
   - Leave free time, gym sessions, real breaks. Any hours beyond the core plan go only to things already on the list — zero new topics.
   - **Empty is OK — do NOT plug the gaps.** Only write in real tasks and events. **Zero filler:** no "free time"/"downtime"/"evening" blocks, no meals, breaks, hygiene, sleep, commutes, warm-ups. An empty window on the calendar is a deliberate gap, not a hole to patch. This applies to time before and after fixed commitments too — get up, go, come back, and that's it.
   - **Leave a 30-minute buffer before and after EVERY task** (don't put two tasks back-to-back) — a task running long or needing follow-up is the norm, not the exception. Exception: fixed-time events (work, appointments, scheduled calls) sit exactly where they sit.
   - **An empty window on a day off is a mistake as long as there are unfinished tasks.** "Empty is OK" is about not padding with filler, not about having no work to do. Before leaving a window longer than the 30-minute buffer open on a day off, check INBOX and the plan: every unfinished task gets **real time** (lengthen blocks using the time-calibration data, add another task from the list) and a spot in the day, not "sometime this week." The only things that stay empty are the tail end of the day, the 30-minute buffers, and time the user explicitly doesn't want filled.
   - You can still **ask** the user when you don't know whether something belongs in the plan — don't guess and don't invent it from nothing.
4. Save each block as its own file in `Life/Calendar/`, in the format from `Life/Calendar/_README-format.md`:
   - filename: `YYYY-MM-DD Short title.md` (no `:` or `/` in the name),
   - frontmatter `type: single`, `date`, `startTime`, `endTime`; `optional: true` for an "If there's energy —" block,
   - **`important: true`** if this is a rare/non-reschedulable event (see the "Important events" section in `Life/Calendar/_README-format.md`) — it then surfaces in the dashboard's top-priority banner,
   - in the body: `**Minimum:**` and `**Project:**`.

## Step 5 — Summary

**First, keep the brief's section 6 true.** The brief's `## 6. Now` (Current step, Weekly targets, Day off) is the one part of the brief `/weekly` may change. From Steps 1–2, propose the update in a few lines — the current step advanced or replaced, targets that the data says are wrong (state the numbers) — and ask. Write it **only after the user confirms**, and only that section: copy the brief to `Life/roadmap/roadmap-brief.previous.md` first, keep every other section byte for byte, and set `updated:`. If the status output said the active phase is past its target date, say so in one sentence and point to `/roadmap` — the definition-of-done review is that skill's job, not this one's. Skip all of this if section 6 is empty (the brief is still a stub).

A short table: day → blocks → minimum, plus one sentence of retrospective from Step 1. Ask what to adjust. Don't create new projects outside the roadmap (a new idea defaults to **no** — see the roadmap brief).

**During the week:** when something falls through (illness, a sudden schedule change, a task running long), the user runs `/evening` or just says so — then you shift blocks, you don't restart the plan from zero. A week is a living skeleton, not poured concrete.

Tell the truth. If the week is overloaded or breaks the rules (e.g. ten hours straight, a new topic squeezed into the margin) — say so and cut it down.

When the review is finished, record it: `python3 System/scripts/vault-status.py --record weekly` (`py` on Windows). That is what the next `/weekly` and the Status tab count days from.
