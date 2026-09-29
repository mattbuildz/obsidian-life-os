#!/usr/bin/env python3
"""Generate the 'who writes where' matrix (diagram-design, DP security matrix type)
in GitHub Primer colors, light + dark, as self-contained HTML.

Usage (from this folder): python3 generate.py . && python3 export.py who-writes-where*.html
"""
import sys, pathlib

OUT = pathlib.Path(sys.argv[1])

THEMES = {
    "light": dict(paper="#ffffff", subtle="#f6f8fa", ink="#1f2328", muted="#59636e",
                  soft="#818b98", border="#d1d9e0", agent="#0969da", you="#1a7f37",
                  focal="#bc4c00", focal_fill="#fff1e5", banner_text="#ffffff"),
    "dark": dict(paper="#0d1117", subtle="#151b23", ink="#f0f6fc", muted="#9198a1",
                 soft="#656c76", border="#3d444d", agent="#1f6feb", you="#238636",
                 focal="#f0883e", focal_fill="#271a10", banner_text="#ffffff"),
}

SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"

# (zone label, [(name, path, agent_cell, you_cell)])  cell = (value, sub) | None ; "FOCAL" marks focal
ZONES = [
    ("LIFE/ · CHANGES DAILY", [
        ("Calendar", "Calendar/", ("Plans the week", "/weekly · /evening"), ("Drag blocks", None)),
        ("Journal", "Journal/", ("Plan sections", "/morning · /evening"), ("Journaling", None)),
        ("Inbox", "INBOX.md", ("Triage", "/evening"), ("Capture tasks", None)),
        ("Patterns", "Patterns/", ("Factual log", "/morning · /evening"), None),
        ("Avatar", "roadmap/avatar.md", ("Writes from an interview", "/avatar"), ("Your answers", None)),
        ("Brief", "roadmap-brief.md", ("Phases · priorities · Now", "/roadmap · /weekly (§6)"), ("Choose & confirm", None)),
    ]),
    ("LIBRARY/ · WHAT YOU LEARN", [
        ("Source queue", "sources/inbox/", ("FOCAL", "New files only", "/note · /source"), ("Clip pages", None)),
        ("Wiki", "wiki/", ("Compiles pages", "/library"), None),
    ]),
    ("SYSTEM/ · EXTRAS", [
        ("Checkpoints", "Checkpoints/", ("Session handoff", "/checkpoint"), None),
    ]),
]

