#!/usr/bin/env python3
"""README diagrams (diagram-design, default skin), light + dark.

    system-pipeline    — data flow: what you put in, what the agent runs, what it writes
    life-loop          — the daily loop with the weekly review around it, and what accumulates
    library-flow       — drop it, compile it, ask it: the Library from clip to cited answer
    writers-matrix     — who writes where: the agent through commands, you by hand
    inside-guardrails  — control catalog: the rules enforced by code, in the order they fire

Every label is taken from the repo (commands, skills, hooks, lint.py, vault-status.py).
Writes ten self-contained HTML files next to this script. Export to PNG:

    python3 generate_system.py
    python3 export.py system-pipeline*.html life-loop*.html library-flow*.html writers-matrix*.html inside-guardrails*.html
"""
import pathlib

HERE = pathlib.Path(__file__).parent
W = 960

THEMES = {
    "light": dict(
        paper="#f5f5f5", ink="#2d3142", muted="#4f5d75", soft="#7a8399",
        rule="rgba(45,49,66,0.12)", rule_solid="#bfc0c0",
        accent="#eb6c36", accent_tint="rgba(235,108,54,0.08)", accent_chip="rgba(235,108,54,0.20)",
        chip="rgba(45,49,66,0.10)",
        step_fill="#ffffff", step_stroke="#2d3142",
        you_fill="rgba(79,93,117,0.17)", you_stroke="#7a8399",
        file_fill="rgba(45,49,66,0.035)", file_stroke="#4f5d75",
        zone_fill="rgba(45,49,66,0.025)", zone_stroke="rgba(45,49,66,0.25)",
    ),
    "dark": dict(
        paper="#2d3142", ink="#f5f5f5", muted="#bfc0c0", soft="#8e98ac",
        rule="rgba(245,245,245,0.12)", rule_solid="rgba(191,192,192,0.25)",
        accent="#f08a59", accent_tint="rgba(240,138,89,0.10)", accent_chip="rgba(240,138,89,0.22)",
        chip="rgba(245,245,245,0.12)",
        step_fill="rgba(245,245,245,0.09)", step_stroke="rgba(245,245,245,0.75)",
        you_fill="rgba(191,192,192,0.18)", you_stroke="#8e98ac",
        file_fill="rgba(245,245,245,0.025)", file_stroke="rgba(191,192,192,0.45)",
        zone_fill="rgba(245,245,245,0.025)", zone_stroke="rgba(245,245,245,0.25)",
    ),
}
SANS = "'Geist', system-ui, sans-serif"
MONO = "'Geist Mono', ui-monospace, monospace"
SERIF = "'Instrument Serif', 'Noto Serif', serif"
FONTS = ("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1"
         "&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def runs(line):
    """`backticks` mark mono (paths, commands, literals); the rest is sans."""
    return [(p, i % 2 == 1) for i, p in enumerate(line.split("`")) if p]


def est(line, size):
    """Width budget from the style guide: 0.60em mono, ~0.55em Geist regular."""
    return sum(len(p) * ((size - 1) * 0.6 if mono else size * 0.55) for p, mono in runs(line))


class Canvas:
    def __init__(self, t, slug):
        self.t, self.slug = t, slug
        self.zones, self.arrows, self.labels, self.nodes, self.top = [], [], [], [], []

    # ---- text -------------------------------------------------------------
    def rich(self, layer, x, y, line, size=10.5, fill=None, mono_fill=None, anchor="start", maxw=None):
        t = self.t
        if maxw and est(line, size) > maxw:
            print(f"  [fit] {self.slug}: {est(line, size):.0f} > {maxw}: {line}")
        body = "".join(
            f'<tspan font-family="{MONO}" font-size="{size - 1}" fill="{mono_fill or t["ink"]}">{esc(p)}</tspan>'
            if mono else esc(p) for p, mono in runs(line))
        layer.append(f'<text xml:space="preserve" x="{x}" y="{y}" font-family="{SANS}" font-size="{size}" '
                     f'fill="{fill or t["muted"]}" text-anchor="{anchor}">{body}</text>')

    def name(self, layer, x, y, s, mono=False, fill=None, anchor="start", size=12, maxw=None):
        if maxw and len(s) * size * (0.6 if mono else 0.58) > maxw:
            print(f"  [fit] {self.slug}: name too wide for {maxw}: {s}")
        layer.append(f'<text x="{x}" y="{y}" font-family="{MONO if mono else SANS}" font-size="{size}" '
                     f'font-weight="600" fill="{fill or self.t["ink"]}" text-anchor="{anchor}">{esc(s)}</text>')

    def eyebrow(self, layer, x, y, s, fill=None, anchor="start", size=8.5, spacing="0.14em", upper=True):
        layer.append(f'<text x="{x}" y="{y}" font-family="{MONO}" font-size="{size}" font-weight="500" '
                     f'letter-spacing="{spacing}" fill="{fill or self.t["soft"]}" text-anchor="{anchor}">'
                     f'{esc(s.upper() if upper else s)}</text>')

    def header(self, eyebrow, title):
        self.eyebrow(self.top, 40, 40, eyebrow, fill=self.t["muted"], size=9, spacing="0.18em")
        self.top.append(f'<text x="40" y="76" font-family="{SERIF}" font-size="28" letter-spacing="-0.01em" '
                        f'fill="{self.t["ink"]}">{esc(title)}</text>')

    # ---- shapes -----------------------------------------------------------
    def box(self, x, y, w, h, kind, rx=6):
        t = self.t
        fill, stroke, sw, dash = {
            "step": (t["step_fill"], t["step_stroke"], 1, ""),
            "you": (t["you_fill"], t["you_stroke"], 1, ""),
            "file": (t["file_fill"], t["file_stroke"], 1, ""),
            "focal": (t["accent_tint"], t["accent"], 1.2, ""),
            "cell": (t["step_fill"], t["rule_solid"], 1, ""),
            "none": ("none", t["rule_solid"], 1, ' stroke-dasharray="4,3"'),
        }[kind]
        self.nodes.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{t["paper"]}"/>')
        self.nodes.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
                          f'stroke="{stroke}" stroke-width="{sw}"{dash}/>')

    def zone(self, x, y, w, h, label):
        t = self.t
        self.zones.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{t["zone_fill"]}" '
                          f'stroke="{t["zone_stroke"]}" stroke-width="1" stroke-dasharray="4,3"/>')
        self.eyebrow(self.zones, x + 12, y + 19, label)

    def hline(self, x1, x2, y, layer=None, strong=False):
        (self.zones if layer is None else layer).append(
            f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{self.t["rule_solid" if strong else "rule"]}" stroke-width="0.8"/>')

    def vline(self, x, y1, y2, strong=False):
        self.zones.append(f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" '
                          f'stroke="{self.t["rule_solid" if strong else "rule"]}" stroke-width="0.8"/>')

    def arrow(self, pts, accent=False, dashed=False, head=True, r=8):
        """Orthogonal polyline with rounded corners; pts are the corner points."""
        d = f"M {pts[0][0]} {pts[0][1]}"
        for a, b, c in zip(pts, pts[1:], pts[2:]):
            def toward(p, q):
                dx, dy = q[0] - p[0], q[1] - p[1]
                n = (dx * dx + dy * dy) ** 0.5
                return p[0] + dx / n * r, p[1] + dy / n * r
            (ax, ay), (cx, cy) = toward(b, a), toward(b, c)
            d += f" L {ax:g} {ay:g} Q {b[0]} {b[1]} {cx:g} {cy:g}"
        d += f" L {pts[-1][0]} {pts[-1][1]}"
        col = self.t["accent"] if accent else self.t["muted"]
        extra = (' stroke-dasharray="5,4"' if dashed else "") + \
                (f' marker-end="url(#{"arrow-accent" if accent else "arrow"})"' if head else "")
        self.arrows.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{1.2 if accent else 1}"{extra}/>')

    def label(self, cx, y, s, accent=False, upper=True, size=9, mask=True):
        """Arrow label: opaque paper mask, text baseline at y (no mask when it sits clear of every stroke, inside a zone)."""
        t = self.t
        s2 = s.upper() if upper else s
        w = len(s2) * size * (0.66 if upper else 0.6) + 12
        if mask:
            self.labels.append(f'<rect x="{cx - w / 2:g}" y="{y - 9.5}" width="{w:g}" height="13" rx="2" fill="{t["paper"]}"/>')
        self.labels.append(f'<text x="{cx}" y="{y}" font-family="{MONO}" font-size="{size}" '
                           f'letter-spacing="{"0.06em" if upper else "0"}" fill="{t["accent"] if accent else t["soft"]}" '
                           f'text-anchor="middle">{esc(s2)}</text>')

    def chip(self, layer, x, y, s, accent=False, w=None):
        t = self.t
        w = w or len(s) * 5.4 + 14
        layer.append(f'<rect x="{x}" y="{y}" width="{w:g}" height="16" rx="2" '
                     f'fill="{t["accent_chip"] if accent else t["chip"]}"/>')
        layer.append(f'<text x="{x + w / 2:g}" y="{y + 11.5}" font-family="{MONO}" font-size="9" font-weight="600" '
                     f'fill="{t["accent"] if accent else t["ink"]}" text-anchor="middle">{esc(s)}</text>')
        return w

    def swatch(self, x, y, kind):
        t = self.t
        fill, stroke = {"step": (t["step_fill"], t["step_stroke"]), "you": (t["you_fill"], t["you_stroke"]),
                        "file": (t["file_fill"], t["file_stroke"]), "focal": (t["accent_tint"], t["accent"]),
                        "cell": (t["step_fill"], t["rule_solid"]), "none": ("none", t["rule_solid"])}[kind]
        dash = ' stroke-dasharray="3,2"' if kind == "none" else ""
        self.top.append(f'<rect x="{x}" y="{y - 9}" width="16" height="11" rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>')

    def stroke_sample(self, x, y, accent=False, dashed=False):
        col = self.t["accent"] if accent else self.t["muted"]
        dash = ' stroke-dasharray="5,4"' if dashed else ""
        self.top.append(f'<line x1="{x}" y1="{y - 3.5}" x2="{x + 22}" y2="{y - 3.5}" stroke="{col}" '
                        f'stroke-width="{1.2 if accent else 1}"{dash} marker-end="url(#{"arrow-accent" if accent else "arrow"})"/>')

    # ---- node with left-aligned title + lines -----------------------------
    def card(self, x, y, w, h, kind, title, lines, mono_title=False, pad=14):
        self.box(x, y, w, h, kind)
        self.name(self.nodes, x + pad, y + 26, title, mono=mono_title, maxw=w - 2 * pad)
        for i, line in enumerate(lines):
            self.rich(self.nodes, x + pad, y + 46 + 16 * i, line, maxw=w - 2 * pad)


# =============================================================== 1. pipeline ==

def system_pipeline(c):
    t = c.t
    c.header("Life OS · the whole system on one page", "What goes in, what the agent runs, what it writes")

    COLS, CW, NH, PITCH = [168, 432, 696], 224, 64, 84
    for x, (num, lab, focal) in zip(COLS, [("01", "You put in", False), ("02", "The agent runs", True), ("03", "It writes", False)]):
        c.chip(c.top, x, 100, num, accent=focal, w=28)
        c.eyebrow(c.top, x + 38, 111.5, lab, fill=t["accent"] if focal else t["muted"], size=9)
    c.hline(40, 920, 128)

    rows = [
        (("Once, then", "per phase"),
         ("Your interview answers", "who you are, where you're heading"),
         ("/avatar → /roadmap", "an interview, then a plan"),
         ("Who you are, and the plan", "`avatar.md` · `roadmap-brief.md`")),
        (("Every day",),
         ("Blocks, tasks, your report", "what's planned, what happened"),
         ("/morning · /evening", "about 10 minutes each evening"),
         ("The plan and the record", "`Calendar/` · `Journal/` · `Patterns/`")),
        (("Every week",),
         ("The week's facts + answers", "7 days of journal, an interview"),
         ("/weekly", "reviews first, then blocks time"),
         ("Next week on the calendar", "`Calendar/` one file per block")),
        (("On demand",),
         ("Clips and notes", "Web Clipper, `/note`, `/source`"),
         ("/library ingest", "one source at a time"),
         ("A linked wiki", "`wiki/` pages that cite the source")),
    ]
    y = 148
    for label, cin, cag, cout in rows:
        mid = y + NH / 2
        ly = mid + (3 if len(label) == 1 else -4)
        for i, s in enumerate(label):
            c.eyebrow(c.top, 40, ly + 13 * i, s, fill=t["ink"], size=9)
        c.card(COLS[0], y, CW, NH, "you", cin[0], [cin[1]])
        c.card(COLS[1], y, CW, NH, "step", cag[0], [cag[1]], mono_title=True)
        c.card(COLS[2], y, CW, NH, "file", cout[0], [cout[1]])
        c.arrow([(COLS[0] + CW + 1, mid), (COLS[1] - 2, mid)])
        c.arrow([(COLS[1] + CW + 1, mid), (COLS[2] - 2, mid)])
        y += PITCH
    return y - PITCH + NH + 36, ("Life OS: what goes in, what the agent runs, what it writes",
                                 "Four rhythms, each from input to command to files. Once, then per phase: your interview "
                                 "answers go through /avatar and /roadmap into avatar.md and roadmap-brief.md. Every day: "
                                 "blocks, tasks and your report go through /morning and /evening into Calendar, Journal and "
                                 "Patterns. Every week: seven days of journal and an interview go through /weekly into next "
                                 "week's calendar. On demand: clips and notes go through /library ingest into wiki pages "
                                 "that cite the source.")


# ============================================================== 2. life loop ==

def life_loop(c):
    t = c.t
    c.header("Life/ · one day on repeat, with a weekly review around it", "The daily loop, and the week around it")

    LX, LW = 40, 192
    SX, SW, SH, SY = [360, 550, 740], 164, 104, 268
    mid = SY + SH / 2
    lc = LX + LW / 2

    c.top.append(f'<text x="920" y="150" font-family="{SERIF}" font-style="italic" font-size="14" fill="{t["muted"]}" '
                 f'text-anchor="end">Every block carries a minimum, something you can check when it ends.</text>')

    # the week, on the left
    c.card(LX, 116, LW, 56, "file", "roadmap-brief.md", ["priorities, current step"], mono_title=True)
    c.card(LX, mid - 48, LW, 96, "step", "/weekly",
           ["retrospective on 7 days,", "an interview with you,", "then the week's blocks"], mono_title=True)
    c.arrow([(lc, 173), (lc, mid - 50)])
    c.label(lc + 8 + 35.7, 225, "Read first")

    # the day
    zx = SX[0] - 16
    c.zone(zx, 204, 3 * SW + 2 * 26 + 32, 184, "Every day")
    stations = [("step", "/morning", True, ["blocks and minimums", "names the day's anchor", "opens the log entry"]),
                ("you", "Blocks happen", False, ["or don't", "new tasks → `INBOX.md`"]),
                ("step", "/evening", True, ["verdict on the anchor", "triages the inbox", "plans tomorrow", "closes the log entry"])]
    for x, (kind, title, mono, lines) in zip(SX, stations):
        c.card(x, SY, SW, SH, kind, title, lines, mono_title=mono)
    c.arrow([(SX[0] + SW + 1, mid), (SX[1] - 2, mid)])
    c.arrow([(SX[1] + SW + 1, mid), (SX[2] - 2, mid)])
    ex, mx = SX[2] + SW / 2, SX[0] + SW / 2
    c.arrow([(ex, SY - 1), (ex, 248), (mx, 248), (mx, SY - 2)])
    c.label((ex + mx) / 2, 238, "Next day", mask=False)

    # the week feeds the days, the days feed the next review (right edge fanned at thirds)
    c.arrow([(LX + LW + 1, mid - 16), (zx - 2, mid - 16)])
    c.arrow([(zx - 1, mid + 16), (LX + LW + 2, mid + 16)])
    gx = (LX + LW + zx) / 2
    c.label(gx, mid - 26, "Week's blocks")
    c.label(gx, mid + 32.5, "7 days of data")

    # what accumulates
    PY = 448
    c.card(SX[2], PY, SW, 64, "file", "observation-log.md", ["one factual entry a day"], mono_title=True)
    c.card(LX, PY, LW, 64, "focal", "patterns.md", ["a confirmed pattern"], mono_title=True)
    c.arrow([(ex, SY + SH + 1), (ex, PY - 2)])
    c.arrow([(SX[2] - 1, PY + 32), (LX + LW + 2, PY + 32)], accent=True, dashed=True)
    c.label((SX[2] + LX + LW) / 2, PY + 22, "3rd repeat only", accent=True)
    c.arrow([(lc, PY - 1), (lc, mid + 50)])
    c.label(lc + 8 + 50.5, 412, "Shapes the plan")

    ly = 556
    c.hline(40, 920, ly - 18, c.top)
    c.eyebrow(c.top, 40, ly, "Legend", fill=t["muted"], size=8)
    x = 112
    for kind, s in [("you", "you"), ("step", "a command the agent runs"), ("file", "a file it writes")]:
        c.swatch(x, ly, kind)
        c.rich(c.top, x + 24, ly, s, size=10)
        x += 24 + len(s) * 5.5 + 28
    c.stroke_sample(x, ly, accent=True, dashed=True)
    c.rich(c.top, x + 32, ly, "a pattern counts only after three separate days", size=10)
    return ly + 22, ("The daily loop, and the week around it",
                     "/weekly reads the roadmap brief, reviews the last seven days, interviews you and writes the "
                     "week's blocks. Every day /morning shows the blocks and their minimums and names the day's "
                     "anchor, the blocks happen or don't, and /evening gives a verdict on the anchor, triages the "
                     "inbox and plans tomorrow; the next day starts again at /morning. /evening closes one factual "
                     "entry a day in observation-log.md; an observation becomes a confirmed pattern in patterns.md "
                     "only on its third repeat, and confirmed patterns shape the next plan.")


# ================================================================ 3. library ==

def library_flow(c):
    t = c.t
    c.header("Library/ · drop it, compile it, ask it", "The Library pipeline")

    CW, AX, BX, CX, RX = 176, 40, 256, 472, 744
    CY, CH, GY = 136, 184, 396
    mid = CY + CH / 2
    for x, y, num, lab in [(AX, 104, "01", "Drop it · a second"), (CX, 104, "02", "Compile · you trigger it"),
                           (CX, GY - 34, "03", "Ask · whenever")]:
        c.chip(c.top, x, y, num, w=28)
        c.eyebrow(c.top, x + 38, y + 11.5, lab, fill=t["muted"], size=9)

    c.card(AX, mid - 52, CW, 104, "you", "Four ways in",
           ["Web Clipper, the main one", "`/note` · `/source`", "or a file, by hand"])
    c.card(BX, mid - 44, CW, 88, "file", "sources/inbox/", ["the queue", "waits until you compile"], mono_title=True)
    c.card(CX, CY, CW, CH, "step", "/library ingest",
           ["one source at a time", "works out what kind it is", "a quote per candidate,", "you see the list first",
            "new page, or adds to one", "MOC, `INDEX.md`, `log.md`", "source → the archive", "`lint.py` at the end"],
           mono_title=True)
    c.card(RX, CY, CW, 64, "file", "wiki/_catalog.md", ["one line, no page yet"], mono_title=True)
    c.card(RX, CY + 96, CW, 88, "focal", "A wiki page",
           ["new, or an existing one", "cites its source", "sits in the folder's MOC"])
    c.arrow([(AX + CW + 1, mid), (BX - 2, mid)])
    c.arrow([(BX + CW + 1, mid), (CX - 2, mid)])
    py, my = CY + 32, CY + 96 + 44
    c.arrow([(CX + CW + 1, py), (RX - 2, py)])
    c.arrow([(CX + CW + 1, my), (RX - 2, my)], accent=True)
    gx = (CX + CW + RX) / 2
    c.label(gx, py - 10, "Pointer")
    c.label(gx, my - 10, "Mechanism", accent=True)

    # ask
    c.card(CX, GY, CW, 88, "step", "/library <question>",
           ["reads pages, not sources", "a citation per claim", "says what isn't there"], mono_title=True)
    c.card(BX, GY, CW, 88, "you", "A cited answer",
           ["every claim links a page", "can be saved as a page,", "if you say so"])
    rx = RX + CW / 2
    c.arrow([(rx, CY + 96 + 88 + 1), (rx, GY + 44), (CX + CW + 2, GY + 44)])
    c.label(rx - 8 - 38.7, 364, "Reads pages")
    c.arrow([(CX - 1, GY + 44), (BX + CW + 2, GY + 44)])
    for i, s in enumerate(["Nothing compiles by itself.", "One source, when you say so."]):
        c.top.append(f'<text x="{AX}" y="{GY + 38 + 20 * i}" font-family="{SERIF}" font-style="italic" font-size="14" '
                     f'fill="{t["muted"]}">{esc(s)}</text>')

    ly = GY + 88 + 52
    c.hline(40, 920, ly - 18, c.top)
    c.eyebrow(c.top, 40, ly, "Legend", fill=t["muted"], size=8)
    x = 112
    for kind, s in [("you", "you"), ("step", "a command the agent runs"), ("file", "a file")]:
        c.swatch(x, ly, kind)
        c.rich(c.top, x + 24, ly, s, size=10)
        x += 24 + len(s) * 5.5 + 28
    c.stroke_sample(x, ly, accent=True)
    c.rich(c.top, x + 32, ly, "a page is written only for a real mechanism, something with a why", size=10)
    return ly + 22, ("The Library pipeline",
                     "Anything dropped through the Web Clipper, /note, /source or by hand lands in "
                     "Library/sources/inbox and waits. /library ingest compiles one source at a time: it works out "
                     "the source type, lists candidates each with a quote, shows you the list, then writes. A real "
                     "mechanism becomes a new or updated wiki page that cites its source and sits in its folder's "
                     "MOC; a mere pointer becomes one line in wiki/_catalog.md. Later, /library with a question reads "
                     "the pages, not the sources, and answers with a citation per claim.")


# ================================================================= 4. matrix ==

ZONES = [
    ("Life/ · changes daily", [
        ("Calendar", "Calendar/", ("Plans the week", "/weekly · /evening"), ("Add and drag blocks", None)),
        ("Journal", "Journal/", ("Plan sections", "/morning · /evening"), ("Write the journal", None)),
        ("Inbox", "INBOX.md", ("Triage", "/evening"), ("Add tasks", None)),
        ("Notes", "Notes/", None, ("Write your own notes", None)),
        ("Patterns", "Patterns/", ("Factual log", "/morning · /evening"), None),
        ("Avatar", "roadmap/avatar.md", ("Writes from an interview", "/avatar"), ("Your answers", None)),
        ("Brief", "roadmap-brief.md", ("Phases · priorities · Now", "/roadmap · /weekly (§6)"), ("Choose & confirm", None)),
    ]),
    ("Library/ · what you learn", [
        ("Source queue", "sources/inbox/", ("FOCAL", "New files only", "/note · /source"), ("Clip pages", None)),
        ("Wiki", "wiki/", ("Compiles pages", "/library"), None),
    ]),
    ("System/ · extras", [
        ("Checkpoints", "Checkpoints/", ("Session handoff", "/checkpoint"), None),
    ]),
]


def writers_matrix(c):
    t = c.t
    c.header("What's inside · one row per place", "Who writes where")
    CX0, CW0, RX, RW, RH = 40, 272, [328, 632], 288, 48

    def cell_text(x, y, value, sub, fill=None):
        cx = x + RW / 2
        c.name(c.nodes, cx, y + (21 if sub else 29), value, anchor="middle", fill=fill)
        if sub:
            c.eyebrow(c.nodes, cx, y + 37, sub, fill=fill or t["muted"], anchor="middle", size=9.5, spacing="0", upper=False)

    y = 104
    c.box(CX0, y, CW0, 56, "cell")
    c.name(c.nodes, CX0 + 16, y + 25, "Where it lives")
    c.eyebrow(c.nodes, CX0 + 16, y + 42, "folder or file", fill=t["muted"], size=9.5, spacing="0", upper=False)
    c.nodes.append(f'<rect x="{RX[0]}" y="{y}" width="{RW}" height="56" rx="6" fill="{t["ink"]}"/>')
    c.name(c.nodes, RX[0] + RW / 2, y + 25, "Agent", anchor="middle", fill=t["paper"])
    c.eyebrow(c.nodes, RX[0] + RW / 2, y + 42, "slash commands", fill=t["paper"], anchor="middle", size=9.5, spacing="0", upper=False)
    c.box(RX[1], y, RW, 56, "you")
    c.name(c.nodes, RX[1] + RW / 2, y + 25, "You", anchor="middle")
    c.eyebrow(c.nodes, RX[1] + RW / 2, y + 42, "by hand, in Obsidian", fill=t["muted"], anchor="middle", size=9.5, spacing="0", upper=False)

    y += 56 + 28
    for zi, (label, rows) in enumerate(ZONES):
        if zi:
            c.hline(40, 920, y - 20)
        c.eyebrow(c.top, 40, y, label, fill=t["muted"], size=9)
        y += 12
        for name, path, agent, you in rows:
            c.box(CX0, y, CW0, RH, "cell")
            c.name(c.nodes, CX0 + 16, y + 29, name)
            c.eyebrow(c.nodes, CX0 + CW0 - 16, y + 29, path, fill=t["muted"], anchor="end", size=9.5, spacing="0", upper=False)
            for x, cell, kind in ((RX[0], agent, "cell"), (RX[1], you, "you")):
                if cell is None:
                    c.box(x, y, RW, RH, "none")
                    c.name(c.nodes, x + RW / 2, y + 29, "—", anchor="middle", fill=t["soft"])
                elif cell[0] == "FOCAL":
                    c.box(x, y, RW, RH, "focal")
                    cell_text(x, y, cell[1], cell[2], fill=t["accent"])
                else:
                    c.box(x, y, RW, RH, kind)
                    cell_text(x, y, cell[0], cell[1])
            y += RH + 4
        y += 36

    ly = y + 4
    c.hline(40, 920, ly - 18, c.top)
    c.eyebrow(c.top, 40, ly, "Legend", fill=t["muted"], size=8)
    x = 112
    for kind, s in [("cell", "the agent writes here"), ("you", "you write here"), ("none", "never writes here"),
                    ("focal", "the only way from Life into Library")]:
        c.swatch(x, ly, kind)
        c.rich(c.top, x + 24, ly, s, size=10)
        x += 24 + len(s) * 5.5 + 28
    return ly + 22, ("Who writes where",
                     "One row per place in the vault, with what the agent writes there through slash commands and what "
                     "you write by hand. Life: Calendar, Journal, Inbox, Notes, Patterns, the avatar and the roadmap brief. "
                     "Library: the source queue and the wiki. System: Checkpoints. The agent never writes Notes; you "
                     "never write Patterns, the wiki or Checkpoints. The only way from Life into Library is a new file in sources/inbox.")


# ============================================================= 5. guardrails ==

def inside_guardrails(c):
    t = c.t
    c.header("Inside · two hooks, a linter, a status script", "Rules that code enforces, not the model")

    CX, CWD, CY, CH = [40, 344, 648], 272, 172, 228
    RAIL = 148
    c.arrow([(40, RAIL), (918, RAIL)])
    cards = [
        dict(when="Before every write", tag="HOOK · PreToolUse", title="library.py pre", focal=True,
             scope="Checks · where the write lands",
             lines=["Anything under `Library/sources/`", "is refused, with one exception:", "a new file in `inbox/`.",
                    "Sources can be moved, never edited."],
             code="exit 2", fail=["The write is blocked and the agent", "is told why."]),
        dict(when="Right after a wiki page is saved", tag="HOOK · PostToolUse", title="library.py post",
             scope="Checks · the one page just saved",
             lines=["frontmatter, with an `id`", "`kind` and `status` from fixed lists", "`sources:` is not empty",
                    "120 lines at most (procedure: 250)"],
             code="exit 2", fail=["“Fix this now, not at the end", "of the ingest.”"]),
        dict(when="At the end of every ingest", tag="SCRIPT · zero LLM", title="lint.py",
             scope="Checks · the whole wiki, 12 groups",
             lines=["dead links, orphan pages", "`INDEX.md` out of step with the pages",
                    "a source changed since it was ingested", "a page missing from its folder's MOC"],
             code="exit 1", fail=["Every problem is listed, by category.", "Clean means zero problems."]),
    ]
    for x, k in zip(CX, cards):
        focal = k.get("focal", False)
        mid = x + CWD / 2
        c.eyebrow(c.top, mid, RAIL - 16, k["when"], fill=t["accent"] if focal else t["muted"], anchor="middle", size=9, spacing="0.12em")
        c.arrows.append(f'<line x1="{mid}" y1="{RAIL}" x2="{mid}" y2="{CY}" stroke="{t["accent"] if focal else t["muted"]}" stroke-width="1"/>')
        c.top.append(f'<circle cx="{mid}" cy="{RAIL}" r="4" fill="{t["accent"] if focal else t["ink"]}"/>')
        c.box(x, CY, CWD, CH, "focal" if focal else "step")
        c.eyebrow(c.nodes, x + 16, CY + 24, k["tag"], upper=False, spacing="0.08em")
        c.name(c.nodes, x + 16, CY + 46, k["title"], mono=True, size=14)
        c.hline(x + 16, x + CWD - 16, CY + 60, c.nodes)
        c.eyebrow(c.nodes, x + 16, CY + 80, k["scope"], fill=t["muted"], size=8)
        for j, s in enumerate(k["lines"]):
            c.rich(c.nodes, x + 16, CY + 99 + 16 * j, s, fill=t["ink"], maxw=CWD - 32)
        c.hline(x + 16, x + CWD - 16, CY + 160, c.nodes)
        c.eyebrow(c.nodes, x + 16, CY + 180, "If it fails", fill=t["muted"], size=8)
        cw = len(k["code"]) * 5.4 + 14
        c.chip(c.nodes, x + CWD - 16 - cw, CY + 168, k["code"], accent=focal)
        for j, s in enumerate(k["fail"]):
            c.rich(c.nodes, x + 16, CY + 198 + 15 * j, s, maxw=CWD - 32)

    cy = CY + CH + 34
    c.top.append(f'<text x="480" y="{cy}" font-family="{SERIF}" font-style="italic" font-size="14" fill="{t["muted"]}" '
                 f'text-anchor="middle">Mid-ingest the wiki is legitimately inconsistent, so the hooks check one file '
                 f'and the full lint waits for the end.</text>')

    # the same idea on the Life side
    sy = cy + 26
    c.hline(40, 920, sy, c.top)
    c.eyebrow(c.top, 40, sy + 26, "The same idea on the Life side: facts computed, not eyeballed", fill=t["muted"], size=9)
    ay, ah = sy + 50, 96
    c.card(40, ay, 344, ah, "step", "vault-status.py",
           ["avatar age · days since the last `/weekly`", "gaps in the daily loop · queue sizes",
            "an active phase past its target date"], mono_title=True, pad=16)
    # two consumers; the script's right edge is fanned at thirds (rule 4)
    m1, m2 = ay + 14, ay + 82
    for my, title, mono, sub in [(m1, "/weekly", True, "runs it first, says each WARN once"),
                                 (m2, "Hub · Status tab", False, "shows the snapshot")]:
        c.box(608, my - 22, 312, 44, "step")
        c.name(c.nodes, 624, my + 4, title, mono=mono)
        c.rich(c.nodes, 624 + len(title) * (7.2 if mono else 6.6) + 12, my + 4, sub)
    a1, a2 = ay + 32, ay + 64
    c.arrow([(385, a1), (552, a1), (552, m1), (606, m1)])
    c.arrow([(385, a2), (552, a2), (552, m2), (606, m2)])
    c.label(468, a1 - 10, "Prints checks")
    c.label(468, a2 + 16.5, "System/status.json", upper=False)

    ly = ay + ah + 52
    c.hline(40, 920, ly - 18, c.top)
    c.eyebrow(c.top, 40, ly, "Legend", fill=t["muted"], size=8)
    c.swatch(112, ly, "focal")
    c.rich(c.top, 136, ly, "the one hard wall: source files are immutable", size=10)
    w = c.chip(c.top, 404, ly - 11.5, "exit 2")
    c.rich(c.top, 404 + w + 8, ly, "stops the agent and shows it the message", size=10)
    w2 = c.chip(c.top, 686, ly - 11.5, "exit 1")
    c.rich(c.top, 686 + w2 + 8, ly, "there are problems to fix", size=10)
    return ly + 22, ("Rules that code enforces, not the model",
                     "Three checks in the order they fire during a Library ingest, plus the status script: the "
                     "PreToolUse hook library.py pre refuses any write under Library/sources except a new file in "
                     "inbox; the PostToolUse hook library.py post checks the one wiki page just saved for frontmatter, "
                     "id, kind, status, sources and a 120-line limit (250 for procedures); lint.py runs at the end of "
                     "every ingest across the whole wiki in 12 groups of checks. On the Life side vault-status.py "
                     "computes avatar age, days since the last /weekly, gaps in the daily loop, queue sizes and overdue "
                     "phases; /weekly runs it first and the Hub Status tab shows its status.json snapshot.")


# ==================================================================== render ==

PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link href="{fonts}" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: {paper}; color: {ink}; font-family: {sans}; }}
    .frame {{ max-width: {w}px; margin: 0 auto; }}
    .diagram-container {{ width: 100%; overflow-x: auto; }}
    svg {{ width: 100%; min-width: {w}px; display: block; }}
    @media print {{
      .diagram-container {{ overflow-x: visible; }}
      svg {{ min-width: 0; }}
    }}
  </style>
