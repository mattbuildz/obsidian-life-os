# System zone

The vault's machinery. Changed deliberately by the user, together with you. Router with shared rules: `../CLAUDE.md`.

## What's where

| Place | What it is | Rule |
|---|---|---|
| `Templates/` | Templates (the daily note). Path is hardcoded into Daily Notes, the template plugin, and quick-capture. | Use it, don't invent a new structure. |
| `Attachments/` | Images and files pasted into notes (the vault's attachment folder). `banners/` = the Life OS Hub banner GIFs — the plugin looks for them by the phrase `dark mode` / `light mode` in the filename, don't rename them. Dropping a new one on the banner moves the old one to `old-banners/` with a number appended, instead of deleting it. | Don't reorganize without being asked. |
| `demo/` | The sample person's (John's) data and its tooling. `.demo-active` = marker; lists which parts of John (`life`, `library`) are still in the vault, and disappears when none is. `demo.py clear` moves it to the system trash (dry run by default; only files still identical to John's); `demo.py restore` writes back only what is missing, and never overwrites. `john/` = frozen copy of John's files (the source of truth for both), `stubs/` = the empty versions `clear` leaves. `shift-demo-week.py` moves the demo week to today. | The `avatar` skill runs `demo.py clear` after asking. After changing the demo content, refresh the snapshot from an unshifted checkout: `demo.py build`. |
| `scripts/` | Machinery scripts. `vault-status.py` = facts by code: avatar age, days since the last `/weekly` (recorded with `--record weekly`), gaps in the daily loop, INBOX and Library queues. Writes `System/status.json` and `System/runs.json` (both git-ignored). | `/weekly` runs it first; the Life OS Hub Status tab displays the snapshot and its Refresh button re-runs it. Thresholds live at the top of the script — one place. |
| `Checkpoints/` | Handoffs from the `checkpoint` skill — from **all** of the user's projects, not just this vault. `full-chats/` = full transcripts, `summaries/` = condensed checkpoints named `<project-or-topic>_checkpoint_<date_time>.md`. | **Fixed location — don't ask where to save.** Path is hardcoded in the `checkpoint` skill. |

## Also this zone, even though it lives outside this folder

| Place | What it is | Rule |
|---|---|---|
| `../.claude/commands/` | Workflows — one `.md` file = one command. | Current list: `ls .claude/commands/`. These work from every zone. |
| `../.claude/skills/` | Project skills: `link-notes`, `research`, `avatar`, `roadmap` (native to this vault), plus anything installed separately. | They fire on their own when the topic matches. `research` is multi-source deep research — not for simple questions. |
| `../.agents/skills/<name>`, `../.agents/commands/<name>.md` | Relative symlinks to `../.claude/skills/<name>` and `../.claude/commands/<name>.md`, for Cursor. | Don't edit these directly — edit the `.claude/` copy and run `System/scripts/sync-agent-mirrors.sh` to regenerate. |
| `../.codex/skills/<name>`, `../.codex/skills/cmd-<name>/` | The same skill mirrors, plus one shim per command — Codex reads neither `.claude/commands/` nor `.agents/`, only `.codex/skills/`. | Same rule: never hand-edit, regenerate with the same script. On Windows the script skips the symlinks — follow it with `py System/scripts/setup-symlinks.py`, which puts copies there instead. |
| `../.obsidian/` | Vault config, CSS snippets, plugins. | Handle carefully. Only change config as a deliberate, conscious edit. |
