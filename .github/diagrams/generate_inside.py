#!/usr/bin/env python3
"""Candidate layouts for "What's inside" (diagram-design), GitHub Primer skin.

    zone-contract  — architecture: three zones, the one bridge, the one read
    command-map    — which commands and skills act on which zone
"""
from generate_flows import Canvas, MONO, SANS, W, esc, render


def zone_contract(c):
    t = c.t
    c.zone(16, 16, 336, 224, "LIFE/ · CHANGES DAILY")
    c.node(32, 56, 144, 44, "Calendar/", "", mono_name=True)
    c.node(192, 56, 144, 44, "Journal/", "", mono_name=True)
    c.node(32, 112, 144, 44, "INBOX.md", "", mono_name=True)
    c.node(192, 112, 144, 44, "Patterns/", "", mono_name=True)
    c.node(32, 168, 304, 56, "avatar.md · roadmap-brief.md", "the two files Library reads", mono_name=True)

    c.zone(480, 16, 336, 224, "LIBRARY/ · WHAT YOU LEARN")
    c.node(496, 56, 304, 44, "sources/inbox/", "", mono_name=True, focal=True)
    c.node(496, 112, 144, 44, "wiki/", "", mono_name=True)
    c.node(656, 112, 144, 44, "INDEX.md", "", mono_name=True)
    c.node(496, 168, 144, 56, "books/", "", mono_name=True)
    c.node(656, 168, 144, 56, "explanations/", "", mono_name=True)

    c.arrow("M 352 78 H 494", focal=True)
    c.label(416, 68, "new files only", focal=True)
    c.arrow("M 480 196 H 338", dashed=True)
    c.label(408, 186, "reads only")

    return 256, ("What's inside: the zone contract",
                 "Life and Library side by side; the only write from Life into Library is a new file in sources/inbox, and the only things Library takes from Life are reads of avatar.md and roadmap-brief.md.")


def chip(c, x, y, text, dashed=False):
    t = c.t
    w = len(text) * 7.8 + 24
    c.nodes.append(f'<rect x="{x}" y="{y}" width="{w:.0f}" height="36" rx="4" fill="{t["paper"]}" stroke="{t["border"]}" stroke-width="1"/>')
    c.nodes.append(f'<text x="{x + w/2:.1f}" y="{y+23}" fill="{t["ink"]}" font-size="13" font-weight="500" font-family="{MONO}" text-anchor="middle">{esc(text)}</text>')
    return x + w + 8


def command_map(c):
    t = c.t
    cols = [
        (16, 400, "LIFE/", ["/morning", "/evening", "/weekly", "/avatar", "/roadmap"], ["research"]),
        (432, 240, "LIBRARY/", ["/library", "/source"], ["note", "explain"]),
        (688, 128, "SYSTEM/", [], ["checkpoint"]),
    ]

    def rows_needed(x, w, items):
        cx, rows = x + 16, 1
        for it in items:
            cw = len(it) * 7.8 + 24
            if cx + cw > x + w - 8:
                cx, rows = x + 16, rows + 1
            cx += cw + 8
        return rows

    extra = max(rows_needed(x, w, cmds) for x, w, _, cmds, _ in cols) - 1   # extra chip rows in the commands block
    zone_h = 200 + 44 * extra
    for x, w, label, cmds, skills in cols:
        c.zone(x, 16, w, zone_h, label)
        for ey, name, items in [(68, "COMMANDS · YOU TYPE THEM", cmds), (144 + 44 * extra, "SKILLS · AGENT PICKS THEM", skills)]:
            short = name.split(" · ")[0] if w < 200 else name
            c.nodes.append(f'<text x="{x+16}" y="{ey}" fill="{t["muted"]}" font-size="10" font-family="{MONO}" letter-spacing="0.08em">{short}</text>')
            cx, ry = x + 16, ey + 12
            if not items:
                c.nodes.append(f'<text x="{cx}" y="{ey+35}" fill="{t["muted"]}" font-size="14" font-family="{SANS}">—</text>')
            for it in items:
                cw = len(it) * 7.8 + 24
                if cx + cw > x + w - 8:
                    cx, ry = x + 16, ry + 44
                cx = chip(c, cx, ry, it)
    # the one skill that works everywhere
    by = 232 + 44 * extra
    c.nodes.append(f'<rect x="16" y="{by}" width="800" height="44" rx="6" fill="{t["subtle"]}" stroke="{t["border"]}" stroke-width="1" stroke-dasharray="4,3"/>')
    c.nodes.append(f'<text x="32" y="{by+27}" fill="{t["ink"]}" font-size="13" font-weight="600" font-family="{MONO}">link-notes</text>')
    c.nodes.append(f'<text x="800" y="{by+27}" fill="{t["muted"]}" font-size="12" font-family="{SANS}" text-anchor="end">skill for every zone: wires new notes into the graph</text>')
    return 292 + 44 * extra, ("What's inside: who acts where",
                 "Commands you type and skills the agent picks up, grouped by the zone they act on: Life gets /morning, /evening, /weekly, /avatar, /roadmap and research; Library gets /library, /source, note and explain; System gets checkpoint; link-notes works in every zone.")


if __name__ == "__main__":
    render([("inside-zone-contract", zone_contract),
            ("inside-command-map", command_map)], eyebrow="What's inside")
