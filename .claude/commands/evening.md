---
description: Evening — summarizes the day and plans/tunes tomorrow (the keystone habit, 10 minutes)
---

This is the **evening 10-minute planning habit** — the single most important habit in the roadmap brief (`Life/roadmap/roadmap-brief.md`). The rest of the system doesn't work without it. Be fast and concrete, don't ramble.

## Steps

1. Determine the **logical day** — don't just take the calendar date literally; check the current hour (`date +%H`):
   - **Before midnight, up to 4:59** (the normal time to run `/evening`) → today = today's calendar date, tomorrow = the next day.
   - **After midnight, 00:00–4:59** (running `/evening` before going to sleep, the day is still "in progress") → today = **yesterday's** calendar date (the day that's actually ending — that's the one you're summarizing), tomorrow = **today's** calendar date (that's what you're planning blocks for).
   - E.g. if the real clock reads Tuesday 00:40, logical "today" is Monday, logical "tomorrow" is Tuesday.
2. Read: today's note in `Life/Journal/YYYY-MM-DD.md` (if it exists), today's blocks in `Life/Calendar/`, `Life/INBOX.md`, and the relevant sections of the roadmap brief. If `Life/roadmap/avatar.md` exists, read only its section 5 (resources and limits) — dead hours and real capacity — before laying out tomorrow.
3. **Read ALL open tasks in `Life/INBOX.md`**, using its notation (legend in the file itself): `⌛time`, `📅deadline`, `⏳when-to-do` (set by a `/today`/`/tomorrow`/`/DD-MM-YYYY`-style command), `#tags`. Read the whole list, not just tomorrow's items — the list should be short enough that this is realistic. Line order in INBOX = **priority order**, set by the user by hand; don't reorder it yourself without a reason.
   INBOX has three sections under "To do" — **triage "New / untriaged" first**: move each raw item into "Project (goes into blocks)" or "Small / admin (outside blocks)".

   **3a. FIRST, settle what came due today. Always ask, never close something yourself.**
   Find every open task tagged `#scheduled` or `#top` whose date (`⏳`, or `📅` if there's no `⏳`) is **today or earlier**. These are things whose deadline just passed — skip this step and they sit in INBOX forever and the list turns into a mess.

   List them and ask directly, in this format:
   ```
   THESE TOP-PRIORITY ITEMS CAME DUE TODAY — did they happen?
     1. Renew the passport                          (due Jul 27)
     2. Cancel the unused subscription — deadline Dec 7 (due Jul 30, 2 days late)
   → done? (yes / no / numbers)
   ```
   Then, based on the answer:
   - **YES** → **delete the task line from `Life/INBOX.md`** (don't just check it off — the user wants it gone, not cluttering the list) and set `completed: true` on the matching file in `Life/Calendar/`. The calendar entry STAYS as a record that it happened.
   - **NO** → ask what's next: **reschedule or drop it?** Don't decide alone.
     - reschedule → get a new date from the user, update `⏳` in INBOX **and** `date:` in the file in `Life/Calendar/` (the file has the date in its name, so rename it too: `YYYY-MM-DD Title.md`).
     - drop → delete the line from INBOX and delete the matching file from `Life/Calendar/`, so it doesn't linger in "upcoming."
   - If nothing came due today — don't print an empty section, just move on.

   **3b. `#top` → give it structure and move it into the top-priority section. Always, without asking.**
   This is not about time blocks. It's about the red "🔴 TOP PRIORITY / ⏳ UPCOMING" section at the top of the dashboard, driven by `important: true` on files in `Life/Calendar/`. The user drops a task in loosely (often with a date months out) — your job is to turn it into a proper entry.

   For **every** open task tagged `#top`:
   1. Create a file in `Life/Calendar/` (format: `Life/Calendar/_README-format.md`) — named `YYYY-MM-DD Title.md`, frontmatter `type: single`, `date:` (from the task), `allDay: true` if it's a dateless reminder, `completed: false`, **`important: true`**. In the body, `**Minimum:**` as one sentence.
   2. If a task has both a `📅deadline` and an `⏳when-to-do`, use `⏳` as the entry's date (that's the action day), and mention the deadline in the body.
   3. **In `Life/INBOX.md`, swap the `#top` tag for `#scheduled`.** That's the only way the next `/evening` run knows this one's already been processed.
   - `#scheduled` = **don't touch.** It already has its entry — don't create a second one. Only exception: the user explicitly asks for the date to change.
   - If a task's date is unclear or missing — **ask for it**, don't guess or skip it. Without a date there's no entry to create.

   **3c. The rest of tomorrow's tasks (plus anything overdue) — SHOW them and ASK — don't decide alone.** List them numbered, with time estimates, in this format:
   ```
   FOR TOMORROW — put these into blocks? (yes / no / which numbers)
     1. Trim the hedge               ⌛5m   #home
     2. Rotate the API key           ⌛15m
     3. Prep for tomorrow's shift    ⌛30m  #work
     → suggestion: 1+2 together as one "Small tasks 20m" block
   ```
   Wait for the answer before laying out blocks. "yes" = all of them, "no" = none (they stay in INBOX), or the user can point to specific numbers.
   - **Group small tasks into one shared block** once they add up to ≥30 minutes total — at that point it's a normal block with a name and a minimum, not an afterthought. Under 30 minutes, tack them onto an existing block instead.
   - **Project tasks** → get their own block per the roadmap/priority (`⌛` → block length; `📅` → the closer the deadline, the higher the priority).
   - A task with no date → stays in INBOX by default, but if it fits tomorrow per the roadmap, add it to the list from 3b as a suggestion, marked "(no date)".
   - **Whatever fell through today** (a block not done, a task not checked off) → move it to tomorrow or the next sensible day, update INBOX. That's the whole point: the plan adjusts, nothing gets lost.
   - When giving a task a date in INBOX, write the **finished format** `⏳ YYYY-MM-DD` (not a shorthand command — those are for the user to type when capturing a task).
4. **Summarize today (short, plainly):**
   - What got done, what didn't and why. Update `Life/INBOX.md` (check off what's done, note what fell through).
   - **Issue a "minimum for the day" verdict — this is YOUR call, not the user's self-assessment.** Rules below (4a).
   - Write the summary into today's note in `Life/Journal/` (the "Day summary" section).

   **4a. The "minimum for the day" verdict — how to work it out.**
   The user answers factual questions ("what did you get done"), **you set the verdict.** Reason: on self-assessment, a day with three small wins and a skipped priority block tends to come out "counted" — that's exactly the mechanism that lets projects fall apart. The judgment weighs tasks, it doesn't count them.

   1. **Identify the day's ANCHOR** — the one block the verdict hinges on. Take the **most important discretionary block** (one the user could plausibly have skipped), following the priority order defined in `Life/roadmap/roadmap-brief.md` — resolve today's items tagged `important: true`/`#top` first, then the current-phase priority order, then small/admin items. Mandatory blocks (work, sleep, meals, commute) and blocks marked `optional: true` ("If there's energy —") are **never** the anchor — otherwise every ordinary day would pass itself and the metric would measure nothing.
   2. **Verdict = was the anchor's minimum met.** Every other block is a bonus, not the basis for the call. Three small things checked off with the anchor skipped = **no**.
   3. **Automatic "no", no discussion:** a skipped work/study commitment, or a missed `important: true` event (an appointment, an exam, a scheduled call) — these are non-negotiable, which is exactly why they got that flag.
   4. **A day with zero discretionary blocks in the plan** (e.g. a work shift plus basic upkeep) → the anchor is whatever fixed habit the user has committed to for such days (e.g. a short walk outside). Done = yes. Such a day is allowed to count — the point isn't that a day without deep work is automatically a failure, it's that the verdict needs *some* concrete anchor to hinge on.
   5. **Binary verdict (yes/no), justified in one sentence.** No "partially" — nuance belongs in "what went well / what didn't." If it came down to the wire, say so in the sentence, but keep the verdict hard.
   6. **Don't console and don't pile on.** "No" is information about the day, not a judgment of the user — after stating it, move straight to step 5 (tomorrow's plan), no moralizing.
   7. **Record the verdict in THREE places — they must agree**, or `Life/Patterns/` ends up lying:
      - `Life/Journal/YYYY-MM-DD.md` → frontmatter `minimum_done: yes|no`,
      - the same note → the "**Minimum done?**" line in "Day summary" (with the one-sentence justification + the anchor's name),
      - `Life/Patterns/observation-log.md` → the `minimum=` field in the `DATA:` line (step 6).

      **Do NOT add the verdict as a checkbox in "Daily habits."** That list belongs entirely to the user and drives the percentage and heatmap on the dashboard — adding an agent-filled row would mix their actual execution with your judgment and corrupt both metrics. (A settled decision — don't revisit it.)
   8. If the user **disagrees** with the verdict — hear them out and change it only if they give you a **fact you didn't have** (e.g. the anchor was in fact done, just not logged). "But I tried hard" on its own doesn't change the verdict — say so plainly and move on.
5. **Plan tomorrow — one day ahead:**
   - Take the NEXT concrete step on the current priority project (see "Current step" in `Life/roadmap/roadmap-brief.md`) plus whatever the user approved in step 3c. (Steps 3a/3b are a separate matter — they settle overdue items and create top-priority entries, not tomorrow's blocks.)
   - Lay out blocks with a **concrete minimum**. **Don't fill the day** — the "empty is OK" rule from `/weekly` applies here too (step 4; zero filler blocks, 30-minute buffer around every task, see the roadmap brief for how much room the core priority project gets on a day off, plus an optional "If there's energy —" block after other commitments, marked `optional: true`). Read the full rule there, it isn't duplicated here.
   - **Don't invent generic "downtime"/"free time"/"prep for X" blocks — including meals, breaks, hygiene, or sleep.** The user isn't a blank slate — they have studying, projects, and other things to do, and they know that better than you do. If real, meaningful time is left over without a clear purpose from INBOX/roadmap/conversation — **ask** what to put there, don't guess and don't invent something. Exception: the user explicitly says "leave it open" / "don't plan that" — then leave exactly one block as stated, without adding your own content.
   - Don't create a separate prep block for things that don't need one (e.g. an ordinary conversation about a shift) — add it as a note on the existing task instead of a new event.
   - Save blocks as files in `Life/Calendar/` (format: `Life/Calendar/_README-format.md`). A rare/non-reschedulable event (an appointment, an exam, an interview, a one-time event) → add `important: true` to the frontmatter.
   - Add them to the "Tomorrow" section of today's note in `Life/Journal/` too.
6. **Save observations to `Life/Patterns/` — always, without asking.** This is the data layer on how the user actually functions, collected for analysis after a couple of months. Format and rules: `Life/Patterns/README.md`.
   - **First check whether `/morning` already opened today's entry** at the bottom of `Life/Patterns/observation-log.md`. If so — **append to it and replace the `?` placeholders in its `DATA:` line with real values.** Don't create a second entry for the same day, and don't remove the `⇄` lines `/morning` wrote (that's data on what the plan looked like before it hit the day). If there's no entry yet, create one from scratch and set `morning=no`.
   - **The entry goes at the BOTTOM of the file** (it grows chronologically, not the other way around).
   - The `DATA:` line always carries the same fields: `sleep= wake= morning= start= planstart= blocks=done/planned minimum= gym= phone=`. **Unknown field → `?`, never omit it** — a missing field breaks parsing of the whole file. `morning=` is the time `/morning` ran, or `no` — the user is committed to running it 15–30 minutes after waking; this pairs with `/evening` and is a separate data point on whether the morning anchor is actually working.
   - Then lines with a prefix: `⏱` time calibration (plan vs. reality — **this is the most valuable data**, since block length and time of day are the user's known blind spot), `⇄` a plan change with a reason (`/morning` writes these in the morning; you only add rearrangements made during the day), `✗` what fell through + at what time, `!` the trigger that derailed the day, `+` what worked.
   - **Log `+` as carefully as `✗`.** A record of failures alone gives a skewed picture two months out and feeds exactly the "I'm behind" spiral this system is meant to counter.
   - Facts and measurements, **zero interpretation** — interpretation goes in `patterns.md`.
   - **Then check `Life/Patterns/patterns.md`:** does today's observation repeat something already in "In progress"? If so — bump its counter and add the date. On the **3rd occurrence**, promote it to "Confirmed" and note what it implies for planning. A new observation with no match → add it to "In progress" as 1/3.
   - **The threshold of 3 is hard.** Don't promote a pattern early "because it fits" — that threshold exists precisely so `patterns.md` doesn't fill up with conclusions from single days.
   - If a "Confirmed" pattern stops holding — move it to "Refuted" with a date and reason. Don't delete it.
   - Take "Confirmed" patterns **into account when laying out blocks in step 5** — that's the whole point of collecting them. But don't let a pattern override a closed decision from the roadmap brief; if a pattern contradicts the brief, say so to the user instead of deciding it yourself.
7. One sentence of plain truth to close: did today hold to the plan or not — no flattery, no pile-on.

Hard rules: minimum not maximum; no new projects/topics (see the roadmap brief); the priority order for conflicts is defined in `Life/roadmap/roadmap-brief.md` — don't hardcode or guess it here.
