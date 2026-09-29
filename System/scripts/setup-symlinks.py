#!/usr/bin/env python3
"""Fix the vault's symlinks after a plain `git clone` on a system that can't
create them (mainly Windows without Developer Mode / core.symlinks=true).

git still checks these paths out — but as a *plain text file whose content
is the link target's path* instead of a working symlink. Run this once after
cloning:

    python3 System/scripts/setup-symlinks.py     # macOS / Linux / Windows (py)

It is safe to run again later and safe on a machine where the symlinks
already work: anything already correct is left untouched. It never deletes
content — a path is only replaced when it's confirmed to be either a broken
symlink placeholder (the git-for-Windows text-file form) or missing.

On Windows the links become COPIES. Two consequences:
  - A copy doesn't follow its original. After editing a CLAUDE.md, a skill,
    or a command, run this script again to refresh the copies.
  - git still stores these paths as symlinks. So they're marked
    `skip-worktree` and the copied folders go into .git/info/exclude —
    otherwise `git add -A` would commit the copies over the symlinks and
    break the repo on every other machine.

The zone mapping below is the same one CLAUDE.md documents; add a new zone
here. Skill and command names are read from .claude/ — nothing to add there.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# (path relative to ROOT, target path relative to that file's own directory)
FILE_LINKS = [
    ("AGENTS.md", "CLAUDE.md"),
    ("Life/AGENTS.md", "CLAUDE.md"),
    ("Library/AGENTS.md", "CLAUDE.md"),
    ("System/AGENTS.md", "CLAUDE.md"),
    ("Life/.claude/settings.json", "../../.claude/settings.json"),
    ("Library/.claude/settings.json", "../../.claude/settings.json"),
    ("System/.claude/settings.json", "../../.claude/settings.json"),
]

COMMAND_NAMES = sorted(p.stem for p in (ROOT / ".claude" / "commands").glob("*.md"))
FILE_LINKS += [
    (f".agents/commands/{name}.md", f"../../.claude/commands/{name}.md")
    for name in COMMAND_NAMES
]

SKILL_NAMES = sorted(p.name for p in (ROOT / ".claude" / "skills").iterdir() if p.is_dir())
DIR_LINKS = [
    (f".agents/skills/{name}", f"../../.claude/skills/{name}")
    for name in SKILL_NAMES
] + [
    (f".codex/skills/{name}", f"../../.claude/skills/{name}")
    for name in SKILL_NAMES
]


def resolved_target(link_path: Path, target: str) -> Path:
    return (link_path.parent / target).resolve()


def fix_file(rel_path: str, target: str) -> str:
    path = ROOT / rel_path
    real_target = resolved_target(path, target)
    if path.is_symlink() and path.resolve() == real_target and real_target.exists():
        return f"ok      {rel_path}"
    if not real_target.exists():
        return f"SKIP    {rel_path} (target missing: {target})"

    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() or path.is_symlink():
        path.unlink()

    if os.name != "nt":
        path.symlink_to(target)
        return f"linked  {rel_path} -> {target}"
    else:
        shutil.copyfile(real_target, path)
        return f"copied  {rel_path} (from {target}; Windows has no symlink here)"


def fix_dir(rel_path: str, target: str) -> str:
    path = ROOT / rel_path
    real_target = resolved_target(path, target)
    if path.is_symlink() and path.resolve() == real_target and real_target.exists():
        return f"ok      {rel_path}"
    if not real_target.exists():
        return f"SKIP    {rel_path} (target missing: {target})"

    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        path.unlink()
    elif path.exists():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

    if os.name != "nt":
        path.symlink_to(target, target_is_directory=True)
        return f"linked  {rel_path} -> {target}"
    else:
        shutil.copytree(real_target, path)
        return f"copied  {rel_path} (from {target}; Windows has no symlink here)"


def hide_copies_from_git() -> None:
    """Windows only: keep git from seeing the copies as changes to commit."""
    git = ["git", "-C", str(ROOT)]
    try:
        tracked = set(subprocess.run(git + ["ls-files"], capture_output=True, text=True,
                                     encoding="utf-8", check=True).stdout.splitlines())
    except (OSError, subprocess.CalledProcessError):
        print("\n(git not found — copies not hidden from git; don't `git add -A` them)")
        return
    paths = [p for p, _ in FILE_LINKS + DIR_LINKS if p in tracked]
    if paths:
        subprocess.run(git + ["update-index", "--skip-worktree", "--"] + paths, check=False)

    exclude = ROOT / ".git" / "info" / "exclude"
    if not exclude.parent.is_dir():
        return
    have = exclude.read_text(encoding="utf-8").splitlines() if exclude.exists() else []
    missing = [f"/{p}/" for p, _ in DIR_LINKS if f"/{p}/" not in have]
    if missing:
        with exclude.open("a", encoding="utf-8", newline="\n") as f:
            f.write("\n# setup-symlinks.py: Windows copies of symlinked folders\n")
            f.write("\n".join(missing) + "\n")
    print(f"\nHidden from git: {len(paths)} symlink paths (skip-worktree), "
          f"{len(missing)} new .git/info/exclude entries.")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    lines = []
    lines += [fix_file(p, t) for p, t in FILE_LINKS]
    lines += [fix_dir(p, t) for p, t in DIR_LINKS]
    print("\n".join(lines))
    if os.name == "nt":
        hide_copies_from_git()
    skipped = [l for l in lines if l.startswith("SKIP")]
    if skipped:
        print(f"\n{len(skipped)} entr{'y' if len(skipped)==1 else 'ies'} skipped — "
              "run this from a full checkout, not a partial one.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
