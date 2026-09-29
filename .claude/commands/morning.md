---
description: Morning — shows today's blocks and minimum, sets the tone for the day
---

A short kickoff for the day. No filler.

## Steps

1. Determine today's date.
2. Read today's blocks from `Life/Calendar/` (files with `date:` = today, plus any recurring block matching today) and `Life/INBOX.md`. If `Life/roadmap/avatar.md` exists, read only its section 5 (resources and limits) — the user's dead hours and real capacity — and respect it when shifting or adding anything today.
3. Create/open today's note `Life/Journal/YYYY-MM-DD.md` (use the template `System/Templates/Journal-template.md` if the note doesn't exist yet) and fill in the "Today — blocks" section:
   - the list of today's blocks: time → title → **minimum**,
   - **mark the day's ANCHOR** (selection criteria: `/evening` step 4a) with `← ANCHOR` on its line. This is the one block `/evening` will judge the day's "minimum" against tonight.
   - In the "Daily habits" section, **append the anchor's name to the `⏱️` line**, e.g. `- [ ] ⏱️ Anchor started on time — Deep work 17:00`. Without the name this habit is ambiguous across multiple blocks and can't be honestly checked off.
   - **If the day has no anchor** (only mandatory blocks, e.g. a work shift + basic upkeep) — **remove the `⏱️` line** from the habits section. A habit that's physically impossible to do would drag down the percentage and the heatmap for no reason. Tell the user plainly that today rests on the fixed habits instead (e.g. a short walk, reading).
4. **If the plan needs to shift** (the user woke up later, something came up, a block no longer makes sense at that time) — shift it, but:
   - **let the user choose, don't decide alone.** Use `AskUserQuestion` with ready-made options: what gets cut, what gets moved, what falls out. Don't ask an open "what do we do?"
   - update the files in `Life/Calendar/` (times, `date:`, filename if the day changes) — not just the table in the journal,
   - a bumped block has to land somewhere — a new date, or back into `Life/INBOX.md`. Nothing disappears silently.
   - if a task outside the plan came up, add it to `Life/INBOX.md` too (tagged `#scheduled`, since you're also creating an entry for it in `Life/Calendar/`).
5. **Save observations to `Life/Patterns/observation-log.md` — always, without asking.** Format: `Life/Patterns/README.md`, "one entry per day, two passes" section.
   - **Create today's entry at the BOTTOM of the file** (`### YYYY-MM-DD ddd`) — unless it already exists, in which case append to it. **Never two entries for one day.**
   - A `DATA:` line with the full set of fields: `sleep= wake= morning= start= planstart= blocks=?/N minimum=? gym=? phone=?`. Fill in only what you know this morning — **leave the rest as `?`, `/evening` will replace them.** Don't skip a field, even an unknown one.
     - `wake=` time the user got up (ask if not stated), `morning=` time this command ran, `planstart=` planned start of the first work block, `start=` actual start.
   - `⏱` — day-start slippage: wake time plan vs. actual, how many minutes after waking `/morning` ran (target: 15–30 min), first block's start plan vs. actual.
   - `⇄` — **every plan change made this morning, with a reason.** One line per change: what moved/was cut/was added, by how much, why, and **which time this is** (if the item had already been pushed before — that's the most valuable case, since it shows what consistently gives way).
   - `+` — what already worked this morning (e.g. `/morning` ran at all, waking on time). Log this as carefully as slippage, or the dataset comes out skewed.
   - Facts and measurements, **zero interpretation.** Don't promote anything to `patterns.md` — only `/evening` does that, at the threshold of 3.
6. Show the user, concisely:
   - the first block and when it starts,
   - **name the day's ANCHOR** — the one block `/evening` will judge "minimum for the day" against (selection criteria: `/evening` step 4a). State it plainly: "the day rests on this one." The user should know the criterion in the morning, not hear the verdict for the first time in the evening.
   - one sentence: what matters most TODAY (usually the next step on the current priority project — see `Life/roadmap/roadmap-brief.md`),
   - restate the minimum of the first block **and** the anchor's minimum (the user won't remember them — always give the content, not just the block's name),
   - if you rescheduled anything in step 4 — 2–3 lines on what and why. Don't ramble.
7. Nothing else. Don't plan the week here (that's `/weekly`), don't summarize the day (that's `/evening`).