</head>
<body>
  <div class="frame">
    <div class="diagram-container">
      <svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">
        <title id="{slug}-title">{title}</title>
        <desc id="{slug}-desc">{desc}</desc>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{muted}"/></marker>
          <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{accent}"/></marker>
        </defs>
        <rect width="100%" height="100%" fill="{paper}"/>
        {body}
      </svg>
    </div>
  </div>
</body>
</html>
"""


def render(diagrams):
    for name, fn in diagrams:
        for mode, t in THEMES.items():
            slug = name if mode == "light" else f"{name}-dark"
            c = Canvas(t, slug)
            h, (title, desc) = fn(c)
            body = "\n        ".join(c.zones + c.arrows + c.labels + c.nodes + c.top)
            out = HERE / f"{slug}.html"
            out.write_text(PAGE.format(title=esc(title), desc=esc(desc), fonts=FONTS.replace("&", "&amp;"), sans=SANS,
                                       w=W, h=int(h), slug=slug, body=body, **{k: t[k] for k in ("paper", "ink", "muted", "accent")}),
                           encoding="utf-8")
            print(out.name, f"{W}x{int(h)}")


if __name__ == "__main__":
    render([("system-pipeline", system_pipeline),
            ("life-loop", life_loop),
            ("library-flow", library_flow),
            ("writers-matrix", writers_matrix),
            ("inside-guardrails", inside_guardrails)])
