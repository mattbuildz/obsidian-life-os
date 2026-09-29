# Calendar — how this works (format cheatsheet)

This folder is the **data source for the Full Calendar plugin**. Every block/event is its own note with frontmatter. The plugin reads the frontmatter and draws the calendar. Claude Code writes these files with the `/weekly` and `/evening` commands.

**You don't need to memorize this format** — you can click events by hand in the calendar view. This exists so Claude knows how to write them and so you understand what you're looking at.

## A one-off block (timed)

File name: `2026-09-21 Budget CLI — CSV import.md`

```yaml
---
title: Budget CLI — CSV import
type: single
date: 2026-09-21
allDay: false
startTime: "11:00"
endTime: "12:30"
---

**Minimum:** CLI reads one sample CSV export and prints total spend per category without crashing.
**Project:** Budget CLI (side project)
```

The text under the frontmatter is your own notes on the block — Full Calendar ignores it, but you see it when you click the event. **Always fill in a MINIMUM** (a concrete thing to clear), not "spend some time on X."

## A block as a task (to check off)

Add `completed: false`. Check it off in the calendar → the plugin stamps a date:

```yaml
---
title: Print lecture handouts
type: single
date: 2026-09-21
allDay: false
startTime: "12:00"
endTime: "14:00"
completed: false
---
```

## A recurring event (gym, a class, a shift)

File name: `Gym.md`

```yaml
---
title: Gym
type: recurring
daysOfWeek: [M, W, F]
allDay: false
startTime: "18:00"
endTime: "19:15"
startRecur: 2026-09-21
---
```

`daysOfWeek`: **U**=Sun, **M**=Mon, **T**=Tue, **W**=Wed, **R**=Thu, **F**=Fri, **S**=Sat.

Time format: `"HH:mm"` (24h) or `"9:00 AM"`. Date: `YYYY-MM-DD`.

## Important events — `important: true`

Add `important: true` to the frontmatter, and the event goes into the **red "MOST IMPORTANT TODAY" banner** in Life OS Hub — at the very top of Overview, above the project filter, plus into the "⏳ COMING UP (7 days)" section with a day countdown.

```yaml
---
title: Databases — assignment deadline
type: single
date: 2026-09-24
allDay: true
completed: false
important: true
---
```

**Criterion: rare and non-reschedulable.** Something that genuinely costs you if you miss it — not something you can just "do tomorrow."

Counts:
- doctor's appointments, exams, tests, defenses, submission deadlines,
- interviews, trial days, a first day at a job,
- club meetings, conferences, one-off events,
- trips, trains, weddings — anything with one specific time and zero slack.

**Doesn't count:** ordinary work blocks, the gym, meals, breaks, wind-down, anything recurring. If you mark everything, the banner stops meaning anything — that's its entire value.

Works for `allDay: true` and for timed blocks. The "coming up" window is counted from the day being viewed in Overview, so it shifts on its own every day.
