---
source-type: article
topics: [git]
date: 2026-09-30
clipped-from: "https://www.conventionalcommits.org/en/v1.0.0/"
---

# clipped: Conventional Commits — why the format matters

Clipped this after a teammate's PR had five commits all named "fix" and I couldn't tell which one mattered. Short summary of what the spec actually says, in my own words — not a copy of the page.

The core idea: a commit message's first line follows a fixed shape, `<type>: <short summary>`, where `type` is one of a small fixed set (`fix`, `feat`, `docs`, `refactor`, `chore`, a few others). `fix` means the commit patches a bug, `feat` means it adds a capability. The type is a promise about what the commit *does*, not a description of what files changed.

Why this is worth the discipline, from the FAQ on the page: tools can read the type mechanically. A `fix` commit can bump a patch version automatically, a `feat` commit can bump a minor version, and a changelog can be generated straight from the commit log instead of someone writing it by hand after the fact. None of that works if half the commits are just named "fix" or "updates".

The spec also allows a `!` after the type (`feat!: ...`) or a `BREAKING CHANGE:` footer to flag a commit that breaks backward compatibility — that's the one piece that maps to a major version bump.

Didn't dig into the scope syntax (`feat(parser): ...`) or the full footer grammar — parked for later, this was enough to explain why the five "fix" commits were a problem.
