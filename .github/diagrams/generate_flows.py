#!/usr/bin/env python3
"""Daily loop + Library pipeline (diagram-design, flowchart type), GitHub Primer skin.

Writes light + dark HTML next to this file. Export to PNG:
    python3 generate_flows.py && python3 export.py *.html
"""
import pathlib

HERE = pathlib.Path(__file__).parent

THEMES = {
    "light": dict(paper="#ffffff", subtle="#f6f8fa", ink="#1f2328", muted="#59636e",
                  border="#d1d9e0", zone="#f6f8fa", arrow="#59636e",
                  focal="#bc4c00", focal_fill="#fff1e5"),
    "dark": dict(paper="#0d1117", subtle="#151b23", ink="#f0f6fc", muted="#9198a1",
                 border="#3d444d", zone="#151b23", arrow="#9198a1",
                 focal="#f0883e", focal_fill="#271a10"),
}
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
W = 832


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class Canvas:
    def __init__(self, t):
        self.t, self.zones, self.arrows, self.labels, self.nodes = t, [], [], [], []

    def zone(self, x, y, w, h, label):
        t = self.t
        self.zones.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{t["zone"]}" stroke="{t["border"]}" stroke-width="1"/>')
        self.zones.append(f'<text x="{x+16}" y="{y+22}" fill="{t["muted"]}" font-size="11" font-weight="500" font-family="{MONO}" letter-spacing="0.1em">{esc(label)}</text>')

    def node(self, x, y, w, h, name, sub, mono_name=False, mono_sub=False, focal=False):
        t = self.t
        fill, stroke, sw = (t["focal_fill"], t["focal"], 1.5) if focal else (t["paper"], t["border"], 1)
        cx = x + w / 2
        self.nodes.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
        ny = y + h / 2 - 3 if sub else y + h / 2 + 5
        self.nodes.append(f'<text x="{cx}" y="{ny}" fill="{t["focal"] if focal else t["ink"]}" font-size="14" font-weight="600" font-family="{MONO if mono_name else SANS}" text-anchor="middle">{esc(name)}</text>')
        if sub:
            self.nodes.append(f'<text x="{cx}" y="{y+h/2+15}" fill="{t["focal"] if focal else t["muted"]}" font-size="12" font-family="{MONO if mono_sub else SANS}" text-anchor="middle">{esc(sub)}</text>')

    def diamond(self, cx, cy, hw, hh, lines, focal=False):
        t = self.t
        fill, stroke, sw = (t["focal_fill"], t["focal"], 1.5) if focal else (t["paper"], t["border"], 1)
        pts = f"{cx},{cy-hh} {cx+hw},{cy} {cx},{cy+hh} {cx-hw},{cy}"
        self.nodes.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>')
        y = cy - 8 * (len(lines) - 1) - 2
        for i, s in enumerate(lines):
            col = t["focal"] if focal else (t["ink"] if i == 0 else t["muted"])
            size, weight = (14, 600) if i == 0 else (12, 400)
            self.nodes.append(f'<text x="{cx}" y="{y+i*17+4}" fill="{col}" font-size="{size}" font-weight="{weight}" font-family="{SANS}" text-anchor="middle">{esc(s)}</text>')

    def arrow(self, d, focal=False, dashed=False):
        t = self.t
        col = t["focal"] if focal else t["arrow"]
        mk = "arrow-focal" if focal else "arrow"
        dash = ' stroke-dasharray="5,4"' if dashed else ""
        self.arrows.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="1.5"{dash} marker-end="url(#{mk})"/>')

    def label(self, x, y, text, anchor="middle", focal=False, mono=True, caps=True, size=11, on_zone=False):
        """Text baseline at y; opaque paper mask behind it."""
        t = self.t
        s = text.upper() if caps else text
        w = len(s) * (7.2 if mono else 6.6) + 8
        mx = {"middle": x - w / 2, "start": x - 4, "end": x - w + 4}[anchor]
        col = t["focal"] if focal else t["muted"]
        self.labels.append(f'<rect x="{mx:.1f}" y="{y-11}" width="{w:.1f}" height="15" rx="2" fill="{t["zone"] if on_zone else t["paper"]}"/>')
        ls = ' letter-spacing="0.06em"' if caps else ""
        self.labels.append(f'<text x="{x}" y="{y}" fill="{col}" font-size="{size}" font-family="{MONO if mono else SANS}" text-anchor="{anchor}"{ls}>{esc(s)}</text>')

    def svg(self, slug, h, title, desc):
        t = self.t
        defs = (f'<marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{t["arrow"]}"/></marker>'
                f'<marker id="arrow-focal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{t["focal"]}"/></marker>')
        body = "\n      ".join(self.zones + self.arrows + self.labels + self.nodes)
        return f'''<svg viewBox="0 0 {W} {h}" width="{W}" height="{h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">
      <title id="{slug}-title">{esc(title)}</title>
      <desc id="{slug}-desc">{esc(desc)}</desc>
      <defs>{defs}</defs>
      <rect width="100%" height="100%" fill="{t["paper"]}"/>
      {body}
    </svg>'''


