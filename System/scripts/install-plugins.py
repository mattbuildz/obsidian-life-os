#!/usr/bin/env python3
"""Fetch this vault's community plugins and theme straight from their GitHub
repos, instead of installing them by hand through Obsidian's community
browser.

Run once after cloning, and again whenever you want to update. Anything
already installed is checked first: same version (or newer locally) = left
alone, older = updated, missing = installed. Files are downloaded in full
before anything is written, so a failed download never leaves a plugin
half-updated, and your plugin settings (data.json) are never touched.

    python3 System/scripts/install-plugins.py     # macOS / Linux / Windows (py)

What it does:
  - Reads .obsidian/community-plugins.json for the list of plugin ids.
  - Looks each id up in Obsidian's official plugin registry
    (obsidianmd/obsidian-releases) to find its GitHub repo, then downloads
    that repo's latest release assets (manifest.json, main.js, styles.css)
    into .obsidian/plugins/<id>/.
  - Reads the theme named in .obsidian/appearance.json's "cssTheme", looks
    it up in the official theme registry, and downloads manifest.json +
    theme.css straight from the repo's default branch (themes aren't
    released the way plugins are) into .obsidian/themes/<name>/.

What it skips:
  - The ids in BUNDLED_PLUGINS below: plugins that ship as source in this
    repo. That's Life OS Hub today. Its id was once `command-center`, which
    the official registry also uses for an unrelated plugin, and fetching
    it by id overwrote the bundled one — so this list is checked first
    instead of trusting "not in the registry" to mean "ours".
  - Any other id that isn't in the official registry.

What it never touches: Restricted Mode. Obsidian keeps that as in-memory
app state, not a vault file, specifically so a shared/cloned vault can't
silently enable plugin code execution on its own. Turn it off by hand once,
in Settings -> Community plugins, after running this script.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OBSIDIAN = ROOT / ".obsidian"
PLUGIN_REGISTRY_URL = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json"
THEME_REGISTRY_URL = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-css-themes.json"
USER_AGENT = "obsidian-life-os-install-plugins-script"

# Plugins that live in this repo as source. Matched by id BEFORE the registry
# lookup, because plugin ids aren't unique across Obsidian's registry.
BUNDLED_PLUGINS = {"life-os-hub"}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def latest_release_assets(repo):
    data = fetch_json(f"https://api.github.com/repos/{repo}/releases/latest")
    assets = {a["name"]: a["browser_download_url"] for a in data.get("assets", [])}
    return assets, data.get("tag_name")


def default_branch(repo):
    data = fetch_json(f"https://api.github.com/repos/{repo}")
    return data.get("default_branch", "main")


def version_key(v):
    parts = []
    for piece in (v or "").lstrip("vV").split("."):
        digits = "".join(ch for ch in piece if ch.isdigit())
        if not digits:
            return None
        parts.append(int(digits))
    return tuple(parts) or None


def needs_update(local_version, remote_version):
    """True if remote is newer than local. Unparsable versions: update if they differ."""
    local_key, remote_key = version_key(local_version), version_key(remote_version)
    if local_key is None or remote_key is None:
        return local_version != remote_version
    return remote_key > local_key


def local_version(dest, required):
    """Installed version from manifest.json, or None if not (fully) installed."""
    if not all((dest / name).exists() for name in required):
        return None
    try:
        return json.loads((dest / "manifest.json").read_text(encoding="utf-8")).get("version")
    except (OSError, ValueError):
        return None


def write_all(dest, files):
    dest.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        tmp = dest / (name + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(dest / name)


def install_plugin(plugin_id, repo):
    dest = OBSIDIAN / "plugins" / plugin_id
    try:
        assets, tag = latest_release_assets(repo)
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"  ! {plugin_id}: couldn't reach {repo} releases ({e}) - skipped")
        return
    if "manifest.json" not in assets or "main.js" not in assets:
        print(f"  ! {plugin_id}: release {tag} has no manifest.json/main.js - skipped")
        return
    installed = local_version(dest, ("manifest.json", "main.js"))
    if installed is not None and not needs_update(installed, tag):
        print(f"  = {plugin_id} {installed} (up to date)")
        return
    try:
        files = {n: fetch_bytes(assets[n]) for n in ("manifest.json", "main.js", "styles.css") if n in assets}
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"  ! {plugin_id}: download failed ({e}) - left as it was")
        return
    write_all(dest, files)
    action = "installed" if installed is None else f"updated {installed} ->"
    print(f"  + {plugin_id} {action} {tag} ({', '.join(files)})")


def install_theme(theme_name, repo):
    dest = OBSIDIAN / "themes" / theme_name
    try:
        branch = default_branch(repo)
        raw = f"https://raw.githubusercontent.com/{repo}/{branch}"
        theme_css = fetch_bytes(f"{raw}/theme.css")
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"  ! theme {theme_name}: couldn't fetch from {repo} ({e}) - skipped")
        return
    files = {"theme.css": theme_css}
    remote = None
    try:
        files["manifest.json"] = fetch_bytes(f"{raw}/manifest.json")
        remote = json.loads(files["manifest.json"]).get("version")
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError):
        files.pop("manifest.json", None)
    installed = local_version(dest, ("theme.css", "manifest.json"))
    if installed is not None and remote is not None and not needs_update(installed, remote):
        print(f"  = theme {theme_name} {installed} (up to date)")
        return
    write_all(dest, files)
    action = "installed" if installed is None else f"updated {installed} ->"
    print(f"  + theme {theme_name} {action} {remote or '?'} ({', '.join(files)})")


def main():
    community_plugins_path = OBSIDIAN / "community-plugins.json"
    appearance_path = OBSIDIAN / "appearance.json"
    if not community_plugins_path.exists():
        sys.exit(f"missing {community_plugins_path}")

    wanted_ids = json.loads(community_plugins_path.read_text(encoding="utf-8"))
    appearance = json.loads(appearance_path.read_text(encoding="utf-8")) if appearance_path.exists() else {}
    theme_name = appearance.get("cssTheme")

    print("Fetching Obsidian's community plugin registry...")
    plugin_registry = {p["id"]: p["repo"] for p in fetch_json(PLUGIN_REGISTRY_URL)}

    print("Installing plugins:")
    for plugin_id in wanted_ids:
        if plugin_id in BUNDLED_PLUGINS:
            print(f"  - {plugin_id}: bundled in this repo - not fetched")
            continue
        repo = plugin_registry.get(plugin_id)
        if repo is None:
            print(f"  - {plugin_id}: not in the community registry - this vault's own plugin, nothing to fetch")
            continue
        install_plugin(plugin_id, repo)

    if theme_name:
        print(f"Fetching Obsidian's community theme registry for '{theme_name}'...")
        theme_registry = {t["name"]: t["repo"] for t in fetch_json(THEME_REGISTRY_URL)}
        repo = theme_registry.get(theme_name)
        if repo is None:
            print(f"  ! theme {theme_name}: not found in the community registry - skipped")
        else:
            install_theme(theme_name, repo)

    if os.name == "nt" and "terminal" in wanted_ids:
        print(
            "\nWindows: the Terminal plugin's integrated terminal needs two Python "
            "packages. Install them once with:\n    py -m pip install psutil pywinpty\n"
            "(the external terminal works without them)."
        )

    print(
        "\nDone. In Obsidian: Settings -> Community plugins -> turn off "
        "Restricted mode, then enable each plugin (Life OS Hub included)."
    )


if __name__ == "__main__":
    main()
