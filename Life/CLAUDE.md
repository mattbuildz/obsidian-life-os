# Life zone

Day-to-day operations: what the user is doing today and this week. Changes daily. This is where `/morning`, `/evening`, and `/weekly` work. Router with rules shared across the whole vault: `../CLAUDE.md`.

## What's where

| Place | What it is | Rule |
|---|---|---|
| `roadmap/avatar.md` | Who the user is: field, goal and horizon, skills (level + evidence), commitments, limits, how they actually work, unfinished business, non-negotiables. Written by the `avatar` skill (`/avatar`), an interview. | Read it before coaching or planning instead of guessing. **After its first write it is the user's** — change it only on explicit instruction or inside a `/avatar` run. Headings are English on purpose; other skills find sections by name. |
| `roadmap/roadmap-brief.md` | The user's constitution: context, collaboration rules, phases, projects + definition-of-done, closed decisions | Read it for coaching/planning. When asked "what should I do now," answer from the current phase — don't guess. Written and reviewed by the `roadmap` skill (`/roadmap`) from `avatar.md`; `/weekly` may change **only section 6** (`Now`), after the user confirms. **Sacred** — do not rewrite without a strong reason. |
| `roadmap/backlog.md` | Ideas parked out of the user's head, **not** meant for execution now | New idea/distraction → one line here. Review at the end of a phase. |
| `INBOX.md` | Task brain-dump (`⌛time 📅deadline ⏳when #project`) | Triage lightly, don't over-polish. The "To do" section is the **last** one in the file (quick-capture appends to the end). |
| `Calendar/` | Source of truth for the calendar plugin. Blocks = files with frontmatter | **Collaboration — you write blocks here** via `/weekly`, `/evening`. Format: `Calendar/_README-format.md`. **Empty windows are fine** — don't stuff them with filler; leave a 30-minute buffer around tasks. |
| `Journal/` | Daily notes: metrics (frontmatter) + journaling | Treat the journaling section and any filled frontmatter values as **sacred** — don't overwrite them. You may write the "blocks/plan" section. Template: `../System/Templates/`. |
| `Patterns/` | **Data on how the user actually functions.** `observation-log.md` = raw measurements, one entry per day; `patterns.md` = hypotheses confirmed **3+ times**. Goal: after a couple of months, real conclusions about block lengths, dead hours, and triggers. | **You write here on every `/morning` (step 5) and `/evening` (step 6).** One entry per day, two passes: morning opens it (day start + `⇄` plan changes, everything else `?`), evening closes it (`?` → real values, plus `✗ ! +`). **Never two entries for one day.** Format: `Patterns/README.md`. The log gets facts and measurements only; interpretation only after the 3rd repeat (only `/evening` promotes something). The threshold of 3 is hard. When laying out blocks, take "Confirmed" patterns into account. |
| `Notes/` | The user's free-form notes about their life | **Human. Do not write here without an explicit instruction.** |
| `Resources/` | Recommendations from outside. `Recommendations.md` = what to listen to/read/watch (`🎧 background`, `📖 reading`, `🎥 watching`, `❌ what not to`). `Tools.md` = software/configs to install. | **Append here when the user asks for a recommendation of something to consume, or a tool.** Consumption → `Recommendations.md`, app/config → `Tools.md`. Append to the existing section, don't multiply files. Every entry: what it is + **why it matters to them**. Don't delete the `❌` section. |

## Hard path dependencies

Daily Notes, the calendar plugin, quick-capture, and the vault's companion plugin all have these paths hardcoded. Renaming a folder here means updating it in all of them.

## Coaching principles (break only for a deliberate reason)

How to behave in general → `../COLLABORATION.md` (single source of truth — not duplicated here). Only what's specific to this zone:

- **Minimum, not maximum.** Every block has a concrete, checkable minimum. Minimum done = day counts.
- **Priority order when things conflict is defined in `roadmap/roadmap-brief.md`** — read it there, don't guess it or hardcode it here.
- **Zero new projects "because it might be useful."** A new idea → `INBOX`/`backlog`, then back to the current block.
- You may drop a file into `../Library/sources/inbox/` — and nothing else in the Library (zone contract in the router).

### Day/week planning mode (`/evening`, `/weekly`)

Specific to reviewing or laying out a day/week — not relevant to ordinary work elsewhere in the vault.

- **You prepare options, the user chooses.** Offer ready-made options — concrete choices with a time estimate and a stated recommendation. Not an open "what do you want to do?", and not silently building the whole plan without asking. *Why:* the point of delegating planning is that the user hands over structure and gets proposals back — the weight of the **decision** is yours, the weight of the **choice** stays theirs. Options must be real, not decorative.
- **Always state what the minimum was.** When checking "was the minimum done?" — first pull and state the actual minimum from the relevant calendar block or daily note; the user won't remember it, and isn't supposed to. **The done/not-done verdict is yours, not theirs** — they report facts, you weigh them by how important the task was, not by how many boxes got checked. Change the verdict only when they give you a fact you didn't already have, never because they push back. **Consequence:** nothing filled in by an agent belongs in the user's own habit checklist — that list drives their personal tracking and has to measure them, not your judgment. More generally: any tracker of the user's own behavior belongs to the user, not to you. *Why:* self-assessment on a day with three small wins and one skipped priority tends to read as "the day counted" — that's the exact mechanism that lets projects slide.
- **Don't guess block length — a known blind spot.** Don't treat a task's declared time estimate as accurate, and don't treat "there's a free window" as justification for putting something there. When reviewing a day, compare the declared time against the actual time and say plainly when they diverge. For an unfamiliar task type, ask rather than guess. *Why:* a wrong time budget means the block doesn't finish, which starts an "I'm behind" spiral — the exact thing this system exists to prevent. Repeated divergence on the same task type is exactly the kind of thing that earns a confirmed entry in `Patterns/`.
