# Patterns — how this folder works

This folder is **raw data on how you actually function** — collected one entry a day, so that after 2–3 months you can pull conclusions out of it that a single day never shows.

Why it exists: observations like "today 4 blocks fell through because of some interruption" used to land as prose, in the "What didn't and why" section of the day's note. After 60 days that's 60 files of unstructured text nobody's going to analyze. This is the same data, in a format you can read in bulk.

## Two files, two different things

| File | What it is | Who writes it |
|---|---|---|
| `observation-log.md` | **Raw data, one entry per day.** Facts and measurements, zero interpretation. Grows forever, appended at the BOTTOM (chronological order — this is a time series, not a feed). | Claude: `/morning` opens the entry, `/evening` closes it |
| `patterns.md` | **Hypotheses that got confirmed.** Something only lands here once it's shown up **≥3 times** in the observation log. | Claude, but only on repetition |

The split is deliberate. One day is noise. Only repetition is a pattern. Without this boundary, `patterns.md` would fill up within a week with conclusions from single days that mean nothing.

## One entry per day, two passes (morning + evening)

Data about the day is produced at two different moments, and **both go into the same entry** — not separate files or folders. Reason: the most interesting number in the whole dataset sits exactly *between* them (the evening's plan vs. what's left of it after colliding with the morning). Splitting into two files means nobody ever compares them.

| When | What it appends | What it doesn't know yet |
|---|---|---|
| `/morning` | The day's header + a `DATA:` line with `sleep= wake= morning= start= planstart=` filled in, the rest `?`. Plus `⏱` lines for a late start and **`⇄` for every plan change made that morning.** | Whether the blocks happened, whether the minimum landed, how much phone time — all `?` |
| `/evening` | **Fills in the `?`s in the existing `DATA:` line** and appends `✗ ! +` underneath (plus `⏱` from the blocks' real times). | — |

**`/evening` doesn't create a second entry for the same day.** It first checks whether `/morning` already opened today's section: if so — it appends to it and swaps `?` for real values. If `/morning` didn't run, `/evening` opens the entry from scratch and writes `morning=no`.

## Entry format — and why it's shaped this way

Every entry starts with a `DATA:` line with the same `key=value` fields every time. That's so it can become a table/chart without reading the whole thing. An unknown field → `?`, don't skip it.

The rest are lines with a single-character prefix, so they can be pulled out with one `grep`:

| Prefix | Meaning | Example use in analysis |
|---|---|---|
| `⏱` | **time calibration** — plan vs. reality | "how long a given block actually takes," "how much you're typically late leaving" |
| `⇄` | **plan change** — what got moved/cut/added and **why**. Mostly written by `/morning`, since that's where the plan first collides with reality | "how often the day gets rearranged before it even starts," "which blocks always lose to others," "how many times something got pushed before it finally happened" |
| `✗` | **what fell through**, and at what time of day | "which hours are dead for you" |
| `!` | **trigger** — what specifically wrecked the day | "what derails you and how long it takes to recover" |
| `+` | **what worked** — not just failures, or the picture skews | "what conditions precede a good day" |

## How to use this two months from now

Tell Claude: *"analyze `Life/Patterns/observation-log.md` — find recurring patterns."* That's when it's worth asking things nobody has an answer for today:
- how long a block you budget `⌛2h` for actually takes,
- what time of day blocks happen, and what time they don't,
- what precedes a day where everything falls apart,
- whether an earlier wake-up actually changes anything, or just shifts the same problems,
- **how much of the evening's plan survives to morning** — and which kind of block always gets cut first when something has to give (`grep '⇄'`).

**This only works with honest data.** An entry saying "everything went fine" where it didn't poisons the whole dataset — and two months from now you get conclusions drawn from fiction.

## Related
- `CLAUDE.md` — vault map, this folder is described there
- `roadmap-brief` — the constitution: rules, phases, definition of done. Patterns exist to serve it, not replace it
- `Life/Journal/` — prose and journaling; this is where the numbers live. Don't duplicate one in the other
