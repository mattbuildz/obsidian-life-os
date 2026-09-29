---
name: avatar
description: Interview that writes Life/roadmap/avatar.md — who you are, where you're heading, what you can do, what limits you. Base for a roadmap. First run also clears the demo data.
disable-model-invocation: true
---

# avatar — an interview that produces `Life/roadmap/avatar.md`

**Output:** one file, `Life/roadmap/avatar.md`, in a fixed section order (skeleton: [template.md](template.md)). The coaching commands, the Library, and a later roadmap skill read it instead of guessing who the user is. It ends at the avatar: **no roadmap, phases, or priorities here** — that is a separate step, and the avatar is its input.

**Content of the interview:** [sections.md](sections.md) — questions, options, and completion criterion per section. Read it before step 3.

**Voice:** plain words. The person may be a nurse, an accountant, a student, a developer; commands, git, and file formats stay out of what you say to them unless they ask (the opening names the one file, nothing more).

## The one rule that decides scope

**Ask only what would change a priority or a week's plan.** Test each question against it before asking. Ask for **outcomes, never methods** — "what should be true in a year", not "how will you get there"; the how belongs to the roadmap.

- **In scope:** field and stage of life, goals and horizon, skills, fixed commitments and their schedule, real limits (hours, energy, slack), how work actually goes, what is unfinished, what stays every week.
- **Out by default:** relationships, family, health details, exact money. These enter the file only as a constraint the user volunteers ("Saturday evenings are taken", "I run on about 5 focused hours a day"). Take the constraint as stated and move on; ask nothing about the story behind it.

**Write the effect, never the cause.** A constraint enters the file as what it does to time or capacity — "Tuesday 17:00 taken", "Sundays taken", "money: tight" — and stays free of the reason behind it (no diagnoses, treatments, people, amounts). A topic the user puts off the table is recorded in section 9, in their own words. Scheduling detail (which days, how long) is in scope; the reason for it is not.

**When the user volunteers more than that:** acknowledge in one short sentence, write only the effect, and go back to the open question. No follow-up on the story.

The rule limits what you *ask* and which *cause* you record; the user's own answer to an in-scope question is kept as said.

The user's own words are the facts. Interpretation goes on a separate, labelled line (the *planning read*) so it stays a hypothesis for the user to confirm or correct.

## Steps

### 1. Explore, then open

Check three things and state them to yourself before speaking:
- `Life/roadmap/avatar.md` exists → **update mode** (see below). Otherwise **create mode**.
- `System/demo/.demo-active` exists and lists `life` → **demo mode**: everything in `Life/` and `Library/` is a sample person's data. Take no hints from it.
- Neither demo nor empty: a lived-in vault. Structured files (`Life/Calendar/`, `Life/INBOX.md`, `Life/Patterns/`, `Life/roadmap/`) may seed hypotheses ("I see Tue/Thu/Sat 12–20 blocked — job?"), each confirmed before it goes in. `Life/Journal/` and `Life/Notes/` are read only after the user says yes. In an empty vault, interview from zero.

Then open with four sentences: what this produces and what reads it; the scope rule above, in plain words; every question and every section can be skipped; about 20–25 minutes, saved after each section so stopping loses nothing. End with a go/no-go question.

**Done when** the user has heard all four and said go. Nothing in step 2 runs before that.

### 2. Clear the demo (demo mode only)

1. Run `python3 System/demo/demo.py clear` (`py` on Windows) — a dry run that prints what it would move to the system trash, reset to empty, or leave alone.
2. Explain John in one sentence — the made-up sample person the vault ships with, whose calendar, notes and wiki fill it. Show the counts per zone (the script prints them) and any "left alone" lines. Ask whether to clear the sample data in `Life/` (recommended: **clear**). Only on yes, ask whether to clear the sample in `Library/` too (recommended: **clear**) — Library alone is not an option, since the coaching commands would keep following John's brief.
3. On yes: run it again with `--apply` (add `--keep-library` when the Library stays). Files that changed since the demo stay untouched. An edited reset file (INBOX, Patterns…) is replaced only with `--reset-edited`, asked per file, never assumed.
4. Say once, in plain words, that John is not gone for good: his files are in the system trash, and the user can ask you any time to bring him back (you then run `demo.py restore`, dry run first). When the Library stayed, add that its sample can be cleared later the same way.

**If the user declines clearing `Life/`:** continue, and say it plainly, now and again at the end — John's roadmap brief, calendar, and inbox keep steering `/morning`, `/evening` and `/weekly` next to the new avatar, until the demo is cleared.

**Done when** the script printed "Done" and the marker no longer lists `life` — or the user declined and heard the sentence above.

### 3. Interview

One section at a time, in the order of [sections.md](sections.md). Aim for 2–4 **exchanges** per section (the skills section takes more): batch related questions into one message, and count messages, not sub-questions. The whole interview stays near 35 user turns. Offer options where the answer is a choice; ask openly where it is about the person.

**Push once** toward something concrete when an answer is vague ("I guess", "we'll see") or is a stated pattern with no instance ("I start fine with a deadline" → "last time?"). Then accept what comes, including "can't think of one".

After each section, write it to `Life/roadmap/avatar.md` with frontmatter `status: draft` — create the file from the template on the first section, without the template's closing authoring comment. `updated:` is the date of the last write; set it on every save.

How the file is written:
- **A skip stands.** "Always asked" in [sections.md](sections.md) means always *offered*; when the user skips a question or a whole section, take it once, without pushing. A skipped section keeps its heading and the line `*(skipped)*`; delete everything else the template put under it (sub-headings, tables, prompts). A sub-table left without rows is removed too.
- **Neutral fragments in the user's words**, no "she/he/they", in the bullets and in the planning read alike: "Student, field undecided", "Plan on ~5 h/week". Other skills read the file as *who I am*.
- **Contradictions stay contradictions.** When goals or facts pull apart, write both, mark the pair `unreconciled` in the planning read, and leave the choosing to the user.
- **Deadlines** that happen once are absolute dates; recurring ones stay as the pattern ("20th–25th, monthly"). A relative one ("in six weeks") is converted from today's date, shown once for confirmation, and written as given if the user doubts it — with `(date unconfirmed)` when the date stays soft.

**Done when** every section is either filled or marked skipped.

### 4. Review and close

Paste the whole file into the chat. Ask what is wrong or missing, apply corrections, then set `status: complete`.

If the marker still lists `life`, repeat the sentence about John once and offer the clear again. If it lists only `library`, add one line that the Library sample can be cleared on request.

Close with two lines, in plain words:
- The next step is `/roadmap`: it builds the roadmap brief — phases, priorities, what to do now — from this avatar.
- This file, the inbox, the journal, the notes, the patterns, the roadmap brief and the backlog are kept out of git on purpose, so they can't be published by accident; ask if you ever want one included.

**Done when** the user has read the full file and approved it.

## Update mode

Show the current file and the `updated` date; ask "what changed since then?". Walk only the sections the user names, plus any that mention a date now past. Everything else stays byte for byte. Show a short before/after for each changed section, and write after the user confirms.

## Ownership

`avatar.md` is the user's after the first write. Outside a run of this skill, an agent changes it only on explicit instruction. Language: the user's own; file headings stay in English so other skills can find sections by name.
