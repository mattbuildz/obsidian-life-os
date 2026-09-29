---
topic: why a UTF-8 BOM breaks a dict-key lookup even though the text prints fine
date: 2026-10-07
context: Budget CLI's CSV import — one of three sample exports crashed with `KeyError: 'amount'`, fixed by switching `encoding="utf-8"` to `encoding="utf-8-sig"`
---

# The invisible character at the start of a "UTF-8" file

## What problem this even solves

A CSV export opened with `encoding="utf-8"` can print looking completely normal and still fail an equality check or a dict-key lookup on the exact same string. That gap — looks right, isn't right — is confusing precisely because nothing in the visible output explains it. Understanding the BOM is what makes that gap stop being mysterious.

## Intuition

Think of it like a price tag with a transparent sticker on top that has no print on it. Looking at the tag, you'd swear there's nothing there. But if you try to match it exactly against a tag with no sticker at all, they don't match — there's a real, physical layer present, it just doesn't show up to the eye. A BOM is that transparent sticker, sitting on the very first character of the file.

## How it works — the mechanism

The symptom, reduced to the smallest case:

```python
with open("export.csv", encoding="utf-8") as f:
    header = f.readline()

print(header)                          # 'category,amount,date\n'  -- looks fine
print(header == "category,amount,date\n")   # False
```

**BOM** stands for **Byte Order Mark** — a special Unicode character, `U+FEFF`, that some programs (Excel is the classic offender) write at the very start of a file when saving it as "UTF-8." Its original job, in encodings like UTF-16, was to tell a reader which byte order the file uses. UTF-8 doesn't have that ambiguity — it's decoded one byte at a time, no ordering question to resolve — so a BOM in a UTF-8 file does no technical work. Windows tools add it anyway, as a signal to *other* Windows tools that a file is UTF-8 rather than the legacy system codepage.

`encoding="utf-8"` decodes faithfully, BOM included. The three raw bytes (`EF BB BF`) really do mean the character `U+FEFF` in UTF-8, so Python keeps it, glued to the front of the first field name: the string isn't `"category"`, it's `"﻿category"`.

`encoding="utf-8-sig"` does the identical decoding, plus one extra step: if the file starts with that exact byte sequence, it strips the resulting character before handing back the string. If there's no BOM, `"utf-8-sig"` behaves exactly like `"utf-8"` — it's a safe default even when you don't know in advance whether a BOM will be there.

## Pitfalls and common misconceptions

- **`print()` hides the problem.** Most terminal fonts render `U+FEFF` as zero-width — no glyph at all. `print(header)` and a debugger's string preview both show `category,amount,date` with nothing to suggest an extra character is sitting at position 0.
- **The fix looks unrelated to the symptom.** A `KeyError` on a key that's clearly in the printed output makes people suspect the CSV library or the file's structure, not the encoding — because the encoding's effect is, again, invisible.
- **`"utf-8-sig"` isn't a "more correct utf-8"** — it's `"utf-8"` plus a BOM-stripping step. Using it everywhere is safe (harmless on files without a BOM), but it doesn't mean plain `"utf-8"` is wrong; the BOM is genuinely part of the file's bytes either way.
- **This isn't unique to CSVs.** The same invisible-character trap applies to JSON, source files, or anything else opened with a plain-text decoder — the CSV `DictReader` just makes it visible fastest, because the first key stops matching.

## How this applies to your situation

Budget CLI's CSV import only crashed on one of the three sample files — the one that happened to be saved from a spreadsheet app that adds the BOM by default; the other two were saved from a plain text editor and never had one. Switching the `open()` call to `encoding="utf-8-sig"` fixes it for all three, since it's a strict superset of `"utf-8"` behavior. Given that real exports (bank statements, spreadsheet downloads) are exactly the kind of file likely to carry a BOM, `"utf-8-sig"` is the safer default for anything reading a CSV whose origin isn't controlled by the CLI itself.

## Check your understanding

1. Why does `print(header)` show a clean string even when a BOM is present?
2. What would happen if you opened a file that has **no** BOM using `encoding="utf-8-sig"`?
3. If `header == "category,amount,date\n"` is `False` but both sides *look* identical when printed, what's the fastest way to confirm a BOM (or another invisible character) is the cause, without guessing?
