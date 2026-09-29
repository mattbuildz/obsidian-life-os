---
source-type: note
topics: [python]
date: 2026-10-09
---

# clip — f-strings vs .format(), from a course forum thread

Someone on the course forum asked why f-strings are "better" than `.format()`. Top answer said f-strings evaluate the expression inline (`f"{price:.2f}"`) instead of needing positional or named placeholders, and are noticeably faster since the string is built at parse time instead of through a method call. Someone else pointed out f-strings can't be used as a stored template (you can't save `f"{x}"` and reuse it with a different `x` later, since it evaluates immediately) — `.format()` still wins there.

Not ingested yet, parking it here.