def daily_loop(c):
    # row 1: the day, left to right; return arrow over the top = next day
    c.node(16, 64, 240, 64, "/morning", "show today's blocks + minimum", mono_name=True)
    c.node(296, 64, 240, 64, "Blocks happen", "(or don't)")
    c.node(576, 64, 240, 64, "/evening", "close today, plan tomorrow", mono_name=True)
    c.arrow("M 256 96 H 294")
    c.arrow("M 536 96 H 574")
    c.arrow("M 696 64 V 44 A 8 8 0 0 0 688 36 H 144 A 8 8 0 0 0 136 44 V 62")
    c.label(416, 26, "next day")
    # row 2: Patterns/ folder, raw log -> confirmed pattern
    c.zone(16, 168, 800, 120, "LIFE/PATTERNS/")
    c.node(560, 208, 240, 64, "observation-log.md", "one factual entry, zero interpretation", mono_name=True)
    c.node(32, 208, 224, 64, "patterns.md", "confirmed pattern", mono_name=True, focal=True)
    c.arrow("M 680 128 V 206")
    c.arrow("M 560 240 H 258", focal=True, dashed=True)
    c.label(408, 228, "3rd repeat only", focal=True, on_zone=True)
    return 304, ("The daily loop",
                 "/morning shows the day's blocks and minimum, blocks happen or don't, /evening closes the day and plans the next one and writes one factual entry to the patterns log; an observation becomes a confirmed pattern only on its third repeat.")


def library_pipeline(c):
    c.node(16, 24, 224, 64, "Clip", "article, note, transcript")
    c.node(304, 24, 224, 64, "Inbox", "Library/sources/inbox/", mono_sub=True)
    c.arrow("M 240 56 H 302")
    # inbox -> decision, label beside the vertical segment
    c.arrow("M 416 88 V 150")
    c.label(430, 116, "/library", anchor="start", caps=False)
    c.label(430, 134, "one file at a time", anchor="start", mono=False, caps=False, size=12)
    c.diamond(416, 216, 104, 64, ["Compile", "real mechanism", "or just a pointer?"], focal=True)
    # mechanism -> page -> MOC
    c.node(608, 184, 208, 64, "New or updated page", "with a source citation")
    c.arrow("M 520 216 H 606")
    c.label(564, 206, "mechanism")
    c.node(608, 336, 208, 64, "Folder's MOC", "wired in, not just appended")
    c.arrow("M 712 248 V 334")
    # pointer -> catalog, mirrored on the left
    c.node(16, 184, 224, 64, "One line", "wiki/_catalog.md", mono_sub=True)
    c.arrow("M 312 216 H 242")
    c.label(276, 206, "pointer")
    return 424, ("The Library pipeline",
                 "Clipped articles, notes and transcripts land in the inbox; /library compiles them one file at a time, and only a real mechanism becomes a wiki page with a source citation wired into its folder's MOC, while a mere pointer becomes one line in the catalog.")


PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: {paper}; color: {ink}; font-family: {sans}; padding: 2rem; }}
    .eyebrow {{ font-family: {mono}; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: {muted}; margin-bottom: 0.4rem; }}
    h1 {{ font-size: 1.5rem; font-weight: 600; margin-bottom: 1.25rem; }}
    svg {{ display: block; max-width: 100%; height: auto; }}
  </style>
</head>
<body>
  <p class="eyebrow">Flowchart · GitHub Primer skin ({mode})</p>
  <h1>{title}</h1>
  {svg}
</body>
</html>
'''

def render(diagrams, eyebrow="Flowchart"):
    for base, fn in diagrams:
        for mode, t in THEMES.items():
            slug = base + ("" if mode == "light" else "-dark")
            c = Canvas(t)
            h, (title, desc) = fn(c)
            html = PAGE.format(title=title, paper=t["paper"], ink=t["ink"], muted=t["muted"],
                               sans=SANS, mono=MONO, mode=mode, svg=c.svg(slug, h, title, desc))
            html = html.replace("Flowchart · GitHub", f"{eyebrow} · GitHub")
            (HERE / f"{slug}.html").write_text(html)
            print(slug, W, h)


if __name__ == "__main__":
    render([("daily-loop", daily_loop), ("library-pipeline", library_pipeline)])