PAD, COMP_W, GAP, ROLE_W = 16, 240, 16, 264
W = PAD + COMP_W + GAP + ROLE_W + GAP + ROLE_W + PAD            # 832
ROLE_X = [PAD + COMP_W + GAP, PAD + COMP_W + GAP + ROLE_W + GAP]  # 272, 552
HEADER_Y, HEADER_H = 16, 56
ROW_H, ROW_STRIDE, ZONE_H = 48, 52, 28


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build(t, slug):
    o = []
    a = o.append
    # header
    a(f'<rect x="{PAD}" y="{HEADER_Y}" width="{COMP_W}" height="{HEADER_H}" rx="6" fill="{t["paper"]}" stroke="{t["border"]}" stroke-width="1"/>')
    a(f'<text x="{PAD+16}" y="{HEADER_Y+25}" fill="{t["ink"]}" font-size="14" font-weight="600" font-family="{SANS}">Where it lives</text>')
    a(f'<text x="{PAD+16}" y="{HEADER_Y+43}" fill="{t["muted"]}" font-size="12" font-family="{MONO}">folder or file</text>')
    for x, fill, name, sub in [(ROLE_X[0], t["agent"], "Agent", "slash commands"),
                               (ROLE_X[1], t["you"], "You", "by hand, in Obsidian")]:
        cx = x + ROLE_W / 2
        a(f'<rect x="{x}" y="{HEADER_Y}" width="{ROLE_W}" height="{HEADER_H}" rx="6" fill="{fill}"/>')
        a(f'<text x="{cx}" y="{HEADER_Y+25}" fill="{t["banner_text"]}" font-size="14" font-weight="600" font-family="{SANS}" text-anchor="middle">{name}</text>')
        a(f'<text x="{cx}" y="{HEADER_Y+43}" fill="{t["banner_text"]}" fill-opacity="0.85" font-size="12" font-family="{MONO}" text-anchor="middle">{esc(sub)}</text>')

    y = HEADER_Y + HEADER_H + 16  # 88
    for zi, (zlabel, rows) in enumerate(ZONES):
        if zi:
            a(f'<line x1="{PAD}" y1="{y-6}" x2="{W-PAD}" y2="{y-6}" stroke="{t["border"]}" stroke-width="1"/>')
        a(f'<text x="{PAD}" y="{y+18}" fill="{t["muted"]}" font-size="11" font-weight="500" font-family="{MONO}" letter-spacing="0.1em">{esc(zlabel)}</text>')
        y += ZONE_H
        for name, path, agent, you in rows:
            # label cell
            a(f'<rect x="{PAD}" y="{y}" width="{COMP_W}" height="{ROW_H}" rx="4" fill="{t["paper"]}" stroke="{t["border"]}" stroke-width="1"/>')
            a(f'<text x="{PAD+16}" y="{y+29}" fill="{t["ink"]}" font-size="14" font-weight="600" font-family="{SANS}">{esc(name)}</text>')
            a(f'<text x="{PAD+COMP_W-16}" y="{y+29}" fill="{t["muted"]}" font-size="12" font-family="{MONO}" text-anchor="end">{esc(path)}</text>')
            for x, cell in [(ROLE_X[0], agent), (ROLE_X[1], you)]:
                cx = x + ROLE_W / 2
                if cell is None:
                    a(f'<rect x="{x}" y="{y}" width="{ROLE_W}" height="{ROW_H}" rx="4" fill="{t["paper"]}" stroke="{t["border"]}" stroke-width="1" stroke-dasharray="4,3"/>')
                    a(f'<text x="{cx}" y="{y+29}" fill="{t["soft"]}" font-size="14" font-family="{SANS}" text-anchor="middle">—</text>')
                    continue
                focal = cell[0] == "FOCAL"
                value, sub = (cell[1], cell[2]) if focal else cell
                fill, stroke, sw = (t["focal_fill"], t["focal"], 1.5) if focal else (t["subtle"], t["border"], 1)
                vcol = t["focal"] if focal else t["ink"]
                scol = t["focal"] if focal else t["muted"]
                a(f'<rect x="{x}" y="{y}" width="{ROLE_W}" height="{ROW_H}" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
                if sub:
                    a(f'<text x="{cx}" y="{y+21}" fill="{vcol}" font-size="14" font-weight="{600 if focal else 500}" font-family="{SANS}" text-anchor="middle">{esc(value)}</text>')
                    a(f'<text x="{cx}" y="{y+38}" fill="{scol}" font-size="12" font-family="{MONO}" text-anchor="middle">{esc(sub)}</text>')
                else:
                    a(f'<text x="{cx}" y="{y+29}" fill="{vcol}" font-size="14" font-weight="500" font-family="{SANS}" text-anchor="middle">{esc(value)}</text>')
            y += ROW_STRIDE
        y += 12

    # legend strip
    ly = y + 4
    a(f'<line x1="{PAD}" y1="{ly}" x2="{W-PAD}" y2="{ly}" stroke="{t["border"]}" stroke-width="1"/>')
    ty = ly + 28
    a(f'<text x="{PAD}" y="{ty}" fill="{t["muted"]}" font-size="11" font-weight="500" font-family="{MONO}" letter-spacing="0.1em">LEGEND</text>')
    items = [
        (f'fill="{t["subtle"]}" stroke="{t["border"]}"', "writes here"),
        (f'fill="{t["paper"]}" stroke="{t["border"]}" stroke-dasharray="3,2"', "never writes here"),
        (f'fill="{t["focal_fill"]}" stroke="{t["focal"]}" stroke-width="1.5"', "the only way from Life into Library"),
    ]
    x = 96
    for attrs, label in items:
        a(f'<rect x="{x}" y="{ty-11}" width="16" height="12" rx="2" {attrs}/>')
        a(f'<text x="{x+24}" y="{ty}" fill="{t["muted"]}" font-size="12" font-family="{SANS}">{esc(label)}</text>')
        x += 24 + len(label) * 7 + 28
    H = ty + 20

    body = "\n      ".join(o)
    return H, f'''<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">
      <title id="{slug}-title">Who writes where in the vault</title>
      <desc id="{slug}-desc">Matrix of the vault's writable places, grouped by the Life, Library and System zones, showing which the agent writes through slash commands and which you write by hand or confirm; the only way from Life into Library is adding new files to the source queue.</desc>
      <rect width="100%" height="100%" fill="{t["paper"]}"/>
      {body}
    </svg>'''


for mode, t in THEMES.items():
    slug = "who-writes-where" + ("" if mode == "light" else "-dark")
    H, svg = build(t, slug)
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Who writes where</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: {t["paper"]}; color: {t["ink"]}; font-family: {SANS}; padding: 2rem; }}
    .eyebrow {{ font-family: {MONO}; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: {t["muted"]}; margin-bottom: 0.4rem; }}
    h1 {{ font-size: 1.5rem; font-weight: 600; margin-bottom: 1.25rem; }}
    svg {{ display: block; max-width: 100%; height: auto; }}
  </style>
</head>
<body>
  <p class="eyebrow">Permissions matrix · GitHub Primer skin ({mode})</p>
  <h1>Who writes where</h1>
  {svg}
</body>
</html>
'''
    (OUT / f"{slug}.html").write_text(html)
    print(slug, W, H)
