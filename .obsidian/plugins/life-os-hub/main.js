'use strict';
const { Plugin, ItemView, Modal, Notice, Platform, moment, setIcon } = require('obsidian');

const VIEW_TYPE = 'life-os-hub';

// Where a banner image dropped straight onto the Overview tab gets saved —
// see the drag-and-drop handler on .cc-banner below. findBanner then finds
// it the same way it finds a manually-placed file: by name, not by path.
const BANNER_DIR = 'System/Attachments/banners';
// The previous banner doesn't just vanish on a new drop — it lands here,
// numbered, see onBannerDrop. A sibling of banners/, not a subfolder of it —
// otherwise findBanner (substring match on the full path) would pick up
// archived files too.
const BANNER_ARCHIVE_DIR = 'System/Attachments/old-banners';

// Life zone. Calendar, journal and INBOX live under `Life/`, so an agent that
// `cd`s into that zone sees only its own scope. One place for these paths —
// they used to be hardcoded literally in a dozen lines.
const LIFE_ROOT = 'Life';
const CAL_DIR = LIFE_ROOT + '/Calendar';
const JOURNAL_DIR = LIFE_ROOT + '/Journal';
const INBOX_PATH = LIFE_ROOT + '/INBOX.md';

// Status tab + script runner. The tab only DISPLAYS System/status.json, which
// System/scripts/vault-status.py writes — all the logic (thresholds, dates)
// lives in that one script, so /weekly and this tab can't disagree. The
// Refresh button runs it; on a phone (no Node) the tab still shows the last
// snapshot and says how to refresh it.
const STATUS_PATH = 'System/status.json';
// Overridable with a `scripts` array in this plugin's data.json. Each entry is
// { name, cmd }; see parseScriptCmd for what a cmd may be.
const DEFAULT_SCRIPTS = [
  { name: 'Vault status', cmd: 'python3 System/scripts/vault-status.py --write' },
  { name: 'Library lint', cmd: 'python3 Library/lint.py' },
];
const SCRIPT_TIMEOUT_MS = 120000;

// A script entry runs WITHOUT a shell: `python3|py <System|Library>/<path>.py
// [--flag ...]`. data.json is a file that travels with a cloned vault, so
// this is deliberately narrow — the button can start a Python script that
// lives inside the vault, nothing else, and the command is shown before it runs.
function parseScriptCmd(cmd, platform = (typeof process !== 'undefined' ? process.platform : '')) {
  const [exe, script, ...flags] = String(cmd || '').trim().split(/\s+/);
  if (exe !== 'python3' && exe !== 'py') return null;
  if (!/^(System|Library)\/[A-Za-z0-9_\-\/]+\.py$/.test(script || '')) return null;
  if (!flags.every(f => /^--?[A-Za-z0-9-]+$/.test(f))) return null;
  // `py` is the Windows launcher, `python3` the name everywhere else.
  return { exe: platform === 'win32' ? 'py' : 'python3', args: [script, ...flags] };
}

// Colors tab. The palette Life OS Hub paints itself with (--cc-* are the
// same variables the Style Settings block at the top of styles.css exposes)
// and the handful of Obsidian theme variables worth peeking at. `live` is the
// variable the view actually renders with: the swatch shows what's on screen,
// which after themes, snippets and Style Settings is not necessarily what
// the --cc-* variable holds (e.g. light mode ignores --cc-card entirely).
const COLOR_STYLE_ID = 'cc-color-overrides';
const CC_COLORS = [
  { key: '--cc-accent', live: '--g', label: 'Accent' },
  { key: '--cc-accent-dark', live: '--gd', label: 'Accent — darker' },
  { key: '--cc-card', live: '--card', label: 'Card', darkOnly: true },
  { key: '--cc-border', live: '--bd', label: 'Border', darkOnly: true },
  { key: '--cc-sub', live: '--sub', label: 'Secondary text', darkOnly: true },
];
const THEME_COLORS = [
  { key: '--interactive-accent', live: '--interactive-accent', label: 'Interactive accent' },
  { key: '--background-primary', live: '--background-primary', label: 'Background' },
  { key: '--background-secondary', live: '--background-secondary', label: 'Background — secondary' },
  { key: '--text-normal', live: '--text-normal', label: 'Text' },
  { key: '--text-muted', live: '--text-muted', label: 'Text — muted' },
];
// The window background is not a CSS variable: the picture behind everything
// is a gradient set on <body> itself (Border theme via Style Settings), and
// the file explorer, sidebars and editor are transparent panes that let it
// show through. So "the background of everything" means replacing that one
// paint, per mode, rather than editing --background-primary (which those
// panes don't use). Stored as settings.background[mode]: null (leave the
// theme alone), {kind:'solid', color} or {kind:'gradient', angle, stops}.
// See applyColorOverrides.
const BG_MODES = [['dark', 'Dark mode'], ['light', 'Light mode']];
const BG_MIN_STOPS = 2, BG_MAX_STOPS = 4, BG_MAX_GLOWS = 4;
// A glow is a soft spot of colour laid over the base, like the blobs in the
// theme's own background: {x, y} are % of the window, size is how far it
// fades (% of the far-corner radius), alpha 0-100.
// The presets are the vault's stock look (the values the theme ships with in
// Style Settings), so 'Aurora' recreates what you see before touching anything.
const BG_AURORA = {
  dark: { kind: 'gradient', angle: 160, stops: ['#07070E', '#14142A', '#08080F'], glows: [
    { x: 22, y: 18, color: '#444477', alpha: 34, size: 55 },
    { x: 72, y: 42, color: '#8C462D', alpha: 24, size: 48 },
    { x: 50, y: 92, color: '#A8D8B4', alpha: 14, size: 52 },
  ] },
  light: { kind: 'gradient', angle: 160, stops: ['#F8F9FB', '#E6E8F0', '#F1F2F6'], glows: [
    { x: 22, y: 18, color: '#555588', alpha: 13, size: 55 },
    { x: 72, y: 40, color: '#E8836F', alpha: 13, size: 48 },
    { x: 50, y: 92, color: '#668899', alpha: 18, size: 52 },
  ] },
};
const BG_GLOW_SPOTS = [[22, 18], [72, 42], [50, 92], [85, 10]];
const ALL_COLOR_KEYS = new Set([...CC_COLORS, ...THEME_COLORS].map(c => c.key));
const WCAG_MIN_CONTRAST = 4.5;        // AA for body text
const PALETTE_SIZE = 6;
const PALETTE_SAMPLE = 64;            // longest side of the analysed thumbnail

// ---- colour maths (pure functions, no DOM) --------------------------------

function normHex(s) {
  if (typeof s !== 'string') return null;
  let h = s.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : null;
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + h(r) + h(g) + h(b)).toUpperCase();
}
// WCAG 2.x relative luminance and contrast ratio.
function luminance([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(rgbA, rgbB) {
  const a = luminance(rgbA), b = luminance(rgbB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// CIE Lab (D65): distances in RGB overweight green and underweight blue, so
// "very similar" is judged here, not in RGB.
function rgbToLab([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labDist(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// Dominant colours of an RGBA pixel buffer: median cut for the candidate
// boxes, then a pick that favours saturated colours, then one k-means-style
// reassignment so the reported shares add up to 100% and describe the image,
// not the selection.
//
// Saturation weighting decides only WHICH colours get a swatch. Without it a
// photo that is 70% grey sky gives you five greys and no accent candidate.
// The percentage under each swatch is the plain share of pixels it stands for.
function extractPalette(rgba, count = PALETTE_SIZE) {
  // 5 bits per channel: a 64×64 thumbnail has up to 4096 pixels, and this
  // collapses near-duplicates before any splitting happens.
  const bins = new Map();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;     // GIF transparency index / cut-out edges
    const k = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
    let e = bins.get(k);
    if (!e) bins.set(k, e = { r: 0, g: 0, b: 0, n: 0 });
    e.r += rgba[i]; e.g += rgba[i + 1]; e.b += rgba[i + 2]; e.n++;
    total++;
  }
  if (!total) return [];
  const px = Array.from(bins.values()).map(e => {
    const rgb = [e.r / e.n, e.g / e.n, e.b / e.n];
    return { rgb, lab: rgbToLab(rgb), n: e.n };
  });

  // Median cut into more boxes than we'll show, so the pick below has
  // something to choose from.
  const centroid = (list) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const p of list) { r += p.rgb[0] * p.n; g += p.rgb[1] * p.n; b += p.rgb[2] * p.n; n += p.n; }
    return { rgb: [r / n, g / n, b / n], n };
  };
  const boxes = [px];
  const target = Math.min(px.length, count * 3);
  while (boxes.length < target) {
    let best = -1, bestScore = 0, bestCh = 0;
    boxes.forEach((box, bi) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0, n = 0;
        for (const p of box) { lo = Math.min(lo, p.rgb[ch]); hi = Math.max(hi, p.rgb[ch]); n += p.n; }
        const score = (hi - lo) * Math.sqrt(n);
        if (score > bestScore) { bestScore = score; best = bi; bestCh = ch; }
      }
    });
    if (best < 0) break;
    const box = boxes[best].slice().sort((a, b) => a.rgb[bestCh] - b.rgb[bestCh]);
    const half = box.reduce((s, p) => s + p.n, 0) / 2;
    let acc = 0, cut = 0;
    while (cut < box.length - 1 && acc + box[cut].n <= half) acc += box[cut++].n;
    cut = Math.max(1, cut);
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  const cands = boxes.map(centroid).map(c => {
    const lab = rgbToLab(c.rgb);
    const chroma = Math.min(1, Math.hypot(lab[1], lab[2]) / 60);
    return { rgb: c.rgb, lab, score: (c.n / total) * (0.3 + 0.7 * chroma) };
  }).sort((a, b) => b.score - a.score);

  // Merge threshold relaxes until there are enough distinct colours; a flat
  // image legitimately ends up with fewer.
  let picked = [];
  for (const minDist of [14, 9, 5]) {
    picked = [];
    for (const c of cands) {
      if (picked.length >= count) break;
      if (picked.every(p => labDist(p.lab, c.lab) >= minDist)) picked.push(c);
    }
    if (picked.length >= count - 1) break;
  }

  const sums = picked.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
  for (const p of px) {
    let bi = 0, bd = Infinity;
    picked.forEach((c, i) => { const d = labDist(c.lab, p.lab); if (d < bd) { bd = d; bi = i; } });
    const s = sums[bi];
    s.r += p.rgb[0] * p.n; s.g += p.rgb[1] * p.n; s.b += p.rgb[2] * p.n; s.n += p.n;
  }
  return sums.filter(s => s.n).map(s => ({
    hex: rgbToHex(s.r / s.n, s.g / s.n, s.b / s.n),
    share: s.n / total,
  })).sort((a, b) => b.share - a.share);
}

// Any CSS colour string → '#RRGGBB'. Computed values of theme variables come
// back as hsl(), rgb(), color-mix() results and so on, so the canvas does the
// parsing instead of a hand-rolled regex per format.
let _colorProbe = null;
function cssColorToHex(value) {
  const v = (value || '').trim();
  if (!v || !CSS.supports('color', v)) return null;
  if (!_colorProbe) { _colorProbe = document.createElement('canvas'); _colorProbe.width = _colorProbe.height = 1; }
  const ctx = _colorProbe.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (!a) return null;
  return rgbToHex(r, g, b);
}

// The CSS for a background config. Only validated hex strings and a clamped
// integer are ever interpolated, so this is safe to write into a <style>.
function backgroundCss(cfg) {
  if (!cfg) return null;
  // Glows are the top layers, the base (a colour or a linear gradient) is the last one.
  const layers = (cfg.glows || []).map(g => {
    const [r, gr, b] = hexToRgb(g.color);
    return `radial-gradient(circle at ${g.x}% ${g.y}%, rgba(${r}, ${gr}, ${b}, ${(g.alpha / 100).toFixed(2)}) 0%, transparent ${g.size}%)`;
  });
  layers.push(cfg.kind === 'solid' ? cfg.color : `linear-gradient(${cfg.angle}deg, ${cfg.stops.join(', ')})`);
  return layers.join(', ');
}
function mixHex(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

// The stock accent pairs (#8FBFB4 → #6B948F, #3E6B63 → #2F5A52) differ by
// roughly 0.77 per channel.
function darkenHex(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * 0.77, g * 0.77, b * 0.77);
}

// Book tab. A dose short enough that you still want to come back, and
// dictating a takeaway right when the bell rings is the one thing that
// separates reading from page-flipping. The user types the length by hand
// each time — no fixed set of presets to pick from.
const BOOK_FOLDER = 'Library/books';
const BOOK_MINUTES = 30;              // default for a fresh install
// The button rendered INSIDE the session note ("DONE"). It exists because the
// modal that used to pop up when the bell rang interrupted mid-read and got
// dismissed — so the takeaway never got written and the session was lost. The
// in-note button closes the session when the user actually finishes, not when
// the timer happens to ring.
const DONE_BLOCK = 'done';
const DONE_FENCE = '```' + DONE_BLOCK + '\n```';
// The note pane takes 1/4 of the width — the book is the hero of the screen,
// the note is just a margin to paste into.
const NOTE_PANE_PCT = 25;
// Section headings in the session file — the widget appends takeaways under
// SEC_LESSONS, so changing these strings must go together with migrating
// existing files.
const SEC_NOTES = 'Reading notes';
const SEC_LESSONS = 'What I learned';
const SEC_MAP = 'Mind map';
// Windows/iCloud choke on these characters in filenames, and Obsidian also
// treats #^[]| as link syntax — the takeaway's filename is built from dictated
// text, so it has to survive this filter.
const FS_BAD_RE = /[\\/:*?"<>|#^[\]]/g;

// Wiki tab — browsing the Library without the file-tree sidebar. Reason: once
// a knowledge base has dozens of pages across several folders, the file
// explorer stops answering "where was that" — you have to expand folders and
// read filenames. The search box answers immediately, and frontmatter
// `alias:` acts as hand-written synonyms.
const WIKI_ROOT = 'Library/wiki';
const WIKI_INDEX = 'Library/INDEX.md';
// The queue waiting to be processed. Per SCHEMA.md, `sources/inbox/` is ONE
// queue for everything (notes, clipped sources, web clips all land there);
// folders named after source type are the archive a file moves to AFTER
// ingestion. So this panel only counts the inbox — everything else is already
// done, and counting it too would be misleading.
const WIKI_INBOX = 'Library/sources/inbox';
// All the raw material the wiki was built from. Kept separate from
// `WIKI_INBOX` because it answers a different question: inbox is "what's
// still unprocessed", this is "what do I have at all" — including originals
// the user has annotated, which are richer than the outside source.
const WIKI_SOURCES = 'Library/sources';
const WIKI_LOG = 'Library/log.md';
// How many recent log entries to show. Three, because the panel answers
// "what changed recently", not a replacement for reading `log.md` itself.
const WIKI_LOG_N = 3;
// Files that live directly in `wiki/` (hot.md, _catalog.md) — not part of any
// topic folder, but still need to be visible or they look lost.
const WIKI_ROOT_LABEL = '(root)';
// Filter-chip order. NOT an allowlist of types — those are built from what's
// actually in the files. A fixed short list used to silently drop pages
// whose `kind` wasn't on it, so the chip counts no longer matched "all".
const WIKI_TYPE_ORDER = ['moc', 'concept', 'entity', 'procedure'];
const WIKI_STATUSES = ['active', 'draft', 'disputed', 'stale'];
// Navigation files, not knowledge pages: `_catalog.md` and `hot.md`. By
// definition they have no `sources:`, so without this exception they'd sit in
// "Needs attention" forever — and a section with two permanent, unfixable
// entries stops being read.
const WIKI_NAV_TYPES = ['catalog', 'hot'];
// How many characters of context to show around a content match. Too few and
// you can't tell if it's the right page; too many and the row wraps and the
// list stops being scannable.
const WIKI_SNIPPET = 34;

// Accent-insensitive search. Measured on a real wiki: typing fast, nobody
// bothers with diacritics, so a search that requires them exactly lies about
// pages not existing when they do.
// NFD decomposition + stripping combining marks handles most accented Latin
// letters, but input goes through NFC first so the result has the SAME
// length as the original: match position is later used to cut a context
// snippet from the raw text, and a length change would shift the cut.
function foldDiacritics(s) {
  return String(s).normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
// Filenames use hyphens (`git-restore-staged-undo-add`), users type spaces.
// This normalization applies ONLY to headers (name/id/alias/description) — in
// page body text a hyphen can be meaningful, and folding it would break
// searches for things like `--cached`.
function flattenHeading(s) {
  return foldDiacritics(s).toLowerCase().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Unfinished spots in the Library have TWO sources, and both are needed
// because either alone lies. `[TODO: ...]` markers are rare — SCHEMA says to
// use them instead of a filler sentence, so they signal "a sentence is
// missing here". The bulk of gaps live in the `## What's not here yet` section
// of each MOC, which lists whole-topic gaps. The first list alone would look
// broken (a handful of hits across the whole wiki); the second alone would
// miss gaps inside individual pages.
function wikiTodos(content, kind) {
  const out = [];
  for (const m of content.matchAll(/\[TODO:([^\]]*)\]/g)) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  if (kind === 'moc') {
    const i = content.search(/^##\s+What'?s not here/mi);
    if (i >= 0) {
      for (const line of content.slice(i).split(/\r?\n/).slice(1)) {
        if (/^##\s/.test(line)) break;              // end of section
        const m = line.match(/^\s*[-*]\s+(.+)$/);
        if (m) out.push(m[1].trim());
      }
    }
  }
  // `**` and `[[ ]]` stay in the file, but in a single-line panel row they're noise.
  return out.map(t => t.replace(/\*\*/g, '').replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, '$1'));
}

// Date command anywhere in a task's text: /today, /tomorrow, /DD-MM-YYYY.
// Groups: 1=today 2=tomorrow 3=DD 4=MM 5=YYYY.
const DATE_CMD_RE = /\/(?:(today)|(tomorrow)|(\d{2})-(\d{2})-(\d{4}))\b/i;

// --- helpers ---
function ymd(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  try { return moment(v).format('YYYY-MM-DD'); } catch (e) { return String(v).slice(0, 10); }
}
function iconFor(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('cv') || t.includes('resume')) return '📄';
  if (t.includes('gym') || t.includes('workout')) return '🏋️';
  if (t.includes('obsidian') || t.includes('code') || t.includes('plugin')) return '🖥️';
  if (t.includes('morning') || t.includes('reset') || t.includes('dinner')) return '☕';
  if (t.includes('wind down') || t.includes('evening') || t.includes('sleep')) return '🌙';
  if (t.includes('break')) return '⏸️';
  if (t.includes('meeting') || t.includes('call') || t.includes('appointment')) return '📍';
  return '▫️';
}
// Task categories = hashtags ONLY. No guessing from the text — a word like
// "call" or "job" appearing in a sentence used to silently drop the task into
// a category the user never chose. A tag must be separated by a space (or
// start the line) and runs to the next space.
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu;
function tagsOf(s) {
  const out = [];
  for (const m of String(s || '').matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    if (!out.includes(tag)) out.push(tag);
  }
  return out;
}
// Icons for tags the user actually has in the vault today. An unknown tag
// falls back to '#' and still works — the chip bar is built from whatever
// is really in INBOX.
const TAG_ICONS = {
  top: '⭐', scheduled: '📅',
  job: '💼', school: '🎓', project: '🛠️', obsidian: '🖥️', life: '🌿',
  home: '🏠', health: '🩺', gym: '🏋️',
};
// Two STATE tags, above the categories — they handle things with a date far
// in the future:
//   #top       — user writes it to mark something TOP. Waits for /evening.
//   #scheduled — set by /evening after it creates a Calendar/ entry with important: true.
// Kept separate on purpose: without this you couldn't tell "just added" from
// "already processed", and every /evening run would re-add the same
// recurring item to the calendar.
const TOP_TAGS = ['top'];
// Placeholder of the "new task" field — lists every command the line understands.
const NEW_TASK_HINT = 'New task…  date: /today /tomorrow /30-07-2026  ·  ⭐ important: #top  ·  category: #job #school #life…';
const DONE_TAGS = ['scheduled'];
function isTopTask(t) { return (t.tags || tagsOf(t.text)).some(x => TOP_TAGS.includes(x)); }
// Dragging into the ⭐ bucket = appending this one tag.
const TOP_TAG_WRITE = 'top';
function withTopTag(line) {
  return isTopTask({ text: line }) ? line : line.replace(/[ \t]+$/, '') + ` #${TOP_TAG_WRITE}`;
}
function withoutTopTag(line) {
  return line
    .replace(/(?:^|\s)#(?:top)(?![\p{L}\p{N}_/-])/giu, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/, '');
}
// Dragging into a date bucket must CHANGE ⏳ in the file, not just move the
// line. Without this, the task snapped back to its old spot on the next
// render — that's what the "can't move an overdue task to today" and "can't
// drop a task from Later into No date" bugs looked like: the write succeeded,
// it just only touched ordering.
// iso = null → strip the date (the "No date" bucket).
function withDate(line, iso) {
  const stripped = line
    .replace(/⏳[ \t]?\d{4}-\d{2}-\d{2}[ \t]*/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/, '');
  if (!iso) return stripped;
  // ⏳ lands before the first #tag, or at the end of the line if there is
  // none. That's what hand-typed dates look like, so INBOX stays readable
  // without the plugin.
  const m = stripped.match(/(?:^|[ \t])#[\p{L}\p{N}_/-]+/u);
  if (m) return `${stripped.slice(0, m.index)} ⏳ ${iso}${stripped.slice(m.index)}`;
  return `${stripped} ⏳ ${iso}`;
}
function isInCalendar(t) { return (t.tags || tagsOf(t.text)).some(x => DONE_TAGS.includes(x)); }
function tagIcon(tag) { return TAG_ICONS[tag] || '#️⃣'; }

class LifeOsHubView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = 'overview';
    // focus timer state (survives tab switches)
    this.timer = { remaining: 25 * 60, running: false, handle: null };
    // book timer — separate state, so reading doesn't reset the focus-block countdown.
    // `startPage` is the PDF page captured when the block starts — the beginning of
    // the range that lands in `pages:` after the bell, with nothing to type.
    this.bookTimer = { remaining: BOOK_MINUTES * 60, running: false, handle: null, startPage: null };
    // day shown in Overview — back/forward navigation
    this.selectedDate = moment().startOf('day');
    // task view range: 'day' or 'week'
    this.taskRange = 'day';
    // project filter in Overview: all / job / school / life / ...
    this.filter = 'all';
    // fixed hours (6–24) in the day grid instead of auto-fit
    this.fixedHours = true;
    // Wiki tab. State survives re-render, because edit actions (move, change
    // status) call a full render() — otherwise the search query would vanish
    // on every change and you'd have to retype it.
    this.wikiQuery = '';
    this.wikiType = 'all';
    this.wikiOpen = new Set();       // expanded folders
    // Collapsed subsections of an open folder (`<folder>/content`, `<folder>/todo`).
    // We track COLLAPSED, not expanded: a folder expands so you can see its
    // contents, so everything is visible by default and the set only notes exceptions.
    this.wikiSubShut = new Set();
    this.wikiEdit = null;            // path of the page with its edit panel open
    this.wikiSrc = null;             // path of the page with its originals list expanded
    this.wikiKill = null;            // path of the page waiting for trash confirmation
    this.wikiQueueOpen = false;      // expanded source-queue / log bar
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Life OS Hub'; }
  getIcon() { return 'layout-dashboard'; }

  async onOpen() {
    this.render();
    // Light/dark toggle — lives in the tab's own icon strip (next to pin /
    // more-options), not in the scrolling content, so it's fixed on screen
    // for free and needs no sticky-positioning CSS of its own. Routed through
    // Obsidian's own core command rather than just flipping body classes, so
    // the setting actually persists and stays in sync with Settings →
    // Appearance — a plugin flipping classes on its own would drift from it
    // on the next restart.
    this._themeToggleEl = this.addAction(
      document.body.classList.contains('theme-light') ? 'moon' : 'sun',
      'Toggle light/dark theme',
      () => this.toggleTheme(),
    );
    // auto-refresh when Calendar/Journal/INBOX changes (e.g. from Claude Code)
    const onVaultChange = (file) => {
      if (!file || !file.path) return;
      // `Library/books/` matters too: without it the "Recent takeaways" list
      // would freeze at the last render and a note created later that day
      // wouldn't show up — looking like a lost session when it was just a stale tab.
      // `Library/` matters because the wiki tab shows what the library compile
      // mode produced in another window — without it the tab would show
      // pre-ingest state.
      // A dropped-in "dark mode"/"light mode" image counts too — see findBanner
      // below. Otherwise the banner would sit stale until the ↻ button is
      // clicked, which reads as a bug rather than "drop a file, it just works".
      const isBannerImage = /\.(gif|png|jpe?g|webp|avif)$/i.test(file.path)
        && /dark mode|light mode/i.test(file.path);
      const relevant = file.path.startsWith(CAL_DIR + '/') || file.path.startsWith(JOURNAL_DIR + '/')
        || file.path.startsWith(BOOK_FOLDER + '/') || file.path === INBOX_PATH
        || file.path.startsWith('Library/') || isBannerImage;
      if (!relevant) return;
      // Change caused by US (checking off a task, adding one, resolving a date)
      // — the UI is already updated optimistically, so a full re-render would
      // just flash the screen with no new information. React only to changes
      // from outside (Claude Code, manual edit, sync from phone).
      if (Date.now() < (this._selfWriteUntil || 0)) return;
      if (this.contentEl.querySelector('input:focus')) return; // don't interrupt typing
      clearTimeout(this._refreshTO);
      this._refreshTO = setTimeout(() => this.render(), 600);
    };
    // The Wiki index keys on "path + mtime", but frontmatter comes from
    // metadataCache, which updates AFTER the file is written. Without this,
    // a freshly created page stayed in the index with an empty `kind`/`status`
    // until the next file change — looking like a page with no type, even
    // though the type was there from the start.
    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      if (file && file.path && file.path.startsWith('Library/')) this._wikiIdx = null;
    }));
    this.registerEvent(this.app.vault.on('modify', onVaultChange));
    this.registerEvent(this.app.vault.on('create', onVaultChange));
    this.registerEvent(this.app.vault.on('delete', onVaultChange));
    this.registerEvent(this.app.vault.on('rename', onVaultChange));
    // css-change also fires after a theme, snippet or Style Settings edit, so
    // the Colors tab re-reads its live values instead of showing stale ones.
    this.registerEvent(this.app.workspace.on('css-change', () => {
      this.syncThemeIcon();
      if (this.tab === 'colors') requestAnimationFrame(() => this.refreshColors());
    }));

    // Banner drag-and-drop, registered on the WINDOW rather than on the
    // banner element itself. The banner has pointer-events: none once it
    // has an image (so it can't steal clicks from content riding on top of
    // it during scroll — see styles.css), which would also block it from
    // ever receiving a drop. Listening on window and hit-testing the
    // banner's own rect on every dragover sidesteps that entirely, and
    // works the same whether the banner is empty or already has a picture —
    // dragging a new one over an existing banner replaces it.
    this.registerDomEvent(window, 'dragover', (ev) => this.onBannerDragOver(ev));
    this.registerDomEvent(window, 'drop', (ev) => this.onBannerDrop(ev));
  }
  async onClose() {
    if (this.timer.handle) clearInterval(this.timer.handle);
    if (this.bookTimer.handle) clearInterval(this.bookTimer.handle);
    clearTimeout(this._refreshTO);
  }

  // `app:toggle-appearance` is Obsidian's own core command — same one behind
  // Settings → Appearance and the command palette entry — so the result
  // actually persists and matches what Settings shows, instead of a
  // plugin-local flag that drifts from the real setting after a restart.
  // Falls back to a visual-only class flip if a future Obsidian build ever
  // renames that command id, rather than the button silently doing nothing.
  toggleTheme() {
    const ok = this.app.commands.executeCommandById('app:toggle-appearance');
    if (!ok) {
      document.body.classList.toggle('theme-light');
      document.body.classList.toggle('theme-dark');
    }
    this.syncThemeIcon();
  }

  // Keeps the icon right not just after our own toggle, but also if the
  // theme changes from elsewhere (Settings, "same as system" following an OS
  // switch) while this view is open.
  syncThemeIcon() {
    if (!this._themeToggleEl) return;
    setIcon(this._themeToggleEl, document.body.classList.contains('theme-light') ? 'moon' : 'sun');
  }

  // ---------- DATA ----------
  fm(file) { return this.app.metadataCache.getFileCache(file)?.frontmatter || {}; }

  blocksForDay(m) {
    const day = m.format('YYYY-MM-DD');
    return this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(CAL_DIR + '/'))
      .map(f => ({ f, fm: this.fm(f) }))
      .filter(x => x.fm.type === 'single' && ymd(x.fm.date) === day)
      .sort((a, b) => String(a.fm.startTime || '').localeCompare(String(b.fm.startTime || '')));
  }

  journalByDay() {
    const map = {};
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(JOURNAL_DIR + '/')) continue;
      const day = f.basename.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) map[day] = { f, fm: this.fm(f) };
    }
    return map;
  }

  async inboxTasks() {
    const file = this.app.vault.getAbstractFileByPath(INBOX_PATH);
    if (!file) return [];
    const data = await this.app.vault.cachedRead(file);
    return data.split(/\r?\n/)
      .filter(l => /^\s*-\s*\[ \]\s+/.test(l))
      .map(l => l.replace(/^\s*-\s*\[ \]\s+/, '').trim());
  }

  // ---------- ACTIONS ----------
  async toggleDone(block, rowEl, btnEl) {
    // optimistic in memory — we do NOT re-read the cache right after saving (was an off-by-one bug)
    const newVal = block.fm.completed ? false : moment().format('YYYY-MM-DD');
    block.fm.completed = newVal;
    rowEl.toggleClass('done', !!newVal);
    btnEl.setText(newVal ? '✅' : '☐');
    this.updateRing();
    try {
      this.markSelfWrite();
      await this.app.fileManager.processFrontMatter(block.f, (f) => { f.completed = newVal; });
    } catch (e) { new Notice('Error saving completed'); }
  }

  updateRing() {
    if (!this.ringEl || !this.currentBlocks) return;
    const done = this.currentBlocks.filter(b => b.fm.completed).length;
    const total = this.currentBlocks.length || 1;
    const pct = Math.round((done / total) * 100);
    const C = 2 * Math.PI * 34;
    this.ringEl.innerHTML = `<svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="7"/>
      <circle cx="40" cy="40" r="34" fill="none" stroke="#4ade80" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 40 40)"/>
      <text x="40" y="46" text-anchor="middle" fill="#4ade80" font-size="18" font-weight="700">${pct}%</text></svg>
      <div class="cc-ring-cap"><b>${done}/${this.currentBlocks.length}</b> blocks</div>`;
  }

  async openFullCalendar() {
    const leaf = this.app.workspace.getLeaf('split', 'vertical');
    await leaf.setViewState({ type: 'full-calendar-view', active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async addToInbox(text) {
    const file = this.app.vault.getAbstractFileByPath(INBOX_PATH);
    if (!file) { new Notice('INBOX.md not found'); return; }
    this.markSelfWrite();
    await this.app.vault.process(file, (data) => data.replace(/\s*$/, '') + `\n- [ ] ${text}`);
    new Notice('✅ Added to INBOX');
    await this.render();
  }

  today() { return moment().format('YYYY-MM-DD'); }

  // Date label for a task pulled out of a date bucket (⭐, banner) — there the
  // date alone says nothing, since you can't see which section the task lives in.
  whenLabel(date) {
    if (!date) return 'no date';
    const today = this.today();
    if (date === today) return 'today';
    if (date === moment().add(1, 'day').format('YYYY-MM-DD')) return 'tomorrow';
    const d = moment(date, 'YYYY-MM-DD');
    return date < today ? `${d.format('DD.MM')} · overdue` : d.format('DD.MM');
  }

  // Text for DISPLAY only (the file stays untouched). We strip metadata and
  // markdown syntax — in a list, `**bold**` and backticks are just visual noise.
  cleanTask(s) {
    return s
      .replace(DATE_CMD_RE, '')
      // STATE tags are stripped from the preview — the icon (⭐ / 📅) and the
      // section the task sits in already say it. Category tags (#job, #obsidian) stay: they carry content.
      .replace(/(?:^|\s)#(?:top|scheduled)(?![\p{L}\p{N}_/-])/giu, ' ')
      // the `u` flag is REQUIRED: 📅 is a surrogate pair, so without it the
      // character class matches half of it and leaves an orphan that renders as "�"
      .replace(/[📅⏳]\s?\d{4}-\d{2}-\d{2}/gu, '')
      .replace(/\(⌛[^)]*\)/g, '')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[*`]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Rule for entering a date: by default EVERY new task lands in "no date".
  // To give it one, the user types a command anywhere in the text (start,
  // end, doesn't matter): /today, /tomorrow, or /DD-MM-YYYY (e.g. /30-07-2026).
  // On the first render, that command "crystallizes" into a real ⏳ date
  // written directly into INBOX.md — from then on the task ages normally like any other
  // (a ⏳ in the past = overdue).
  async resolveDateCommands() {
    const file = this.app.vault.getAbstractFileByPath(INBOX_PATH);
    if (!file) return;
    const data = await this.app.vault.cachedRead(file);
    const needsFix = data.split(/\r?\n/).some(raw => /^\s*-\s*\[ \]/.test(raw) && DATE_CMD_RE.test(raw));
    if (!needsFix) return;
    const today = this.today();
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    this.markSelfWrite();
    await this.app.vault.process(file, (d) => d.split(/\r?\n/).map(raw => {
      if (!/^\s*-\s*\[ \]/.test(raw)) return raw;
      const m = raw.match(DATE_CMD_RE);
      if (!m) return raw;
      const iso = m[1] ? today : m[2] ? tomorrow : `${m[5]}-${m[4]}-${m[3]}`;
      // the command ALWAYS wins over an existing ⏳ — so adding /tomorrow to a
      // task that already has a date just re-dates it, instead of leaving a
      // dead command in the line (that's how junk like "⏳ 2026-07-27 /today" used to appear).
      return raw
        .replace(/⏳\s?\d{4}-\d{2}-\d{2}\s*/g, '')
        .replace(DATE_CMD_RE, `⏳ ${iso}`)
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+$/, '');
    }).join('\n'));
  }

  // Whether a task passes the currently selected chip.
  matchesFilter(t) { return this.filter === 'all' || (t.tags || tagsOf(t.text)).includes(this.filter); }

  // Chip bar built from tags that ACTUALLY appear in open tasks — so a new
  // tag (#home, #project, anything) shows up on its own, without editing code.
  // Order: most frequent first.
  renderTagBar(parent, buckets) {
    const counts = new Map();
    for (const key of ['top', 'overdue', 'today', 'tomorrow', 'later', 'noDate']) {
      for (const t of buckets[key] || []) {
        for (const tag of t.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    // TOP_TAGS already has its own pinned ⭐ Top panel — showing it a SECOND
    // time as a regular filter chip created two "top" categories on screen,
    // and a clickable filter that emptied every other bucket.
    const tags = [...counts.entries()]
      .filter(([tag]) => !TOP_TAGS.includes(tag))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(e => e[0]);
    // the selected tag disappeared from INBOX (last task checked off) — fall
    // back to "All", otherwise the user was stuck on an empty list for no visible reason
    if (this.filter !== 'all' && !tags.includes(this.filter)) this.filter = 'all';

    const bar = parent.createDiv({ cls: 'cc-filterbar' });
    const chip = (id, label) => {
      const b = bar.createEl('button', { cls: 'cc-chipbtn' + (this.filter === id ? ' active' : ''), text: label });
      b.onclick = () => { this.filter = id; this.render(); };
    };
    chip('all', '◾ All');
    for (const tag of tags) chip(tag, `${tagIcon(tag)} #${tag} ${counts.get(tag)}`);
  }

  // Open tasks from INBOX split into buckets relative to the REAL today —
  // independent of whatever day the arrows above the schedule are showing.
  // no date: no ⏳. overdue: ⏳ < today. today / tomorrow: ⏳ == that day.
  // later: ⏳ further in the future (visible only in the Tasks tab).
  // top: #top — a bucket ABOVE the dates, in file order. Deliberately pulled
  // out of the date buckets: it has its own block (Overview banner, ⭐ panel
  // in Tasks), and showing the same task twice on one screen is exactly the
  // noise this bucket exists to remove.
  async openTaskBuckets() {
    const f = this.app.vault.getAbstractFileByPath(INBOX_PATH);
    const empty = { f: null, noDate: [], today: [], tomorrow: [], later: [], overdue: [], top: [] };
    if (!f) return empty;
    const data = await this.app.vault.cachedRead(f);
    const today = this.today();
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    const noDate = [], todayList = [], tomorrowList = [], later = [], overdue = [], top = [];
    for (const raw of data.split(/\r?\n/)) {
      const m = raw.match(/^\s*-\s*\[ \]\s+(.*)$/);
      if (!m) continue;
      const dm = raw.match(/⏳\s?(\d{4}-\d{2}-\d{2})/);
      const item = { raw, open: true, text: m[1], date: dm ? dm[1] : null, tags: tagsOf(m[1]) };
      if (isTopTask(item)) top.push(item);
      else if (!dm) noDate.push(item);
      else if (dm[1] < today) overdue.push(item);
      else if (dm[1] === today) todayList.push(item);
      else if (dm[1] === tomorrow) tomorrowList.push(item);
      else later.push(item);
    }
    later.sort((a, b) => a.date.localeCompare(b.date));
    overdue.sort((a, b) => a.date.localeCompare(b.date));
    return { f, noDate, today: todayList, tomorrow: tomorrowList, later, overdue, top };
  }

  // Window in which we ignore our own writes in the file watcher (see onOpen).
  // A generous 1.5s, because `modify` can arrive late after the disk write.
  markSelfWrite() { this._selfWriteUntil = Date.now() + 1500; }

  // Task order = priority, held directly as line order in INBOX.md. No extra
  // file syntax: what you see at the top of the list is at the top of the
  // file. User's call: order beats section — a task lands exactly where you
  // drop it, even if that also changes its section. /evening triages anyway.
  //
  // A drop does TWO things at once and both must go in ONE write: it moves
  // the line and (if the bucket changes) adds/removes #top. Two separate
  // writes would lose the task — after the tag is added the line looks
  // different and can no longer be found by its old text.
  // wantTop: true = add the tag, false = remove it, null = leave the tag alone.
  // when: 'today' | 'tomorrow' | 'none' (strip ⏳) | 'keep' / null = leave the date alone.
  async dropTask(file, fromRaw, targetRaw, placeBefore, wantTop, when) {
    if (!file || !fromRaw) return;
    const sameLine = fromRaw === targetRaw;
    const setsDate = when && when !== 'keep';
    if (sameLine && wantTop === null && !setsDate) return;
    this.markSelfWrite();
    await this.app.vault.process(file, (data) => {
      const lines = data.split(/\r?\n/);
      const fromIdx = lines.indexOf(fromRaw);
      if (fromIdx === -1) return data;
      let line = fromRaw;
      if (wantTop === true) line = withTopTag(line);
      else if (wantTop === false) line = withoutTopTag(line);
      if (setsDate) {
        const iso = when === 'none' ? null
          : when === 'today' ? this.today()
            : moment().add(1, 'day').format('YYYY-MM-DD');
        line = withDate(line, iso);
      }
      // dropped in the same bucket, on empty space — nothing changes, no need to write
      const willMove = targetRaw && !sameLine;
      if (line === fromRaw && !willMove) return data;
      lines.splice(fromIdx, 1);
      // no target (dropped on empty panel space) or the target vanished meanwhile
      // → the task stays at its position, only the tag changes
      const toIdx = willMove ? lines.indexOf(targetRaw) : -1;
      lines.splice(toIdx === -1 ? fromIdx : (placeBefore ? toIdx : toIdx + 1), 0, line);
      return lines.join('\n');
    });
  }

  // The whole panel as a drop target — this lets you drop a task into the ⭐
  // bucket (or pull it out) even when the panel is empty or you're aiming
  // next to a row. `top` is stored in the DOM because rows read it via
  // closest() — one handler in bindDrag then covers every panel without
  // passing state around. `when` (the date this panel assigns) goes into the
  // DOM next to `top` for the same reason.
  bindZone(el, file, top, when) {
    el.dataset.ccTop = top ? '1' : '0';
    el.dataset.ccWhen = when || 'keep';
    const clear = () => el.removeClass('cc-zone-over');
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.addClass('cc-zone-over');
    });
    // entering a row inside the panel also fires dragleave on the panel —
    // without this the highlight would flicker on every pass over a task
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) clear(); });
    el.addEventListener('dragend', clear);
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      clear();
      await this.dropTask(file, e.dataTransfer.getData('text/plain'), null, false, top, when);
      await this.render();
    });
  }

  // wires up dragging onto a row; nothing returned, all the logic lives in the handlers
  bindDrag(row, file, t) {
    const clearMarks = () => { row.removeClass('cc-drop-before'); row.removeClass('cc-drop-after'); };
    const isBefore = (e) => {
      const r = row.getBoundingClientRect();
      return (e.clientY - r.top) < r.height / 2;
    };
    row.draggable = true;
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', t.raw);
      e.dataTransfer.effectAllowed = 'move';
      row.addClass('cc-dragging');
    });
    row.addEventListener('dragend', () => { row.removeClass('cc-dragging'); clearMarks(); });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const before = isBefore(e);
      row.toggleClass('cc-drop-before', before);
      row.toggleClass('cc-drop-after', !before);
    });
    row.addEventListener('dragleave', clearMarks);
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fromRaw = e.dataTransfer.getData('text/plain');
      const before = isBefore(e);
      clearMarks();
      // the panel the row landed in decides the ⭐ tag; outside the Tasks tab
      // there's no zone (null) and dragging only changes order, as before
      const zone = row.closest('[data-cc-top]');
      await this.dropTask(file, fromRaw, t.raw, before,
        zone ? zone.dataset.ccTop === '1' : null,
        zone ? zone.dataset.ccWhen : null);
      await this.render();
    });
  }

  async toggleLineInFile(file, rawLine) {
    this.markSelfWrite();
    await this.app.vault.process(file, (data) => {
      const flip = /- \[ \]/.test(rawLine) ? rawLine.replace('- [ ]', '- [x]') : rawLine.replace(/- \[[xX]\]/, '- [ ]');
      return data.replace(rawLine, flip);
    });
  }

  openTerminal() {
    const ok = this.app.commands.executeCommandById('terminal:open-terminal.integrated.root');
    if (!ok) new Notice('Open a terminal: ⌘P → "Terminal: Open ... Integrated".');
  }

  // onRemoved: called AFTER a checked-off row disappears from the DOM — the
  // bucket then fixes up its header count and empty state (see taskBucket).
  taskRow(list, file, t, onRemoved) {
    const top = isTopTask(t);
    const row = list.createDiv({ cls: 'cc-todo-row' + (t.open ? '' : ' done') + (top ? ' top' : '') });
    const cb = row.createDiv({ cls: 'cc-todo-cb', text: t.open ? '☐' : '✅' });
    const label = this.cleanTask(t.text);
    // full text in the tooltip — the list clamps to 3 lines (CSS)
    row.createDiv({ cls: 'cc-todo-t', text: label }).setAttr('title', label);
    if (top) row.createDiv({ cls: 'cc-todo-star', text: '⭐' })
      .setAttr('title', 'Waiting on /evening — will get a Calendar/ entry and show up in TOP');
    else if (isInCalendar(t)) row.createDiv({ cls: 'cc-todo-star cal', text: '📅' })
      .setAttr('title', 'Already has a Calendar/ entry (important: true) — visible in TOP / COMING UP');
    this.bindDrag(row, file, t);
    // The UI reacts IMMEDIATELY, the file write happens in the background —
    // waiting on the disk round-trip (and then the watcher's 600ms debounce)
    // felt like lag on every checkbox click. A checked-off task fades out and
    // is removed instead of waiting for a full render that would remove it
    // from the bucket a few hundred ms later anyway.
    cb.onclick = () => {
      const wasOpen = t.open;
      t.open = !wasOpen;
      row.toggleClass('done', !t.open);
      cb.setText(t.open ? '☐' : '✅');
      this.toggleLineInFile(file, t.raw).catch(() => {
        new Notice('Error saving — reverted');
        t.open = wasOpen;
        row.toggleClass('done', !t.open);
        cb.setText(t.open ? '☐' : '✅');
      });
      if (wasOpen) {
        row.addClass('cc-row-fade');
        setTimeout(() => { row.remove(); if (onRemoved) onRemoved(); }, 220);
      }
    };
  }

  // Task bucket: header with a count + list + empty state (optionally "+N more →").
  // A checked-off row disappears from the DOM immediately, WITHOUT a full
  // render (see taskRow), so the header has to keep itself in sync — otherwise
  // checking off the last item left "🔴 OVERDUE (1)" hanging over empty space
  // until the next refresh.
  // opts: hideWhenEmpty (a conditional bucket — empty means it disappears
  // entirely), dated (date badge next to the row), limit (how many rows to
  // show; the rest go under "+N more →").
  taskBucket(box, title, cls, list, file, emptyText, opts = {}) {
    const head = box.createEl('h4', { cls: 'cc-bucket-h' + (cls ? ' ' + cls : '') });
    const listEl = box.createDiv({ cls: 'cc-todo' });
    const emptyEl = box.createDiv({ cls: 'cc-empty', text: emptyText || '' });
    const more = box.createDiv({ cls: 'cc-more' });
    more.onclick = () => this.goToTab('tasks');
    let left = list.length;
    const sync = () => {
      head.setText(`${title} (${left})`);
      if (!left && opts.hideWhenEmpty) { box.remove(); return; }
      const shown = listEl.childElementCount;
      const rest = left - shown;
      listEl.style.display = shown ? '' : 'none';
      emptyEl.style.display = shown ? 'none' : '';
      more.style.display = rest > 0 ? '' : 'none';
      more.setText(`+ ${rest} more →`);
    };
    for (const t of (opts.limit ? list.slice(0, opts.limit) : list)) {
      this.taskRow(listEl, file, t, () => { left--; sync(); });
      if (opts.dated && t.date) {
        listEl.lastElementChild.createDiv({
          cls: 'cc-todo-when' + (t.date < this.today() ? ' overdue' : ''),
          text: this.whenLabel(t.date),
        });
      }
    }
    sync();
    return box;
  }

  async renderTodayTasks(body, dateM) {
    const head = body.createDiv({ cls: 'cc-drivers-head' });
    head.createEl('h3', { cls: 'cc-h', text: '🎯 Tasks (outside blocks)' });
    const nav = head.createDiv({ cls: 'cc-tasknav' });
    // day buckets are always relative to the real today, not the day being
    // browsed with the arrows — so ◀ Today ▶ only makes sense in week view.
    if (this.taskRange === 'week') {
      nav.createEl('button', { cls: 'cc-b', text: '◀' }).onclick = () => { this.selectedDate = this.selectedDate.clone().subtract(7, 'day'); this.render(); };
      nav.createEl('button', { cls: 'cc-b', text: 'Today' }).onclick = () => { this.selectedDate = moment().startOf('day'); this.render(); };
      nav.createEl('button', { cls: 'cc-b', text: '▶' }).onclick = () => { this.selectedDate = this.selectedDate.clone().add(7, 'day'); this.render(); };
    }
    const toggle = nav.createEl('button', { cls: 'cc-b', text: this.taskRange === 'week' ? '📆 Week' : '📅 Day' });
    toggle.onclick = () => { this.taskRange = this.taskRange === 'week' ? 'day' : 'week'; this.render(); };

    // resolve /today /tomorrow /DD-MM-YYYY BEFORE branching day/week — otherwise
    // week view would never see dates entered through these commands.
    await this.resolveDateCommands();

    if (this.taskRange === 'week') { await this.renderWeekTasks(body, dateM); return; }

    // day view — 3 buckets: no date / today / overdue (always the real today)
    const add = body.createDiv({ cls: 'cc-add' });
    // NO auto /today — by default a task lands in "no date". Only a command
    // typed by the user (/today, /tomorrow, /DD-MM-YYYY) assigns a date.
    const inp = add.createEl('input', { cls: 'cc-input', attr: { type: 'text', placeholder: NEW_TASK_HINT } });
    const go = async () => { const v = inp.value.trim(); if (v) await this.addToInbox(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    add.createEl('button', { cls: 'cc-b primary', text: '＋' }).onclick = go;

    const buckets = await this.openTaskBuckets();
    this.renderTagBar(body, buckets);
    const applyFilter = (list) => list.filter(t => this.matchesFilter(t));
    const overdue = applyFilter(buckets.overdue);
    const todayList = applyFilter(buckets.today);
    const noDate = applyFilter(buckets.noDate);

    // Overview is a SUMMARY, not the full list — hence the hard limit. The
    // rest is one click away, in the Tasks tab.
    const PREVIEW = 3;
    const bucket = (title, cls, list, emptyText, hideWhenEmpty) =>
      this.taskBucket(body.createDiv({ cls: 'cc-bucket' }), title, cls, list, buckets.f, emptyText,
        { limit: PREVIEW, hideWhenEmpty });
    // Overdue is a conditional bucket: empty should disappear along with its
    // header, including when you empty it right here by checking things off.
    bucket('🔴 Overdue', 'overdue', overdue, '', true);
    bucket('☀️ Today', '', todayList, 'No tasks for today.', false);
    bucket('📌 No date', '', noDate, 'Nothing.', false);

    const allBtn = body.createEl('button', { cls: 'cc-b cc-allbtn', text: '📋 All tasks' });
    allBtn.onclick = () => this.goToTab('tasks');
  }

  goToTab(id) { this.tab = id; this.render(); }

  // ---------- TAB: TASKS ----------
  // Full view. Today and Tomorrow side by side (stacked on a narrow screen),
  // no-date below, overdue at the very top since that's what needs a reaction.
  async renderTasks(body) {
    await this.resolveDateCommands();

    // Same banner as Overview — the user wants to see TOP/COMING UP here too,
    // without switching tabs.
    const isToday = this.selectedDate.isSame(moment(), 'day');
    await this.renderImportantBanner(body, this.blocksForDay(this.selectedDate), isToday, this.selectedDate, false);

    const buckets = await this.openTaskBuckets();
    const applyFilter = (list) => list.filter(t => this.matchesFilter(t));

    const add = body.createDiv({ cls: 'cc-add' });
    const inp = add.createEl('input', { cls: 'cc-input', attr: { type: 'text', placeholder: NEW_TASK_HINT } });
    const go = async () => { const v = inp.value.trim(); if (v) await this.addToInbox(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    add.createEl('button', { cls: 'cc-b primary', text: '＋' }).onclick = go;

    this.renderTagBar(body, buckets);

    // panel = bucket + drop zone. `top` decides what dropping here does to the
    // #top tag: add it (⭐) or remove it (every other panel). `when` decides
    // what happens to ⏳ — panels with a specific date re-date the task,
    // the rest ('keep') leave the date alone.
    const panel = (parent, boxCls, title, hcls, list, emptyText, opts = {}) => {
      const box = parent.createDiv({ cls: 'cc-panel' + (boxCls ? ' ' + boxCls : '') });
      this.taskBucket(box, title, hcls, list, buckets.f, emptyText, opts);
      this.bindZone(box, buckets.f, opts.top === true, opts.when);
      return box;
    };

    // Overdue and Later are conditional buckets — empty disappears entirely,
    // including when you empty it right here by checking things off (no wait for refresh).
    panel(body, 'overdue', '🔴 Overdue', 'overdue', applyFilter(buckets.overdue), '',
      { dated: true, hideWhenEmpty: true });

    // ⭐ TOP — a bucket above the dates. Same set the Overview banner shows,
    // so dropping here is visible on the home tab right away — no waiting on
    // /evening (that's only what creates the Calendar/ entry).
    panel(body, 'top', '⭐ Top', 'top', applyFilter(buckets.top),
      'Empty. Drag a task here — it shows up in the TOP banner on Overview.',
      { dated: true, top: true });

    const grid = body.createDiv({ cls: 'cc-taskgrid' });
    panel(grid, 'today', '☀️ Today', '', applyFilter(buckets.today), 'Nothing for today.', { when: 'today' });
    panel(grid, '', '🌤️ Tomorrow', '', applyFilter(buckets.tomorrow), 'Nothing for tomorrow.', { when: 'tomorrow' });

    panel(body, '', '📌 No date', '', applyFilter(buckets.noDate), 'Nothing.', { when: 'none' });
    // "Later" deliberately has NO `when`: there's no single sensible date to
    // assign. A specific future day is set via the /DD-MM-YYYY command in the task text.
    panel(body, '', '🗓️ Later', '', applyFilter(buckets.later), '',
      { dated: true, hideWhenEmpty: true });
  }

  async tasksInRange(startStr, endStr) {
    const f = this.app.vault.getAbstractFileByPath(INBOX_PATH);
    if (!f) return { f: null, byDate: {} };
    const data = await this.app.vault.cachedRead(f);
    const byDate = {};
    for (const raw of data.split(/\r?\n/)) {
      const m = raw.match(/^\s*-\s*\[( |x|X)\]\s+(.*)$/);
      if (!m) continue;
      const dm = raw.match(/⏳\s?(\d{4}-\d{2}-\d{2})/);
      if (!dm) continue;
      const d = dm[1];
      if (d < startStr || d > endStr) continue;
      (byDate[d] = byDate[d] || []).push({ raw, open: m[1] === ' ', text: m[2] });
    }
    return { f, byDate };
  }

  async renderWeekTasks(body, dateM) {
    const ws = dateM.clone().startOf('isoWeek');
    const we = ws.clone().add(6, 'days');
    const { f, byDate } = await this.tasksInRange(ws.format('YYYY-MM-DD'), we.format('YYYY-MM-DD'));
    body.createEl('div', { cls: 'cc-week-range', text: `${ws.format('D MMM')} – ${we.format('D MMM')} (use ◀ ▶ below to change week)` });
    let any = false;
    for (let i = 0; i < 7; i++) {
      const day = ws.clone().add(i, 'days');
      let tasks = byDate[day.format('YYYY-MM-DD')];
      if (tasks) tasks = tasks.filter(t => this.matchesFilter(t));
      if (!tasks || !tasks.length) continue;
      any = true;
      const isToday = day.isSame(moment(), 'day');
      // each day in its own box, so it disappears with its header once the
      // last task is checked off — an empty date under the day name is just noise
      const dayBox = body.createDiv();
      dayBox.createEl('div', { cls: 'cc-week-day' + (isToday ? ' today' : ''), text: day.format('dddd, D MMMM') });
      const list = dayBox.createDiv({ cls: 'cc-todo' });
      let left = tasks.length;
      for (const t of tasks) this.taskRow(list, f, t, () => { if (--left === 0) dayBox.remove(); });
    }
    if (!any) body.createDiv({ cls: 'cc-empty', text: 'No dated (⏳) tasks this week.' });
  }

  async renderHabits(body, dateM) {
    const key = dateM.format('YYYY-MM-DD');
    const f = this.app.vault.getAbstractFileByPath(`${JOURNAL_DIR}/${key}.md`);
    // No daily note = no habits. This section used to just vanish without a
    // trace and looked like a plugin bug — the user asked twice "where did
    // the habits go". Now a missing routine is visible instead of pretending
    // the front end is broken. Only for TODAY — browsing old days has nothing to nag about.
    if (!f) {
      if (!dateM.isSame(moment(), 'day')) return;
      const box = body.createDiv({ cls: 'cc-nohabits' });
      box.createDiv({ cls: 'cc-nohabits-t', text: '📓 No daily note — no habits to show' });
      box.createDiv({ cls: 'cc-nohabits-s', text: 'Run /morning in Claude Code: it creates the note, fills in the blocks, and names the day\'s anchor.' });
      box.createEl('button', { cls: 'cc-b', text: '⌨️ Open terminal' }).onclick = () => this.openTerminal();
      return;
    }
    const data = await this.app.vault.cachedRead(f);
    const habits = [];
    let inSec = false;
    for (const raw of data.split(/\r?\n/)) {
      if (/^#{1,6}\s/.test(raw)) inSec = /habits/i.test(raw);
      else if (inSec) {
        const m = raw.match(/^\s*-\s*\[( |x|X)\]\s+(.*)$/);
        if (m) habits.push({ raw, open: m[1] === ' ', text: m[2] });
      }
    }
    if (!habits.length) return;
    const doneN = habits.filter(h => !h.open).length;
    const head = body.createDiv({ cls: 'cc-drivers-head' });
    head.createEl('h3', { cls: 'cc-h', text: '✅ Daily drivers' });
    const pct = head.createSpan({ cls: 'cc-drivers-pct', text: `${Math.round(doneN / habits.length * 100)}%` });
    const list = body.createDiv({ cls: 'cc-todo' });
    for (const h of habits) {
      const row = list.createDiv({ cls: 'cc-todo-row' + (h.open ? '' : ' done') });
      const cb = row.createDiv({ cls: 'cc-todo-cb', text: h.open ? '☐' : '✅' });
      row.createDiv({ cls: 'cc-todo-t', text: h.text });
      cb.onclick = () => {
        const wasOpen = h.open;
        h.open = !wasOpen; row.toggleClass('done', !h.open); cb.setText(h.open ? '☐' : '✅');
        pct.setText(`${Math.round(list.querySelectorAll('.cc-todo-row.done').length / habits.length * 100)}%`);
        this.toggleLineInFile(f, h.raw).catch(() => {
          new Notice('Error saving — reverted');
          h.open = wasOpen; row.toggleClass('done', !h.open); cb.setText(h.open ? '☐' : '✅');
          pct.setText(`${Math.round(list.querySelectorAll('.cc-todo-row.done').length / habits.length * 100)}%`);
        });
      };
    }
  }

  // ---------- RENDER ----------
  // render() is called after EVERY file change (checking off a task, a
  // block's frontmatter changing...) — a full DOM rebuild by itself would
  // reset scrollTop.
  //
  // We build into a DETACHED container and swap it in at the very end, in
  // one move. It used to be root.empty() → await (reading files) → only then
  // build, so for those few-to-dozen ms the view was genuinely empty and
  // that had time to paint — that's what caused the "whole vault flashes"
  // effect on every checkbox click. Now there's no await between emptying
  // and filling, so there's no frame where the view is empty.
  //
  // Render token: if a newer render starts during our awaits, this older one
  // discards its result instead of overwriting the fresher screen.
  async render() {
    const root = this.contentEl;
    const token = (this._renderToken = (this._renderToken || 0) + 1);
    // We keep scroll position ONLY when refreshing the same tab (checking off
    // a task etc). When switching tabs — e.g. "+N more →" from Overview to
    // Tasks — restoring the old position threw you to the bottom of the new list.
    const tabChanged = this._lastTab !== this.tab;
    this._lastTab = this.tab;
    const scrollTop = tabChanged ? 0 : root.scrollTop;
    root.addClass('cc-view');
    // Outside Overview, content starts right at the top, OVER the banner
    // (the banner stays as a background). Overview keeps the old layout:
    // banner as hero, content rides in below it.
    root.toggleClass('cc-tab-plain', this.tab !== 'overview');
    const stage = createDiv({ cls: 'cc-view' });

    // Banner — an animated GIF at the top. No file = there just isn't one.
    // Separate art for dark and light mode. List order = priority, the first
    // match wins; swapping the banner means reordering the list, not touching
    // the rest of the code.
    // JS only supplies the URLs as CSS variables — the body.theme-light
    // selector in styles.css picks dark vs light. That makes switching modes
    // in the OS instant, with no event listening and no extra render().
    // Looked up by NAME, not a fixed path. A hardcoded path broke on every
    // rename or move, and a silent fallback substituted the other image —
    // which looked like the banner had randomly changed.
    // Rule: a file with "dark mode" in its name is used for dark mode, "light
    // mode" for light mode. Anywhere in the vault, any image extension.
    // Multiple matches = the newest wins, so swapping art is just dropping in
    // a new file.
    // Ships with NO banner images in the public repo — this just quietly
    // does nothing until the user adds files named like that. See findBanner below.
    const darkGif = this.findBanner('dark mode');
    const lightGif = this.findBanner('light mode');

    // NO falling back to one variant for the other. A missing file should
    // look like a missing file (bare background), not like art from the
    // other mode — that looked like a bug twice in a row.
    if (!darkGif || !lightGif) {
      console.debug('[life-os-hub] banner — dark:', darkGif || 'no "dark mode" file found',
        '| light:', lightGif || 'no "light mode" file found');
    }
    // Each variant is set independently — missing one can't break the other
    // or the banner as a whole. The element always exists now (not just when
    // an image is found) so there's a literal place to drop a picture onto —
    // see setupBannerDrop below.
    const banner = stage.createDiv({ cls: 'cc-banner' });
    const url = (p) => `url("${this.app.vault.adapter.getResourcePath(p)}")`;
    if (darkGif) banner.style.setProperty('--cc-banner-img-dark', url(darkGif));
    if (lightGif) banner.style.setProperty('--cc-banner-img-light', url(lightGif));
    this.bannerEl = banner;
    if (!darkGif && !lightGif) {
      banner.addClass('cc-banner-empty');
      banner.createDiv({ cls: 'cc-banner-hint', text: 'Drop a picture here for the banner' });
    }
    // Backdrop colour, sampled from the image itself instead of a hardcoded
    // hex — see the mask-fade comment on .cc-banner in styles.css for why it
    // has to roughly match the art's own dominant tone. Async (loading the
    // image + reading pixels can't happen inline in render()), and applied
    // only if this exact banner element is still the current one — a fast
    // re-render before it resolves must not paint a stale element.
    if (darkGif) this.applyBannerBackdrop(banner, darkGif, 'dark');
    if (lightGif) this.applyBannerBackdrop(banner, lightGif, 'light');

    // Header: clock + tabs
    const head = stage.createDiv({ cls: 'cc-head' });
    const clock = head.createDiv({ cls: 'cc-clock' });
    const paintClock = () => {
      const now = moment();
      clock.setText(`${now.format('HH:mm:ss')} · ${now.format('dddd, D MMMM')}`);
    };
    paintClock();
    if (this.clockHandle) clearInterval(this.clockHandle);
    this.clockHandle = setInterval(() => { if (clock.isConnected) paintClock(); else clearInterval(this.clockHandle); }, 1000);
    this.registerInterval(this.clockHandle);

    const tabs = head.createDiv({ cls: 'cc-tabs' });
    for (const [id, label] of [['overview', 'Overview'], ['tasks', 'Tasks'], ['metrics', 'Metrics'], ['inbox', 'Inbox'], ['book', 'Book'], ['wiki', 'Wiki'], ['status', 'Status'], ['colors', 'Colors']]) {
      const b = tabs.createEl('button', { cls: 'cc-tab' + (this.tab === id ? ' active' : ''), text: label });
      b.onclick = () => { this.tab = id; this.render(); };
    }
    const refresh = tabs.createEl('button', { cls: 'cc-tab cc-refresh', text: '↻' });
    refresh.onclick = () => this.render();

    const body = stage.createDiv({ cls: 'cc-body' });
    if (this.tab === 'overview') await this.renderOverview(body);
    else if (this.tab === 'tasks') await this.renderTasks(body);
    else if (this.tab === 'metrics') await this.renderMetrics(body);
    else if (this.tab === 'book') await this.renderBook(body);
    else if (this.tab === 'wiki') await this.renderWiki(body);
    else if (this.tab === 'status') await this.renderStatus(body);
    else if (this.tab === 'colors') await this.renderColors(body);
    else await this.renderInbox(body);

    // A newer render started during our awaits — hand it the screen.
    if (token !== this._renderToken) return;

    // Swap with no empty frame: emptying and filling happen in one
    // synchronous block, so the browser never paints an empty view.
    root.empty();
    while (stage.firstChild) root.appendChild(stage.firstChild);
    root.scrollTop = scrollTop;
    this.bindScroll(root);
  }

  // The banner fades as you scroll down (0.8 multiplier = it's gone before
  // content reaches its bottom edge). The header isn't touched here — it's
  // not sticky, it scrolls away normally with the content.
  // The listener is bound ONCE per view lifetime and reads this.bannerEl,
  // because render() runs on every tab switch and would otherwise stack up
  // handlers pointing at already-removed elements.
  bindScroll(scroller) {
    const paint = () => {
      this.scrollQueued = false;
      const b = this.bannerEl;
      if (b && b.isConnected) {
        const span = (b.offsetHeight || 1) * 0.8;
        b.style.opacity = String(1 - Math.min(Math.max(scroller.scrollTop / span, 0), 1));
      }
    };
    if (!this.scrollBound) {
      this.scrollBound = true;
      this.registerDomEvent(scroller, 'scroll', () => {
        if (!this.scrollQueued) { this.scrollQueued = true; requestAnimationFrame(paint); }
      });
    }
    paint();
  }

  // Path of the banner picture for a mode ('dark mode' / 'light mode'), or
  // undefined. A method rather than a closure inside render() because the
  // Colors tab needs to find the same file the banner is showing.
  findBanner(needle) {
    const hits = this.app.vault.getFiles()
      .filter(f => /^(gif|png|jpe?g|webp|avif)$/i.test(f.extension))
      .filter(f => !f.path.startsWith(BANNER_ARCHIVE_DIR + '/'))
      .filter(f => f.path.toLowerCase().includes(needle))
      .sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0));
    return hits[0]?.path;
  }

  // Reads the image once, at PALETTE_SAMPLE px on the long side, and derives
  // everything from that one decode: the average tone used as the banner
  // backdrop and the dominant-colour palette shown in the Colors tab. Cached
  // per path+mtime on the plugin instance (survives across render() calls,
  // which happen on every tab switch and vault-change debounce) so dragging
  // between tabs doesn't decode the same image over and over. A new file, or
  // the same path re-dropped, has a new mtime and misses the cache.
  async bannerAnalysis(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    const mtime = file?.stat?.mtime || 0;
    this._bannerColorCache = this._bannerColorCache || {};
    const cached = this._bannerColorCache[path];
    if (cached && cached.mtime === mtime) return cached;
    const result = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = PALETTE_SAMPLE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        let data;
        try { data = ctx.getImageData(0, 0, w, h).data; }
        catch (e) { resolve(null); return; }   // shouldn't happen for a local vault file, but never crash the banner over a colour
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
        if (!n) { resolve(null); return; }
        const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
        resolve({ color: '#' + hex(r) + hex(g) + hex(b), palette: extractPalette(data) });
      };
      img.onerror = () => resolve(null);
      img.src = this.app.vault.adapter.getResourcePath(path);
    });
    if (!result) return null;
    return (this._bannerColorCache[path] = { mtime, ...result });
  }
  async bannerBackdropColor(path) {
    return (await this.bannerAnalysis(path))?.color || null;
  }

  // Fire-and-forget from render(): applies the sampled colour once it's
  // ready, but only if `banner` is still `this.bannerEl` — render() may have
  // already replaced it (a fast vault-change debounce, a tab switch) by the
  // time the image decodes, and painting a detached element would do nothing
  // useful while silently wasting the work.
  async applyBannerBackdrop(banner, path, mode) {
    const color = await this.bannerBackdropColor(path);
    if (color && this.bannerEl === banner) {
      banner.style.setProperty(`--cc-banner-backdrop-${mode}`, color);
    }
  }

  // Whether a dragged-in OS file is currently over the banner's own screen
  // rect. Coordinate math, not a DOM event target check — the banner is
  // frequently pointer-events: none (see styles.css), so it would never be
  // ev.target/currentTarget for a native drag event in the first place.
  _draggingOverBanner(ev) {
    const b = this.bannerEl;
    if (!b || !b.isConnected) return false;
    if (!ev.dataTransfer || !Array.from(ev.dataTransfer.types || []).includes('Files')) return false;
    const r = b.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  // dragover fires continuously while the drag is in motion, so recomputing
  // "am I over the banner right now" here (rather than tracking enter/leave)
  // keeps the highlight in sync with the cursor for free.
  onBannerDragOver(ev) {
    const over = this._draggingOverBanner(ev);
    if (over) ev.preventDefault();   // required to allow the drop at all
    this.bannerEl && this.bannerEl.toggleClass('cc-banner-dragover', over);
  }

  // SHA-256 of a file's contents — used to spot duplicates when archiving
  // a banner, see onBannerDrop.
  async fileHash(data) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Dropping a picture here — whether the banner is empty or already has
  // one — saves it as this mode's art and re-renders. Anywhere else in the
  // window, this does nothing and Obsidian's own drop handling (e.g.
  // embedding an image into a note) proceeds untouched.
  async onBannerDrop(ev) {
    if (!this._draggingOverBanner(ev)) return;
    ev.preventDefault();
    this.bannerEl.removeClass('cc-banner-dragover');
    const file = ev.dataTransfer.files[0];
    if (!file || !/^image\//.test(file.type)) {
      new Notice('That’s not an image — drop a picture for the banner.');
      return;
    }
    const isLight = document.body.classList.contains('theme-light');
    const needle = isLight ? 'light mode' : 'dark mode';
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    if (!this.app.vault.getAbstractFileByPath(BANNER_DIR)) {
      await this.app.vault.createFolder(BANNER_DIR);
    }
    if (!this.app.vault.getAbstractFileByPath(BANNER_ARCHIVE_DIR)) {
      await this.app.vault.createFolder(BANNER_ARCHIVE_DIR);
    }
    // Replace our own previous drop for this mode (whatever extension it
    // had) so there's only ever one "newest" candidate on the banner — but
    // instead of deleting it, move it into the archive with the next number,
    // so nothing is lost for good. If the same content (by SHA-256) is
    // already archived — e.g. the same picture got dropped twice in a row —
    // don't make a second copy, just delete the now-redundant file.
    for (const f of this.app.vault.getFiles()) {
      if (f.path.startsWith(BANNER_DIR + '/')
        && !f.path.startsWith(BANNER_ARCHIVE_DIR + '/')
        && f.basename.toLowerCase() === needle) {
        const oldHash = await this.fileHash(await this.app.vault.readBinary(f));
        let duplicate = false;
        if (this.app.vault.getAbstractFileByPath(BANNER_ARCHIVE_DIR)) {
          for (const af of this.app.vault.getFiles()) {
            if (!af.path.startsWith(BANNER_ARCHIVE_DIR + '/')) continue;
            if (af.basename.toLowerCase() !== needle && !af.basename.toLowerCase().startsWith(needle + ' ')) continue;
            if (await this.fileHash(await this.app.vault.readBinary(af)) === oldHash) { duplicate = true; break; }
          }
        }
        if (duplicate) {
          await this.app.vault.delete(f);
          continue;
        }
        if (!this.app.vault.getAbstractFileByPath(BANNER_ARCHIVE_DIR)) {
          await this.app.vault.createFolder(BANNER_ARCHIVE_DIR);
        }
        let n = 1;
        while (this.app.vault.getAbstractFileByPath(`${BANNER_ARCHIVE_DIR}/${needle} ${n}.${f.extension}`)) n++;
        await this.app.vault.rename(f, `${BANNER_ARCHIVE_DIR}/${needle} ${n}.${f.extension}`);
      }
    }
    const data = await file.arrayBuffer();
    await this.app.vault.createBinary(`${BANNER_DIR}/${needle}.${ext}`, data);
    new Notice(`📷 ${needle} banner set`);
    this.render();
  }

  async renderOverview(body) {
    const blocks = this.blocksForDay(this.selectedDate);
    const isToday = this.selectedDate.isSame(moment(), 'day');
    const now = new Date();

    // banner: events with important: true + tasks tagged #top — independent of the project filter.
    // resolveDateCommands BEFORE the banner, so freshly typed /today /tomorrow
    // already have a real date on the badge (renderTodayTasks calls it too, but further down).
    await this.resolveDateCommands();
    await this.renderImportantBanner(body, blocks, isToday, this.selectedDate);

    // The tag filter does NOT touch the schedule — blocks in Calendar/ have no
    // hashtags (neither in the title nor frontmatter), so filtering them by
    // tag would hide the whole day. Chips live next to tasks and filter tasks only.

    // Cockpit: current focus + timer + ring
    const cockpit = body.createDiv({ cls: 'cc-cockpit' });

    // current focus ("now/next" logic only makes sense for today)
    let cur = null, nxt = null;
    if (isToday) {
      for (const b of blocks) {
        if (!b.fm.startTime) continue;
        const s = moment(`${ymd(b.fm.date)} ${b.fm.startTime}`, 'YYYY-MM-DD HH:mm').toDate();
        const e = moment(`${ymd(b.fm.date)} ${b.fm.endTime || b.fm.startTime}`, 'YYYY-MM-DD HH:mm').toDate();
        if (now >= s && now < e) cur = b;
        if (!nxt && s > now) nxt = b;
      }
    }
    const focus = cur || nxt || (!isToday ? blocks.find(b => b.fm.startTime) : null);
    const fc = cockpit.createDiv({ cls: 'cc-focus' });
    if (focus) {
      const label = cur ? '▶ NOW' : (isToday ? '⏭ NEXT' : '📋 FIRST BLOCK');
      fc.createDiv({ cls: 'cc-focus-label', text: label });
      fc.createEl('div', { cls: 'cc-focus-title', text: focus.fm.title || focus.f.basename });
      fc.createDiv({ cls: 'cc-focus-time', text: `${focus.fm.startTime || ''}–${focus.fm.endTime || ''}` });
    } else {
      fc.createDiv({ cls: 'cc-focus-label', text: isToday ? '🟢 No blocks today' : '🟢 No blocks that day' });
    }

    // focus timer
    this.renderTimer(cockpit);

    // progress ring
    this.currentBlocks = blocks;
    this.ringEl = cockpit.createDiv({ cls: 'cc-ring' });
    this.updateRing();

    // schedule + day navigation — above tasks: the day's plan outranks loose
    // tasks, and the TOP banner stays at the very top.
    const shHead = body.createDiv({ cls: 'cc-sched-head' });
    const nav = shHead.createDiv({ cls: 'cc-daynav' });
    nav.createEl('button', { cls: 'cc-b', text: '◀' }).onclick = () => {
      this.selectedDate = this.selectedDate.clone().subtract(1, 'day');
      this.render();
    };
    if (!isToday) {
      const todayBtn = nav.createEl('button', { cls: 'cc-b', text: 'Today' });
      todayBtn.onclick = () => { this.selectedDate = moment().startOf('day'); this.render(); };
    }
    nav.createEl('button', { cls: 'cc-b', text: '▶' }).onclick = () => {
      this.selectedDate = this.selectedDate.clone().add(1, 'day');
      this.render();
    };
    const dayLabel = isToday ? 'Today' : this.selectedDate.format('dddd, D MMMM');
    shHead.createEl('h3', { cls: 'cc-h', text: `🗓️ ${dayLabel} — schedule` });
    const calBtn = shHead.createEl('button', { cls: 'cc-b', text: '📅 Open calendar' });
    calBtn.onclick = () => this.openFullCalendar();
    const termBtn = shHead.createEl('button', { cls: 'cc-b', text: '⌨️ Terminal' });
    termBtn.onclick = () => this.openTerminal();
    const hoursBtn = shHead.createEl('button', { cls: 'cc-b', text: this.fixedHours ? '🕐 6–24' : '↔ Auto' });
    hoursBtn.onclick = () => { this.fixedHours = !this.fixedHours; this.render(); };
    if (!blocks.length) body.createDiv({ cls: 'cc-empty', text: isToday ? 'No blocks today.' : 'No blocks that day.' });
    else this.renderDayGrid(body, blocks, isToday);

    // 🎯 loose tasks (outside blocks) + ✅ daily drivers for the selected day
    await this.renderTodayTasks(body, this.selectedDate);
    await this.renderHabits(body, this.selectedDate);
  }

  // all blocks with important: true within a date range (inclusive)
  importantInRange(startStr, endStr) {
    return this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(CAL_DIR + '/'))
      .map(f => ({ f, fm: this.fm(f) }))
      .filter(x => x.fm.type === 'single' && x.fm.important === true)
      .filter(x => { const d = ymd(x.fm.date); return d && d >= startStr && d <= endStr; })
      .sort((a, b) => String(ymd(a.fm.date)).localeCompare(String(ymd(b.fm.date)))
        || String(a.fm.startTime || '').localeCompare(String(b.fm.startTime || '')));
  }

  importantRow(list, b, dayLabel) {
    const title = String(b.fm.title || b.f.basename);
    // an event with an unconfirmed date (confirmed: false or "ESTIMATE" in the title) → blue, not red
    const unconfirmed = b.fm.confirmed === false || /ESTIMATE/i.test(title);
    const row = list.createDiv({ cls: 'cc-important-row' + (b.fm.completed ? ' done' : '') + (unconfirmed ? ' unconfirmed' : '') });
    if (dayLabel) row.createDiv({ cls: 'cc-important-when', text: dayLabel });
    const label = unconfirmed
      ? title.replace(/\s*[—–-]\s*ESTIMATE\s*$/i, '') + ' — to confirm'
      : title;
    row.createDiv({ cls: 'cc-important-title', text: label });
    if (b.fm.startTime) row.createDiv({ cls: 'cc-important-time', text: `${b.fm.startTime}–${b.fm.endTime || ''}` });
    row.onclick = () => this.app.workspace.openLinkText(b.f.path, '', false);
  }

  // A #top task in the banner — importantRow's twin, but the source is a
  // line from INBOX.md, not a file from Calendar/. Clicking leads to the
  // Tasks tab, because that's where it's edited (and dragged back out).
  importantTaskRow(list, t) {
    const overdue = t.date && t.date < this.today();
    const row = list.createDiv({ cls: 'cc-important-row task' + (overdue ? ' overdue' : '') });
    row.createDiv({ cls: 'cc-important-when', text: this.whenLabel(t.date) });
    const label = this.cleanTask(t.text);
    row.createDiv({ cls: 'cc-important-title', text: label }).setAttr('title', label);
    row.onclick = () => this.goToTab('tasks');
  }

  // includeTasks: false in the Tasks tab — there ⭐ already has its own,
  // fuller panel (drag & drop, no 7-day window), so repeating the task list
  // in the banner would be a third place showing the same task on one screen.
  async renderImportantBanner(body, blocks, isToday, dateM, includeTasks = true) {
    const imp = blocks.filter(b => b.fm.important === true);
    // lookahead: 7 days from the next day — the window moves on its own since it's based on selectedDate
    const LOOKAHEAD_DAYS = 7;
    const from = dateM.clone().add(1, 'day');
    const soon = this.importantInRange(from.format('YYYY-MM-DD'), from.clone().add(LOOKAHEAD_DAYS - 1, 'days').format('YYYY-MM-DD'));
    // Tasks marked ⭐ in the Tasks tab. Ones with a date stick to the SAME
    // window as COMING UP: a dentist appointment in September shouldn't hang
    // in the banner for six weeks — it waits in the ⭐ panel and jumps in here
    // on its own once the date enters the window. No-date / overdue / today /
    // tomorrow are always visible: either they have nothing to wait for, or they've already slipped.
    const horizon = dateM.clone().add(LOOKAHEAD_DAYS, 'days').format('YYYY-MM-DD');
    const topTasks = includeTasks ? (await this.openTaskBuckets()).top.filter(t => !t.date || t.date <= horizon) : [];
    if (!imp.length && !soon.length && !topTasks.length) return;

    const box = body.createDiv({ cls: 'cc-important' });
    if (imp.length) {
      box.createDiv({ cls: 'cc-important-label', text: isToday ? '🔴 TOP PRIORITY TODAY' : '🔴 TOP PRIORITY THAT DAY' });
      const list = box.createDiv({ cls: 'cc-important-list' });
      for (const b of imp) this.importantRow(list, b, null);
    }
    if (topTasks.length) {
      box.createDiv({ cls: 'cc-important-label tasks', text: '⭐ TOP TASKS' });
      const list = box.createDiv({ cls: 'cc-important-list' });
      for (const t of topTasks) this.importantTaskRow(list, t);
    }
    if (soon.length) {
      box.createDiv({ cls: 'cc-important-label soon', text: `⏳ COMING UP (${LOOKAHEAD_DAYS} days)` });
      const list = box.createDiv({ cls: 'cc-important-list' });
      // cap — in dense weeks a long list turns into noise
      const CAP = 7;
      for (const b of soon.slice(0, CAP)) {
        const d = moment(ymd(b.fm.date), 'YYYY-MM-DD');
        const days = d.diff(dateM, 'days');
        this.importantRow(list, b, `${d.format('DD.MM')} · in ${days}d`);
      }
      if (soon.length > CAP) {
        const more = box.createDiv({ cls: 'cc-important-more', text: `+ ${soon.length - CAP} more in this window — open the calendar` });
        more.onclick = () => this.openFullCalendar();
      }
    }
  }

  renderDayGrid(body, blocks, showNowLine) {
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
    const timed = blocks.filter(b => b.fm.startTime);
    const allDay = blocks.filter(b => !b.fm.startTime);

    // all-day chips (e.g. a trip)
    if (allDay.length) {
      const chips = body.createDiv({ cls: 'cc-allday' });
      for (const b of allDay) {
        const c = chips.createDiv({ cls: 'cc-chip' + (b.fm.completed ? ' done' : '') + (b.fm.important === true ? ' important' : '') });
        c.setText(`${iconFor(b.fm.title)} ${b.fm.title || b.f.basename}`);
        c.onclick = () => this.app.workspace.openLinkText(b.f.path, '', false);
      }
    }
    if (!timed.length) return;

    const PX = 56; // px per hour
    let startMin, endMin;
    if (this.fixedHours) {
      startMin = 6 * 60; endMin = 24 * 60;
    } else {
      startMin = Math.min(...timed.map(b => toMin(b.fm.startTime)));
      endMin = Math.max(...timed.map(b => toMin(b.fm.endTime || b.fm.startTime)));
      startMin = Math.floor(startMin / 60) * 60;
      endMin = Math.ceil(endMin / 60) * 60;
      if (endMin - startMin < 120) endMin = startMin + 120;
    }

    const grid = body.createDiv({ cls: 'cc-day' });
    grid.style.height = ((endMin - startMin) / 60 * PX + 6) + 'px';

    // hour lines + labels
    for (let m = startMin; m <= endMin; m += 60) {
      const y = (m - startMin) / 60 * PX;
      grid.createDiv({ cls: 'cc-hline' }).style.top = y + 'px';
      const lab = grid.createDiv({ cls: 'cc-hlabel', text: String(Math.floor(m / 60)).padStart(2, '0') + ':00' });
      lab.style.top = y + 'px';
    }

    // pack overlapping events into columns (side-by-side, like Google Calendar)
    const evs = timed.map(b => ({ b, s: toMin(b.fm.startTime), e: toMin(b.fm.endTime || b.fm.startTime) }))
      .sort((a, z) => a.s - z.s || a.e - z.e);
    let cluster = [], maxEnd = -1;
    const clusters = [];
    for (const ev of evs) {
      if (cluster.length && ev.s >= maxEnd) { clusters.push(cluster); cluster = []; maxEnd = -1; }
      cluster.push(ev); maxEnd = Math.max(maxEnd, ev.e);
    }
    if (cluster.length) clusters.push(cluster);
    for (const cl of clusters) {
      const colEnds = [];
      for (const ev of cl) {
        let i = colEnds.findIndex(end => ev.s >= end);
        if (i === -1) { i = colEnds.length; colEnds.push(ev.e); } else { colEnds[i] = ev.e; }
        ev.col = i;
      }
      for (const ev of cl) ev.n = colEnds.length;
    }

    const evEls = [];
    for (const { b, s, e, col, n } of evs) {
      const h = Math.max(16, (e - s) / 60 * PX - 2);
      const el = grid.createDiv({ cls: 'cc-ev' + (b.fm.completed ? ' done' : '') + (b.fm.important === true ? ' important' : '') });
      el.style.top = ((s - startMin) / 60 * PX) + 'px';
      el.style.height = h + 'px';
      el.style.left = `calc(${(col / n) * 100}% + 2px)`;
      el.style.width = `calc(${(1 / n) * 100}% - 4px)`;
      const t = el.createDiv({ cls: 'cc-ev-t' });
      t.createSpan({ cls: 'cc-ev-ic', text: iconFor(b.fm.title) });
      t.appendText(' ' + (b.fm.title || b.f.basename));
      if (h >= 34) el.createDiv({ cls: 'cc-ev-time', text: `${b.fm.startTime}–${b.fm.endTime || ''}` });
      const act = el.createDiv({ cls: 'cc-ev-actions' });
      const done = act.createDiv({ cls: 'cc-ev-btn', text: b.fm.completed ? '✅' : '☐' });
      done.onclick = (ev) => { ev.stopPropagation(); this.toggleDone(b, el, done); };
      const open = act.createDiv({ cls: 'cc-ev-btn', text: '📝' });
      open.onclick = (ev) => { ev.stopPropagation(); this.app.workspace.openLinkText(b.f.path, '', false); };
      evEls.push({ el, s, e });
    }

    // moving "now" line — only for today; the block under the line gets a
    // stronger highlight and switches to the next block on its own once the
    // line passes it (recomputed every tick).
    if (this.nowHandle) { clearInterval(this.nowHandle); this.nowHandle = null; }
    if (showNowLine) {
      const nl = grid.createDiv({ cls: 'cc-now' });
      const paintNow = () => {
        const d = new Date();
        const nm = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
        for (const { el, s, e } of evEls) el.toggleClass('cc-ev-current', nm >= s && nm < e);
        if (nm < startMin || nm > endMin) { nl.style.display = 'none'; return; }
        nl.style.display = 'block';
        nl.style.top = ((nm - startMin) / 60 * PX) + 'px';
      };
      paintNow();
      this.nowHandle = setInterval(() => { if (nl.isConnected) paintNow(); else clearInterval(this.nowHandle); }, 15000);
      this.registerInterval(this.nowHandle);
    }
  }

  renderTimer(parent) {
    const tb = parent.createDiv({ cls: 'cc-timer' });
    const disp = tb.createDiv({ cls: 'cc-timer-disp' });
    const paint = () => {
      const m = String(Math.floor(this.timer.remaining / 60)).padStart(2, '0');
      const s = String(this.timer.remaining % 60).padStart(2, '0');
      disp.setText(`${m}:${s}`);
    };
    paint();
    const btns = tb.createDiv({ cls: 'cc-timer-btns' });
    const startBtn = btns.createEl('button', { cls: 'cc-b primary', text: this.timer.running ? '⏸' : '▶' });
    const stop = () => {
      this.timer.running = false;
      if (this.timer.handle) { clearInterval(this.timer.handle); this.timer.handle = null; }
      startBtn.setText('▶');
    };
    const start = () => {
      this.timer.running = true; startBtn.setText('⏸');
      if (this.timer.handle) clearInterval(this.timer.handle);
      this.timer.handle = setInterval(() => {
        if (!disp.isConnected) { clearInterval(this.timer.handle); this.timer.handle = null; return; }
        this.timer.remaining--; paint();
        if (this.timer.remaining <= 0) { stop(); new Notice('⏰ Focus block done!'); this.timer.remaining = 25 * 60; paint(); }
      }, 1000);
    };
    startBtn.onclick = () => { this.timer.running ? stop() : start(); };
    btns.createEl('button', { cls: 'cc-b', text: '+5' }).onclick = () => { this.timer.remaining += 300; paint(); };
    btns.createEl('button', { cls: 'cc-b', text: '↺' }).onclick = () => { stop(); this.timer.remaining = 25 * 60; paint(); };
    tb.createDiv({ cls: 'cc-timer-label', text: 'FOCUS' });
    if (this.timer.running) start(); // resume ticking after a re-render
  }

  // ---------- BOOK ----------
  // The book timer does NOT count ticks — it holds an end timestamp
  // (`endsAt`) and subtracts from the clock. Reason: the focus interval dies
  // with its div when you switch tabs — here the bell has to ring even if the
  // user is sitting in Tasks, because the whole point of this habit is that
  // it interrupts reading on schedule.
  bookMinutes() { return this.plugin.settings.minutes || BOOK_MINUTES; }
  bookRemaining() {
    const b = this.bookTimer;
    if (!b.running) return b.remaining;
    return Math.max(0, Math.round((b.endsAt - Date.now()) / 1000));
  }
  startBook() {
    const b = this.bookTimer;
    // Only on the FIRST start — otherwise pausing mid-read would push the
    // start of the range forward and the range would lie about how much got read.
    if (b.startPage == null) b.startPage = this.currentPage();
    b.endsAt = Date.now() + this.bookRemaining() * 1000;
    b.running = true;
    if (b.handle) clearInterval(b.handle);
    b.handle = setInterval(() => {
      if (this._bookPaint) this._bookPaint();
      if (this.bookRemaining() <= 0) this.finishBook();
    }, 250);
    this.registerInterval(b.handle);
  }
  pauseBook() {
    const b = this.bookTimer;
    b.remaining = this.bookRemaining();
    b.running = false;
    if (b.handle) { clearInterval(b.handle); b.handle = null; }
    if (this._bookPaint) this._bookPaint();
  }
  resetBook() {
    const b = this.bookTimer;
    if (b.handle) { clearInterval(b.handle); b.handle = null; }
    b.running = false; b.remaining = this.bookMinutes() * 60;
    // NOTE: `startPage` is deliberately NOT cleared here. The bell calls
    // resetBook, and the user regularly dismisses the notice to finish a
    // chapter. If the snapshot died with the timer, the "DONE" button in the
    // note would give just the end page with no range. The range only closes
    // once a takeaway is saved (or via ↺ / changing the preset).
    if (this._bookPaint) this._bookPaint();
  }
  finishBook() {
    const min = this.bookMinutes();
    this.resetBook();
    this.bell();
    // The bell no longer opens a window. The user dismissed it anyway to
    // finish a chapter, and the session vanished without a trace. Now it's
    // just a signal — the user closes the session themselves, with the DONE
    // button, when they actually finish.
    new Notice(`📖 ${min} minutes of reading — click DONE when you wrap up the thought.`);
  }
  // Bell generated on the fly instead of an audio file: the plugin stays a
  // single file, and the sound doesn't depend on nobody having deleted the attachment.
  bell() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [0, 0.28, 0.56].forEach((at, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 2 ? 1046.5 : 880; // last tone higher = "done", not "tick"
        // ramps instead of a hard start/stop — otherwise you hear a click instead of a chime
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.24);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch (e) { /* no audio = oh well, the Notice went out anyway */ }
  }

  async renderBook(body) {
    // what I'm reading now — a single field, saved in the plugin's data.json
    const head = body.createDiv({ cls: 'cc-book-head' });
    head.createEl('h3', { cls: 'cc-h', text: '📖 Book' });
    const bookInput = head.createEl('input', {
      cls: 'cc-input cc-book-input',
      attr: { type: 'text', placeholder: 'What I\'m reading now…', value: this.plugin.settings.book || '' },
    });
    bookInput.addEventListener('change', () => this.plugin.setBook(bookInput.value.trim()));

    // PDF picker + open in the "book | notes" layout
    const openRow = body.createDiv({ cls: 'cc-book-open' });
    // ONLY from `Library/books/` — it used to scan the whole vault, which
    // pulled unrelated syllabus PDFs into the book list. This folder is the
    // definition of "what I'm reading", so the list should reflect that, not
    // guess from a file extension. Exception: the currently selected PDF
    // stays on the list even from outside the folder, otherwise moving the
    // file would silently clear the selection.
    const chosen = this.plugin.settings.pdfPath;
    const pdfs = this.app.vault.getFiles()
      .filter(f => f.extension === 'pdf' && (f.path.startsWith(BOOK_FOLDER + '/') || f.path === chosen))
      .sort((a, b) => a.basename.localeCompare(b.basename));
    const sel = openRow.createEl('select', { cls: 'cc-input cc-book-select' });
    sel.createEl('option', { text: pdfs.length ? '— choose a PDF —' : `no PDFs in ${BOOK_FOLDER}/`, attr: { value: '' } });
    for (const f of pdfs) {
      const o = sel.createEl('option', { text: f.basename, attr: { value: f.path } });
      if (f.path === this.plugin.settings.pdfPath) o.selected = true;
    }
    sel.addEventListener('change', () => this.plugin.setPdf(sel.value));
    const openBtn = openRow.createEl('button', { cls: 'cc-b primary cc-book-open-btn', text: '📚 Open book' });
    openBtn.onclick = () => this.openBook();
    const mapBtn = openRow.createEl('button', { cls: 'cc-b cc-book-open-btn', text: '🎨 Mind map' });
    mapBtn.onclick = async () => {
      const book = (this.plugin.settings.book || '').trim();
      if (!book) { new Notice('Type what you\'re reading first.'); return; }
      const m = await this.mindMap(book);
      if (m) this.app.workspace.getLeaf('tab').openFile(m);
    };

    // "where I left off" bar — the only place that answers this without
    // opening a table. Sourced from the last session's frontmatter, so ✎
    // leads straight to where the number can be fixed by hand.
    const last = this.lastPageInfo();
    const lastRow = body.createDiv({ cls: 'cc-book-last' });
    lastRow.createDiv({ cls: 'cc-book-last-t', text: '📍 Last at p.' });
    // The field is ALWAYS editable, even before anything's been saved —
    // otherwise on the first session, or after reading on a tablet, there's
    // nowhere to type the number by hand.
    const pageIn = lastRow.createEl('input', {
      cls: 'cc-input cc-last-page',
      attr: { type: 'number', min: '1', placeholder: '—', value: last ? String(last.page) : '',
              title: 'Type and confirm with Enter — overwrites the last page in the session note' },
    });
    const save = () => {
      const n = parseInt(pageIn.value, 10);
      if (!Number.isFinite(n) || n < 1) return;
      if (last && n === last.page) return;          // no write if nothing changed
      this.setLastPage(n);
    };
    pageIn.addEventListener('change', save);
    pageIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); pageIn.blur(); } });

    if (last) {
      const go = lastRow.createEl('button', { cls: 'cc-b primary cc-book-open-btn', text: '↩ Go back' });
      go.setAttr('aria-label', `Open the PDF at page ${last.page}`);
      go.onclick = () => this.gotoPage(last.page);
      const fix = lastRow.createEl('button', { cls: 'cc-b cc-book-open-btn', text: '✎' });
      fix.setAttr('aria-label', 'Open the session note');
      fix.onclick = () => this.app.workspace.openLinkText(last.file.path, '', false);
    } else {
      lastRow.createDiv({ cls: 'cc-book-last-hint', text: 'nothing yet — type a page or stamp a session' });
    }

    // 15-minute timer
    const tb = body.createDiv({ cls: 'cc-timer cc-book-timer' });
    const disp = tb.createDiv({ cls: 'cc-timer-disp' });
    const btns = tb.createDiv({ cls: 'cc-timer-btns' });
    const startBtn = btns.createEl('button', { cls: 'cc-b primary', text: this.bookTimer.running ? '⏸' : '▶' });
    // No isConnected guard: render() builds the view in a detached tree and
    // only attaches it afterward, so the first paint runs on a still-detached
    // node — a guard would leave the clock blank until the first tick.
    // Stale closures from a re-render are harmless: this._bookPaint always points at the latest.
    const paint = () => {
      const left = this.bookRemaining();
      disp.setText(`${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`);
      startBtn.setText(this.bookTimer.running ? '⏸' : '▶');
    };
    this._bookPaint = paint;
    paint();
    startBtn.onclick = () => { this.bookTimer.running ? this.pauseBook() : this.startBook(); paint(); };
    btns.createEl('button', { cls: 'cc-b', text: '+5' }).onclick = () => {
      const b = this.bookTimer;
      if (b.running) b.endsAt += 300000; else b.remaining += 300;
      paint();
    };
    // ↺ is the only place where the user deliberately says "this block
    // doesn't count" — so the page snapshot is discarded along with the countdown here.
    btns.createEl('button', { cls: 'cc-b', text: '↺' }).onclick = () => { this.bookTimer.startPage = null; this.resetBook(); };

    // length — typed by hand, not picked from presets. Changing it resets the countdown.
    const lenWrap = tb.createDiv({ cls: 'cc-timer-btns cc-book-presets' });
    const lenIn = lenWrap.createEl('input', {
      cls: 'cc-input cc-book-minutes',
      attr: { type: 'number', min: '1', value: String(this.bookMinutes()),
              title: 'Type minutes and confirm with Enter' },
    });
    const applyLen = async () => {
      const n = parseInt(lenIn.value, 10);
      if (!Number.isFinite(n) || n < 1 || n === this.bookMinutes()) return;
      await this.plugin.setMinutes(n);
      this.bookTimer.startPage = null;
      this.resetBook();
      this.render();
    };
    lenIn.addEventListener('change', applyLen);
    lenIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); lenIn.blur(); } });
    tb.createDiv({ cls: 'cc-timer-label', text: 'MIN' });

    // takeaway widget — the same one that pops up on its own after the bell
    const ask = body.createEl('button', { cls: 'cc-b primary cc-lesson-btn', text: '✅ DONE — save takeaway' });
    ask.onclick = () => this.stampLesson();

    // recent takeaways
    const notes = this.bookNotes();
    body.createEl('h3', { cls: 'cc-h', text: `🗂️ Recent takeaways (${notes.length})` });
    if (!notes.length) {
      body.createDiv({ cls: 'cc-empty', text: 'Nothing yet. Start the timer and dictate the first takeaway.' });
    } else {
      const list = body.createDiv({ cls: 'cc-todo' });
      for (const f of notes.slice(0, 8)) {
        const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
        const row = list.createDiv({ cls: 'cc-todo-row cc-book-row' });
        row.createDiv({ cls: 'cc-todo-cb', text: '📖' });
        row.createDiv({ cls: 'cc-todo-t', text: f.basename });
        const meta = [fm.book, fm.pages ? `p. ${fm.pages}` : null].filter(Boolean).join(' · ');
        if (meta) row.createDiv({ cls: 'cc-book-meta', text: meta });
        row.onclick = () => this.app.workspace.openLinkText(f.path, '', false);
      }
    }
    const base = body.createEl('button', { cls: 'cc-b', text: '📊 Open takeaways table' });
    base.onclick = () => this.app.workspace.openLinkText(`${BOOK_FOLDER}/books.base`, '', false);
  }

  // One click = the reading layout: PDF on the left, this book's working note
  // on the right. The working note is NOT the same as a 15-minute takeaway —
  // quotes, formulas and code land here while reading, a single thought lands
  // there after the bell. Hence a different tag and a separate file.
  async openBook() {
    const pdf = this.findPdf();
    if (!pdf) { new Notice('Pick a PDF from the list next to the button first.'); return; }

    // Don't multiply tabs: if this PDF is already open somewhere, go back to it.
    let leaf = this.app.workspace.getLeavesOfType('pdf').find(l => l.view && l.view.file && l.view.file.path === pdf.path);
    if (leaf) this.app.workspace.revealLeaf(leaf);
    else { leaf = this.app.workspace.getLeaf('tab'); await leaf.openFile(pdf); }

    await this.openSideNote(leaf);
  }

  // Just the note next to the book, without touching the PDF. Split out from
  // `openBook` because the same layout is triggered by an icon in the reader's
  // header: the user closes the note, keeps reading, and wants it back without jumping to Life OS Hub.
  async openSideNote(pdfLeaf) {
    const pdf = this.findPdf();
    const book = (this.plugin.settings.book || '').trim() || (pdf && pdf.basename) || 'Untitled';
    const note = await this.sessionNote(book, pdf);
    await this.ensureDoneButton(note);

    const leaf = pdfLeaf || this.app.workspace.getLeavesOfType('pdf')
      .find(l => l.view && l.view.file && (!pdf || l.view.file.path === pdf.path));
    // We only consider the note "already open alongside" if it sits in a
    // DIFFERENT tab group than the PDF. Without this check, it was enough for
    // it to be open as a regular tab next to the book, and the button silently stopped splitting.
    let side = this.app.workspace.getLeavesOfType('markdown')
      .find(l => l.view && l.view.file && l.view.file.path === note.path && (!leaf || l.parent !== leaf.parent));
    if (!side) {
      side = leaf ? this.app.workspace.createLeafBySplit(leaf, 'vertical') : this.app.workspace.getLeaf('tab');
      await side.openFile(note);
    }
    if (leaf) this.sizeNotePane(leaf, side);
    this.app.workspace.setActiveLeaf(side, { focus: true });
    return side;
  }

  // A remembered PDF can move (the user reorganizes the vault) — then the
  // saved path stops existing, and the button would say "pick a PDF" even
  // though the file is there. Hence a fallback by filename, silently updating the setting.
  findPdf() {
    const saved = this.plugin.settings.pdfPath;
    if (!saved) return null;
    const direct = this.app.vault.getAbstractFileByPath(saved);
    if (direct) return direct;
    const name = saved.split('/').pop();
    const moved = this.app.vault.getFiles().find(f => f.extension === 'pdf' && f.name === name);
    if (moved) this.plugin.setPdf(moved.path);
    return moved || null;
  }

  // ——— "Where I left off" ———
  // Obsidian's PDF reader only exposes the current page through a private
  // API: `view.viewer.child.pdfViewer.pdfViewer` gives `currentPageNumber`,
  // and ASSIGNING to it scrolls the document. `openLinkText('file.pdf#page=N')`
  // and `leaf.setEphemeralState({page})` do NOT scroll — don't swap this for
  // a "nicer" wikilink, it'll silently stop working. This whole thing is
  // best-effort: no open PDF means no hint, never an error, and the page
  // number always stays manually editable.
  pdfViewerFor(pdf) {
    try {
      const leaf = this.app.workspace.getLeavesOfType('pdf')
        .find(l => l.view && l.view.file && (!pdf || l.view.file.path === pdf.path));
      return leaf.view.viewer.child.pdfViewer.pdfViewer || null;
    } catch (e) { return null; }
  }
  currentPage() {
    const pv = this.pdfViewerFor(this.findPdf());
    const n = pv && pv.currentPageNumber;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Only the page number IN THE FILE — the same one the reader's toolbar
  // shows and that "go back" jumps to. We deliberately don't try to guess the
  // number printed in the book: offsets drift when a book has unnumbered
  // inserted pages, so it has to be scraped from header text, which is
  // unreliable. A number that can't be verified is worse than no number at all.
  //
  // The range is ORDERED: it was possible to finish a block on a page earlier
  // than the start (flipping back a page), which produced something like "26-25".
  async formatPages(from, to) {
    if (!to) return '';
    if (!from || from === to) return `${to}`;
    return `${Math.min(from, to)}-${Math.max(from, to)}`;
  }

  // Cleans up the page field: strips old printed-page parentheticals and
  // reverses ranges like "26-25" that appeared when the user flipped back a
  // page before stamping. Called on every save, so old entries fix
  // themselves the moment you touch them.
  normalizePages(s) {
    return String(s || '').replace(/\s*\([^)]*\)/g, '')
      .split(',').map((part) => {
        const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
        if (!m) return part.trim();
        const a = Number(m[1]), b = Number(m[2]);
        return a === b ? `${a}` : `${Math.min(a, b)}-${Math.max(a, b)}`;
      }).filter(Boolean).join(', ');
  }

  // processFrontMatter returns control BEFORE metadataCache reindexes the
  // file, and the "last page" bar reads from that cache. Without this wait,
  // a render right after stamping a session showed "No saved page" despite a correct write.
  awaitMeta(file, ms = 1500) {
    return new Promise((res) => {
      const finish = () => { this.app.metadataCache.offref(ref); clearTimeout(to); res(); };
      const ref = this.app.metadataCache.on('changed', (f) => { if (f.path === file.path) finish(); });
      const to = setTimeout(finish, ms);
    });
  }

  // Manual correction of the last page — read on a tablet, on paper, or the
  // reader's detection drifted. We replace the LAST number in the field, not
  // the whole field: `pages` accumulates across the whole day ("21-34,
  // 40-52"), so overwriting it would erase the history.
  async setLastPage(n) {
    const info = this.lastPageInfo();
    const file = info ? info.file : this.bookNotes()[0];
    if (!file) { new Notice('No session note — stamp a session first.'); return; }
    this.markSelfWrite();
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      // Normalize BEFORE replacing: without it "the last number" could land
      // inside an old parenthetical and turn "26-25 (p. 16-2)" into "26-25 (p. 16-25)".
      const cur = this.normalizePages(fm.pages);
      fm.pages = /\d/.test(cur) ? this.normalizePages(cur.replace(/(\d+)(?!.*\d)/, String(n))) : String(n);
    });
    await this.awaitMeta(file);
    this.render();
  }

  // Last page taken from the last session's frontmatter, NOT from the
  // plugin's data.json. Reason: this is the only version where a manual
  // correction actually works. Read on a tablet, or detection glitched → type
  // the right number into `pages:` and the bar with the "go back" button
  // updates right away, no config digging.
  lastPageInfo() {
    const book = (this.plugin.settings.book || '').trim();
    for (const f of this.bookNotes()) {
      const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
      if (book && String(fm.book || '').trim() !== book) continue;
      // Parentheticals stripped: old entries may still have a printed-page
      // number in them ("26-25 (p. 16-2)"), and we always jump by the page number in the file.
      const nums = String(fm.pages || '').replace(/\([^)]*\)/g, '').match(/\d{1,4}/g);
      if (nums && nums.length) return { page: Number(nums[nums.length - 1]), file: f };
    }
    return null;
  }

  async gotoPage(n) {
    const pdf = this.findPdf();
    if (!pdf) { new Notice('Pick a PDF from the list next to the button first.'); return; }
    let leaf = this.app.workspace.getLeavesOfType('pdf').find(l => l.view && l.view.file && l.view.file.path === pdf.path);
    if (leaf) this.app.workspace.revealLeaf(leaf);
    else { leaf = this.app.workspace.getLeaf('tab'); await leaf.openFile(pdf); }
    // The reader mounts asynchronously — without waiting, the assignment
    // silently fails and the button looks broken.
    for (let i = 0; i < 20; i++) {
      const pv = this.pdfViewerFor(pdf);
      if (pv && pv.pagesCount) { pv.currentPageNumber = Math.min(n, pv.pagesCount); return; }
      await new Promise(r => setTimeout(r, 150));
    }
    new Notice('The PDF reader didn\'t respond — scroll manually.');
  }

  // Book gets 3/4, note gets 1/4. `dimension` is a percentage on the split's
  // children; after changing it you have to manually ask it to recompute.
  sizeNotePane(pdfLeaf, noteLeaf) {
    try {
      const a = pdfLeaf.parent, b = noteLeaf.parent;
      const split = a && b && a.parent === b.parent ? a.parent : null;
      if (!split || !split.children || split.children.length !== 2) return;
      const iNote = split.children.indexOf(b);
      if (iNote < 0) return;
      split.children[iNote].dimension = NOTE_PANE_PCT;
      split.children[1 - iNote].dimension = 100 - NOTE_PANE_PCT;
      if (split.recomputeChildrenDimensions) split.recomputeChildrenDimensions();
    } catch (e) { /* window layout is a private API — if it changes, this just stays 50/50 */ }
  }

  // Folder for a book: everything from one read in one place — the working
  // note, session takeaways, and if Excalidraw is installed, mind maps too.
  async bookDir(book) {
    const safe = String(book || '').replace(FS_BAD_RE, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
    if (!this.app.vault.getAbstractFileByPath(BOOK_FOLDER)) await this.app.vault.createFolder(BOOK_FOLDER);
    const path = `${BOOK_FOLDER}/${safe}`;
    if (!this.app.vault.getAbstractFileByPath(path)) await this.app.vault.createFolder(path);
    return path;
  }

  // ONE file per session (day × book): reading notes and takeaways together.
  // There used to be two separate things — a working note per book and a file
  // per takeaway — and after a few sessions that turned into clutter. Now you
  // paste formulas into the top section, and the widget appends takeaways to
  // the bottom of the same file.
  sessionPath(dir, book, dayM) {
    const safe = dir.slice(BOOK_FOLDER.length + 1);
    return `${dir}/${dayM.format('YYYY-MM-DD')} — ${safe}.md`;
  }
  async sessionNote(book, pdf) {
    const dir = await this.bookDir(book);
    const day = moment();
    const path = this.sessionPath(dir, book, day);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing) return existing;
    const map = await this.mindMap(book);
    this.markSelfWrite();
    return this.app.vault.create(path, [
      '---',
      `book: "${String(book).replace(/"/g, "'")}"`,
      `date: ${day.format('YYYY-MM-DD')}`,
      'pages: ""',
      'minutes: 0',
      'tags:',
      '  - book',
      '---',
      '',
      `# ${book} — ${day.format('D MMMM YYYY')}`,
      '',
      DONE_FENCE,
      '',
      pdf ? `Source: [[${pdf.path}]]` : '',
      '',
      `## ${SEC_NOTES}`,
      '<!-- formulas, code, quotes — paste these in while reading -->',
      '',
      '',
      `## ${SEC_LESSONS}`,
      '<!-- fills in on its own after the bell -->',
      '',
      `## ${SEC_MAP}`,
      // ONE map per book, not per session — hence an embed, not a new drawing.
      // Every day shows the same, growing canvas; clicking it opens full screen.
      map ? `![[${map.path}]]` : '_(mind map will appear once Excalidraw is installed)_',
      '',
    ].join('\n'));
  }

  // Notes from before the DONE button existed don't have the block, and the
  // block itself can be deleted by accident. Since the plugin creates these
  // files, it also maintains its own scaffolding — it re-adds the block when
  // opening a book if it's missing.
  async ensureDoneButton(file) {
    if ((await this.app.vault.cachedRead(file)).includes('```' + DONE_BLOCK)) return;
    this.markSelfWrite();
    await this.app.vault.process(file, (d) => {
      const lines = d.split(/\r?\n/);
      // right under the H1; if there isn't one, right under the frontmatter, never before it
      let i = lines.findIndex(l => /^#\s/.test(l));
      if (i < 0) {
        i = -1;
        if (lines[0] === '---') { const end = lines.indexOf('---', 1); if (end > 0) i = end; }
      }
      lines.splice(i + 1, 0, '', DONE_FENCE);
      return lines.join('\n');
    });
  }

  // An infinite canvas per book. Created through the plugin's own API
  // (`ExcalidrawAutomate`), not by hand-assembling the file format — the
  // `.excalidraw.md` format is internal and changes between versions.
  async mindMap(book) {
    const ex = this.app.plugins.plugins['obsidian-excalidraw-plugin'];
    const ea = ex && (ex.ea || window.ExcalidrawAutomate);
    if (!ea) return null;
    const dir = await this.bookDir(book);
    const name = `${dir.slice(BOOK_FOLDER.length + 1)} — map`;
    const existing = this.app.vault.getAbstractFileByPath(`${dir}/${name}.excalidraw.md`);
    if (existing) return existing;
    try {
      ea.reset();
      this.markSelfWrite();
      const path = await ea.create({ filename: name, foldername: dir, onNewPane: false, silent: true });
      // create() returns a path or nothing — either way we look the file up by name
      return this.app.vault.getAbstractFileByPath(typeof path === 'string' ? path : `${dir}/${name}.excalidraw.md`);
    } catch (e) {
      new Notice('Could not create the mind map — check the Excalidraw plugin');
      return null;
    }
  }

  // List of session takeaways. Working notes (one per book) are filtered out
  // here — those are a workspace, not takeaways, and would clutter the count.
  // Recurses through book subfolders. A takeaway is ONLY a file tagged
  // `book` — working notes and Excalidraw drawings (also .md files!) drop out
  // on their own, no exception list to maintain.
  bookNotes() {
    return this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(BOOK_FOLDER + '/'))
      .filter(f => {
        const tags = ((this.app.metadataCache.getFileCache(f) || {}).frontmatter || {}).tags;
        return Array.isArray(tags) ? tags.includes('book') : tags === 'book';
      })
      .sort((a, b) => b.stat.ctime - a.stat.ctime);
  }

  // STAMP instead of a modal. Dictating a takeaway used to happen in a modal,
  // which had two problems at once: the window popped up mid-read (the user
  // dismissed it and the session was lost), and typing was cut off from the
  // highlights and formulas just pasted into the note. Now a click stamps the
  // heading with metadata and puts the cursor right under it — the thought
  // gets written in the note, next to the PDF.
  //
  // The metadata CAN'T be moved to manual typing: `pages` feeds `books.base`
  // and the "where I left off" bar, `minutes` tracks real time, and the 📖
  // habit gets checked off in the journal. Before this was automatic, `pages`
  // was empty in 4 sessions out of 5.
  async stampLesson(from = this.bookTimer.startPage) {
    const pdf = this.findPdf();
    const book = (this.plugin.settings.book || '').trim() || (pdf && pdf.basename) || 'Untitled';
    const f = await this.sessionNote(book, pdf);
    await this.ensureDoneButton(f);
    const min = this.bookMinutes();
    const pages = await this.formatPages(from, this.currentPage());
    const heading = `### ${moment().format('HH:mm')}${pages ? ` · p. ${pages}` : ''} · ${min} min`;

    this.markSelfWrite();
    await this.app.vault.process(f, (data) => {
      // The heading has to go at the END of the "What I learned" section, not
      // the end of the file — the mind-map section is already below it.
      const entry = `\n${heading}\n\n`;
      const i = data.indexOf(`## ${SEC_MAP}`);
      if (i < 0) return data.replace(/\s*$/, '\n') + entry;
      return data.slice(0, i).replace(/\s*$/, '\n') + entry + data.slice(i);
    });
    // minutes accumulate across the whole day, pages get appended comma-separated —
    // so the sum in books.base still says how much was really read.
    await this.app.fileManager.processFrontMatter(f, (fm) => {
      fm.minutes = (Number(fm.minutes) || 0) + min;
      if (pages) fm.pages = this.normalizePages(fm.pages ? `${fm.pages}, ${pages}` : pages);
    });
    // Range closed — the next block counts from whatever page it's at then.
    this.bookTimer.startPage = null;

    await this.tickBookHabit();
    await this.focusUnder(f, heading);
    new Notice(pages ? `📖 Stamped: p. ${pages} — write under the heading` : '📖 Stamped — write under the heading');
    // Only after reindexing — otherwise the "last page" bar reads the stale
    // cache and shows "No saved page" right after we saved the page.
    await this.awaitMeta(f);
    this.render();
    return f;
  }

  // Cursor under the freshly stamped heading. Without this the stamp would
  // only be half the job — the user would still have to find the spot and
  // click, exactly the friction the modal was supposed to remove.
  async focusUnder(note, heading) {
    // Note not visible — enter the same "book | note" layout as 📚.
    let leaf = this.app.workspace.getLeavesOfType('markdown')
      .find(l => l.view && l.view.file && l.view.file.path === note.path);
    if (!leaf) leaf = await this.openSideNote();
    // Reading mode has no editor, so there'd be nowhere to place the cursor.
    if (leaf.view.getMode && leaf.view.getMode() === 'preview') {
      const st = leaf.getViewState();
      st.state = Object.assign({}, st.state, { mode: 'source' });
      await leaf.setViewState(st);
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    const ed = leaf.view && leaf.view.editor;
    if (!ed) return;
    const i = ed.getValue().split(/\r?\n/).lastIndexOf(heading);
    if (i < 0) return;
    ed.setCursor({ line: i + 1, ch: 0 });
    ed.scrollIntoView({ from: { line: i, ch: 0 }, to: { line: i + 2, ch: 0 } }, true);
  }

  // Checking off the 📖 habit is still a USER action (they saved a takeaway),
  // not an LLM judgment call — that's why it's allowed to touch the habit list.
  async tickBookHabit() {
    const f = this.app.vault.getAbstractFileByPath(`${JOURNAL_DIR}/${moment().format('YYYY-MM-DD')}.md`);
    if (!f) return;
    this.markSelfWrite();
    await this.app.vault.process(f, (data) => data.replace(/^([ \t]*-[ \t]*)\[ \]([ \t]*📖.*)$/m, '$1[x]$2'));
  }

  async habitRatio(file) {
    const data = await this.app.vault.cachedRead(file);
    let inSec = false, done = 0, total = 0;
    for (const l of data.split(/\r?\n/)) {
      if (/^#{1,6}\s/.test(l)) inSec = /habits/i.test(l);
      else if (inSec) {
        const m = l.match(/^\s*-\s*\[( |x|X)\]/);
        if (m) { total++; if (m[1].toLowerCase() === 'x') done++; }
      }
    }
    return { done, total };
  }

  async renderMetrics(body) {
    const map = this.journalByDay();
    // week cards
    let core = 0, minDone = 0, gym = 0, n = 0;
    for (let i = 6; i >= 0; i--) {
      const day = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const e = map[day];
      if (!e) continue;
      n++;
      if (typeof e.fm.core_hours === 'number') core += e.fm.core_hours;
      const md = String(e.fm.minimum_done ?? '').toLowerCase();
      if (md === 'yes' || md === 'true' || e.fm.minimum_done === true) minDone++;
      if (e.fm.gym === true) gym++;
    }
    const row = body.createDiv({ cls: 'cc-metrics' });
    const card = (label, val, sub) => {
      const c = row.createDiv({ cls: 'cc-metric' });
      c.createEl('b', { text: String(val) });
      c.createDiv({ cls: 'cc-metric-l', text: label });
      if (sub) c.createDiv({ cls: 'cc-metric-s', text: sub });
    };
    card('Core', `${core}h`, 'target 12–15h/week');
    card('Minimum ✓', `${minDone}/${n}`, 'days hit');
    card('Gym', `${gym}×`, 'target 2–3×');

    // 14-day bar chart
    body.createEl('h3', { cls: 'cc-h', text: '📊 Core hours — 14 days' });
    const vals = [];
    for (let i = 13; i >= 0; i--) {
      const day = moment().subtract(i, 'days');
      const e = map[day.format('YYYY-MM-DD')];
      vals.push({ d: day, v: (e && typeof e.fm.core_hours === 'number') ? e.fm.core_hours : 0 });
    }
    const max = Math.max(1, ...vals.map(x => x.v));
    const chart = body.createDiv({ cls: 'cc-bars' });
    for (const { d, v } of vals) {
      const col = chart.createDiv({ cls: 'cc-bcol' });
      const track = col.createDiv({ cls: 'cc-btrack' });
      const fill = track.createDiv({ cls: 'cc-bfill' });
      fill.style.height = `${Math.max(3, Math.round((v / max) * 100))}%`;
      fill.setAttr('title', `${d.format('DD.MM')}: ${v}h`);
      col.createDiv({ cls: 'cc-blabel', text: d.format('DD') });
    }

    // habit heatmap — 4 weeks
    body.createEl('h3', { cls: 'cc-h', text: '🔥 Habits — 4 weeks' });
    const heat = body.createDiv({ cls: 'cc-heat' });
    for (let i = 27; i >= 0; i--) {
      const day = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const e = map[day];
      let level = 0, label = 'no note';
      if (e) {
        const { done, total } = await this.habitRatio(e.f);
        level = total ? Math.round(done / total * 4) : 0;
        label = `${done}/${total} habits`;
      }
      heat.createDiv({ cls: `cc-heat-cell l${level}` }).setAttr('title', `${day}: ${label}`);
    }
  }

  // Status tab: rows from System/status.json (written by
  // System/scripts/vault-status.py). Nothing is computed here.
  async renderStatus(body) {
    const plugin = this.plugin;
    let snap = null;
    try {
      const a = this.app.vault.adapter;
      if (await a.exists(STATUS_PATH)) snap = JSON.parse(await a.read(STATUS_PATH));
    } catch (e) { snap = null; }

    const bar = body.createDiv({ cls: 'cc-status-bar' });
    const stale = snap && snap.date !== moment().format('YYYY-MM-DD');
    bar.createDiv({
      cls: 'cc-status-asof' + (stale ? ' stale' : ''),
      text: snap ? `As of ${moment(snap.generated).format('D MMM HH:mm')}${stale ? ' — from an earlier day' : ''}` : 'No snapshot yet',
    });
    if (plugin.canRunScripts()) {
      const refresh = bar.createEl('button', { cls: 'cc-b primary', text: 'Refresh' });
      refresh.onclick = async () => {
        refresh.disabled = true;
        const entry = plugin.scriptList().find(e => /vault-status\.py/.test(e.cmd)) || DEFAULT_SCRIPTS[0];
        const r = await plugin.runScript(entry);
        if (r.code !== 0) new Notice(`Status refresh failed: ${(r.err || r.out || r.message || '').trim().split('\n').pop()}`);
        this.render();
      };
      const all = bar.createEl('button', { cls: 'cc-b', text: 'Run scripts…' });
      all.onclick = () => plugin.openScriptRunner(() => this.render());
    } else {
      bar.createDiv({ cls: 'cc-status-hint', text: 'To refresh: run  python3 System/scripts/vault-status.py --write  on a computer.' });
    }

    if (!snap) {
      body.createDiv({ cls: 'cc-empty', text: 'Nothing to show yet. Refresh runs the status script and saves the result.' });
      return;
    }
    const list = body.createDiv({ cls: 'cc-status-list' });
    for (const c of snap.checks || []) {
      const row = list.createDiv({ cls: 'cc-status-row ' + (c.level || 'ok') });
      row.createSpan({ cls: 'cc-status-dot' });
      row.createDiv({ cls: 'cc-status-label', text: c.label });
      const val = row.createDiv({ cls: 'cc-status-val' });
      val.createDiv({ text: c.value });
      if (c.detail) val.createDiv({ cls: 'cc-status-detail', text: c.detail });
    }
  }

  // Colors tab. Everything is read back with getComputedStyle so the swatches
  // show what is actually on screen. Edits go through the plugin, which owns
  // the single managed <style> element (see applyColorOverrides), and then
  // refreshColors() repaints the rows in place — a full render() would close
  // the native colour picker mid-drag.
  async renderColors(body) {
    const plugin = this.plugin;
    this._colorRefreshers = [];
    if (this.colorsAdvanced === undefined) {
      this.colorsAdvanced = THEME_COLORS.some(c => plugin.settings.colors[c.key]);
    }

    body.createEl('h3', { cls: 'cc-h', text: '🌄 Background' });
    body.createDiv({
      cls: 'cc-colors-note',
      text: 'One color or gradient behind everything: the file explorer, sidebars and notes are see-through in this vault, so they take it too. It replaces the gradient from Style Settings until you pick Theme again. Dark and light mode are set separately.',
    });
    for (const [mode, label] of BG_MODES) this.backgroundEditor(body, mode, label);

    body.createEl('h3', { cls: 'cc-h', text: '🎨 In use now' });
    body.createDiv({
      cls: 'cc-colors-note',
      text: 'Live values after your theme, snippets and Style Settings. A color you change here wins over Style Settings; Reset hands it back.',
    });

    body.createEl('h4', { cls: 'cc-colors-sub', text: 'Life OS Hub palette' });
    const ccList = body.createDiv({ cls: 'cc-color-list' });
    for (const def of CC_COLORS) this.colorRow(ccList, def, true);
    const darkOnly = body.createDiv({
      cls: 'cc-colors-note',
      text: 'Card, border and secondary text are dark-mode colors; in light mode Life OS Hub takes them from your theme.',
    });
    this._colorRefreshers.push(() => {
      darkOnly.toggleClass('is-hidden', document.body.classList.contains('theme-dark'));
    });

    const themeHead = body.createDiv({ cls: 'cc-colors-subrow' });
    themeHead.createEl('h4', { cls: 'cc-colors-sub', text: 'Theme colors' });
    const adv = themeHead.createEl('label', { cls: 'cc-colors-adv' });
    const advBox = adv.createEl('input', { type: 'checkbox' });
    advBox.checked = this.colorsAdvanced;
    adv.createSpan({ text: 'Advanced' });
    const resetAll = themeHead.createEl('button', { cls: 'cc-b cc-colors-resetall', text: 'Reset all' });
    resetAll.setAttr('title', 'Remove every theme color override made here');
    resetAll.onclick = () => {
      plugin.resetColors(THEME_COLORS.map(c => c.key));
      this.refreshColors();
    };
    const themeList = body.createDiv({ cls: 'cc-color-list' });
    for (const def of THEME_COLORS) this.colorRow(themeList, def, this.colorsAdvanced);
    advBox.onchange = () => { this.colorsAdvanced = advBox.checked; this.render(); };
    resetAll.toggleClass('is-hidden', !this.colorsAdvanced);

    body.createEl('h4', { cls: 'cc-colors-sub', text: 'Readability' });
    const checks = body.createDiv({ cls: 'cc-contrast' });
    const pairs = [
      ['Text on background', '--text-normal', '@bg'],
      ['Life OS Hub accent on background', '--g', '@bg'],
      ['Theme accent on background', '--interactive-accent', '@bg'],
    ];
    const cells = pairs.map(([label]) => {
      const c = checks.createDiv({ cls: 'cc-contrast-row' });
      c.createSpan({ cls: 'cc-contrast-label', text: label });
      return c.createSpan({ cls: 'cc-contrast-val' });
    });
    checks.createDiv({ cls: 'cc-colors-note', text: `Warning only, below ${WCAG_MIN_CONTRAST}:1. Text colors are never changed for you.` });
    this._colorRefreshers.push(() => {
      pairs.forEach(([, fg, bg], i) => {
        const a = cssColorToHex(this.liveColor(fg));
        const bgs = this.effectiveBackgrounds().filter(Boolean);
        const cell = cells[i];
        if (!a || !bgs.length) { cell.setText('—'); cell.removeClass('is-low'); return; }
        // Against a gradient the readable-everywhere answer is the worst stop.
        const ratio = Math.min(...bgs.map(b => contrastRatio(hexToRgb(a), hexToRgb(b))));
        const low = ratio < WCAG_MIN_CONTRAST;
        cell.setText(`${ratio.toFixed(1)}:1 ${low ? '⚠ low contrast' : '✓'}`);
        cell.toggleClass('is-low', low);
      });
    });

    body.createEl('h3', { cls: 'cc-h', text: '🖼 From your banner' });
    const modes = [['dark', 'Dark mode', 'dark mode'], ['light', 'Light mode', 'light mode']];
    const found = modes.map(([, , needle]) => this.findBanner(needle));
    const analyses = await Promise.all(found.map(path => path ? this.bannerAnalysis(path) : null));
    const boxes = [];
    modes.forEach(([mode, label], i) => {
      const box = body.createDiv({ cls: 'cc-pal' });
      boxes.push([mode, box]);
      const head = box.createDiv({ cls: 'cc-pal-head' });
      head.createSpan({ cls: 'cc-pal-title', text: `${label} banner` });
      head.createSpan({ cls: 'cc-pal-tag', text: 'active' });
      const path = found[i], info = analyses[i];
      if (!path) {
        box.createDiv({ cls: 'cc-colors-note', text: `No "${modes[i][2]}" picture found. Drop one onto the banner.` });
        return;
      }
      head.createSpan({ cls: 'cc-pal-file', text: path.split('/').pop() });
      if (!info || !info.palette.length) {
        box.createDiv({ cls: 'cc-colors-note', text: 'Could not read colors from this picture.' });
        return;
      }
      const grid = box.createDiv({ cls: 'cc-pal-grid' });
      for (const { hex, share } of info.palette) {
        const cell = grid.createDiv({ cls: 'cc-pal-cell' });
        const sw = cell.createEl('button', { cls: 'cc-pal-swatch' });
        sw.style.background = hex;
        sw.setAttr('title', `Copy ${hex}`);
        sw.onclick = async () => {
          try { await navigator.clipboard.writeText(hex); new Notice(`Copied ${hex}`); }
          catch (e) { new Notice(`Couldn’t copy — ${hex}`); }
        };
        cell.createDiv({ cls: 'cc-pal-hex', text: hex });
        cell.createDiv({ cls: 'cc-pal-share', text: `${Math.round(share * 100)}%` });
        const use = cell.createEl('button', { cls: 'cc-b cc-pal-use', text: 'Use as accent' });
        use.onclick = () => {
          plugin.setColors({ '--cc-accent': hex, '--cc-accent-dark': darkenHex(hex) });
          this.refreshColors();
          new Notice(`Accent set to ${hex}`);
        };
      }
    });
    this._colorRefreshers.push(() => {
      const light = document.body.classList.contains('theme-light');
      for (const [mode, box] of boxes) box.toggleClass('is-active', (mode === 'light') === light);
    });

    this.refreshColors();
  }

  // What the text actually sits on: the window color(s) set for the current
  // mode, otherwise the theme's background. (A gradient from Style Settings
  // can't be reduced to colors we can read back, so that case falls back to
  // the theme background as a best estimate.)
  effectiveBackgrounds() {
    const mode = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    const cfg = this.plugin.settings.background[mode];
    if (!cfg) return [cssColorToHex(this.liveColor('--background-primary'))];
    const base = cfg.kind === 'solid' ? [cfg.color] : cfg.stops;
    // A glow at full strength over each base colour is the extreme case.
    const lit = (cfg.glows || []).flatMap(g => base.map(b => mixHex(b, g.color, g.alpha / 100)));
    return [...base, ...lit];
  }

  liveColor(variable) {
    return getComputedStyle(this.contentEl).getPropertyValue(variable);
  }

  refreshColors() {
    for (const fn of this._colorRefreshers || []) fn();
  }

  // Background editor for one mode: Theme / Solid / Gradient, plus optional
  // glows on top of a solid or gradient base. Editing a value repaints
  // through refreshColors() without rebuilding the controls (a rebuild would
  // close the native picker); switching kind or adding and removing a stop
  // or glow rebuilds them.
  backgroundEditor(parent, mode, label) {
    const plugin = this.plugin;
    const box = parent.createDiv({ cls: 'cc-bg' });
    const head = box.createDiv({ cls: 'cc-bg-head' });
    head.createSpan({ cls: 'cc-bg-title', text: label });
    head.createSpan({ cls: 'cc-color-badge cc-bg-active', text: 'active' });
    head.createSpan({ cls: 'cc-color-badge cc-bg-set', text: 'overridden' });
    const preview = box.createDiv({ cls: 'cc-bg-preview' });
    const previewNote = preview.createSpan({ cls: 'cc-bg-preview-note' });
    const kinds = box.createDiv({ cls: 'cc-bg-kinds' });
    const controls = box.createDiv({ cls: 'cc-bg-controls' });

    const cfg = () => plugin.settings.background[mode];
    const save = (v) => { plugin.setBackground(mode, v); this.refreshColors(); };
    const accent = () => cssColorToHex(this.liveColor('--g')) || '#888888';
    const baseColor = () => {
      const c = cfg();
      if (c) return c.kind === 'solid' ? c.color : c.stops[0];
      return cssColorToHex(this.liveColor('--background-primary')) || '#000000';
    };

    // Picker + hex field. onChange gets a valid #RRGGBB.
    const colorPair = (host, value, onChange) => {
      const pair = host.createDiv({ cls: 'cc-bg-pair' });
      const picker = pair.createEl('input', { cls: 'cc-color-swatch', type: 'color' });
      const hex = pair.createEl('input', { cls: 'cc-color-hexfield', type: 'text' });
      hex.setAttr('spellcheck', 'false');
      hex.setAttr('maxlength', '7');
      picker.value = value.toLowerCase();
      hex.value = value;
      picker.oninput = () => { hex.value = picker.value.toUpperCase(); onChange(picker.value.toUpperCase()); };
      const apply = (strict) => {
        const raw = hex.value.trim().replace(/^#/, '');
        if (strict ? !normHex(raw) : raw.length !== 6 || !normHex(raw)) return false;
        const v = normHex(raw);
        picker.value = v.toLowerCase();
        onChange(v);
        return true;
      };
      hex.oninput = () => apply(false);
      hex.onchange = () => { if (!apply(true)) hex.value = picker.value.toUpperCase(); };
      hex.onkeydown = (ev) => { if (ev.key === 'Enter') hex.blur(); };
      return pair;
    };
    const slider = (host, text, min, max, value, fmt, onInput) => {
      const line = host.createDiv({ cls: 'cc-bg-angle' });
      line.createSpan({ cls: 'cc-bg-slabel', text });
      const input = line.createEl('input', { type: 'range' });
      input.min = String(min); input.max = String(max); input.step = '1'; input.value = String(value);
      const val = line.createSpan({ cls: 'cc-bg-angle-val', text: fmt(value) });
      input.oninput = () => { val.setText(fmt(Number(input.value))); onInput(Number(input.value)); };
    };
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const edit = (fn) => { const c = clone(cfg()); fn(c); save(c); };

    const build = () => {
      const c = cfg();
      kinds.empty();
      controls.empty();
      const kindBtn = (text, on, action) => {
        const b = kinds.createEl('button', { cls: 'cc-b cc-bg-kind' + (on ? ' is-on' : ''), text });
        b.onclick = () => { action(); build(); };
      };
      kindBtn('Theme', !c, () => save(null));
      kindBtn('Solid', c?.kind === 'solid', () => {
        if (c?.kind !== 'solid') save({ kind: 'solid', color: baseColor(), glows: c?.glows || [] });
      });
      kindBtn('Gradient', c?.kind === 'gradient', () => {
        if (c?.kind !== 'gradient') save(c ? { kind: 'gradient', angle: 160, stops: [c.color, mixHex(c.color, accent(), 0.4)], glows: c.glows || [] } : clone(BG_AURORA[mode]));
      });
      if (!c) {
        controls.createDiv({ cls: 'cc-colors-note', text: 'Using whatever your theme and Style Settings paint.' });
        return;
      }

      // Base layer
      if (c.kind === 'solid') {
        colorPair(controls, c.color, (v) => edit(x => { x.color = v; }));
      } else {
        c.stops.forEach((stop, i) => {
          const line = controls.createDiv({ cls: 'cc-bg-stop' });
          colorPair(line, stop, (v) => edit(x => { x.stops[i] = v; }));
          if (c.stops.length > BG_MIN_STOPS) {
            const rm = line.createEl('button', { cls: 'cc-b cc-bg-small', text: '✕' });
            rm.setAttr('title', 'Remove this color');
            rm.onclick = () => { edit(x => { x.stops.splice(i, 1); }); build(); };
          }
        });
        const tools = controls.createDiv({ cls: 'cc-bg-tools' });
        if (c.stops.length < BG_MAX_STOPS) {
          const add = tools.createEl('button', { cls: 'cc-b cc-bg-small', text: '＋ Add color' });
          add.onclick = () => { edit(x => { x.stops.push(mixHex(x.stops[x.stops.length - 1], accent(), 0.4)); }); build(); };
        }
        const rev = tools.createEl('button', { cls: 'cc-b cc-bg-small', text: '⇄ Reverse' });
        rev.onclick = () => { edit(x => { x.stops.reverse(); }); build(); };
        slider(controls, 'Angle', 0, 360, c.angle, v => `${v}°`, v => edit(x => { x.angle = v; }));
      }

      // Glow layers
      const gh = controls.createDiv({ cls: 'cc-bg-glowhead' });
      gh.createSpan({ text: 'Glows' });
      gh.createSpan({ cls: 'cc-colors-note', text: 'soft spots of color over the base' });
      const gtools = controls.createDiv({ cls: 'cc-bg-tools' });
      if ((c.glows || []).length < BG_MAX_GLOWS) {
        const add = gtools.createEl('button', { cls: 'cc-b cc-bg-small', text: '＋ Add glow' });
        add.onclick = () => {
          edit(x => {
            x.glows = x.glows || [];
            const [gx, gy] = BG_GLOW_SPOTS[x.glows.length % BG_GLOW_SPOTS.length];
            x.glows.push({ x: gx, y: gy, color: accent(), alpha: 25, size: 55 });
          });
          build();
        };
      }
      const aurora = gtools.createEl('button', { cls: 'cc-b cc-bg-small', text: '✨ Aurora preset' });
      aurora.setAttr('title', 'The theme’s own look: a dark base with three soft glows');
      aurora.onclick = () => { save(clone(BG_AURORA[mode])); build(); };
      (c.glows || []).forEach((g, i) => {
        const card = controls.createDiv({ cls: 'cc-bg-glow' });
        const top = card.createDiv({ cls: 'cc-bg-stop' });
        colorPair(top, g.color, (v) => edit(x => { x.glows[i].color = v; }));
        const rm = top.createEl('button', { cls: 'cc-b cc-bg-small', text: '✕' });
        rm.setAttr('title', 'Remove this glow');
        rm.onclick = () => { edit(x => { x.glows.splice(i, 1); }); build(); };
        slider(card, 'Left–right', 0, 100, g.x, v => `${v}%`, v => edit(x => { x.glows[i].x = v; }));
        slider(card, 'Top–bottom', 0, 100, g.y, v => `${v}%`, v => edit(x => { x.glows[i].y = v; }));
        slider(card, 'Size', 10, 100, g.size, v => `${v}%`, v => edit(x => { x.glows[i].size = v; }));
        slider(card, 'Strength', 0, 100, g.alpha, v => `${v}%`, v => edit(x => { x.glows[i].alpha = v; }));
      });
    };
    build();

    this._colorRefreshers.push(() => {
      const c = cfg();
      const active = (mode === 'light') === document.body.classList.contains('theme-light');
      box.toggleClass('is-active', active);
      box.toggleClass('is-set', !!c);
      if (active) {
        // What <body> is painted with right now, whoever set it.
        const cs = getComputedStyle(document.body);
        preview.style.backgroundImage = cs.backgroundImage;
        preview.style.backgroundColor = cs.backgroundColor;
        preview.style.backgroundBlendMode = cs.backgroundBlendMode;
        previewNote.setText('');
      } else {
        preview.style.backgroundImage = c ? backgroundCss(c) : 'none';
        preview.style.backgroundColor = 'transparent';
        preview.style.backgroundBlendMode = 'normal';
        previewNote.setText(c ? 'Shown when you switch to this mode' : 'Switch to this mode to see the theme background');
      }
    });
  }

  // One swatch row. `editable` rows carry the native picker (styled as the
  // swatch itself), a hex field and Reset; read-only rows just show the value.
  colorRow(parent, def, editable) {
    const plugin = this.plugin;
    const row = parent.createDiv({ cls: 'cc-color-row' });
    let picker = null, hexField = null, reset = null, swatch = null;
    if (editable) {
      picker = row.createEl('input', { cls: 'cc-color-swatch', type: 'color' });
    } else {
      swatch = row.createDiv({ cls: 'cc-color-swatch' });
    }
    const name = row.createDiv({ cls: 'cc-color-name' });
    name.createSpan({ text: def.label });
    name.createEl('code', { text: def.key });
    name.createSpan({ cls: 'cc-color-badge', text: 'overridden' });
    const valueEl = editable ? null : row.createDiv({ cls: 'cc-color-hex' });
    if (editable) {
      hexField = row.createEl('input', { cls: 'cc-color-hexfield', type: 'text' });
      hexField.setAttr('spellcheck', 'false');
      hexField.setAttr('maxlength', '7');
      reset = row.createEl('button', { cls: 'cc-b cc-color-reset', text: 'Reset' });
      reset.setAttr('title', 'Remove the override and fall back to your theme / Style Settings value');

      picker.oninput = () => { plugin.setColor(def.key, picker.value); this.refreshColors(); };
      const applyHex = (strict) => {
        const raw = hexField.value.trim().replace(/^#/, '');
        if (strict ? !normHex(raw) : raw.length !== 6 || !normHex(raw)) return false;
        plugin.setColor(def.key, normHex(raw));
        this.refreshColors();
        return true;
      };
      hexField.oninput = () => applyHex(false);
      hexField.onchange = () => { if (!applyHex(true)) this.refreshColors(); };
      hexField.onkeydown = (ev) => { if (ev.key === 'Enter') hexField.blur(); };
      reset.onclick = () => { plugin.resetColor(def.key); this.refreshColors(); };
    } else {
      // Copy on click, same as the banner swatches.
      valueEl.onclick = swatch.onclick = async () => {
        const hex = valueEl.getText();
        if (!normHex(hex)) return;
        try { await navigator.clipboard.writeText(hex); new Notice(`Copied ${hex}`); }
        catch (e) { new Notice(`Couldn’t copy — ${hex}`); }
      };
    }

    this._colorRefreshers.push(() => {
      const raw = this.liveColor(def.live).trim();
      const hex = cssColorToHex(raw);
      const overridden = !!plugin.settings.colors[def.key];
      row.toggleClass('is-overridden', overridden);
      if (editable) {
        const off = !!def.darkOnly && document.body.classList.contains('theme-light');
        picker.disabled = hexField.disabled = reset.disabled = off;
        row.toggleClass('is-off', off);
        row.setAttr('title', off ? 'Applies in dark mode only' : '');
        if (hex && picker.value.toUpperCase() !== hex) picker.value = hex.toLowerCase();
        if (document.activeElement !== hexField) hexField.value = hex || '';
      } else {
        swatch.style.background = raw || 'transparent';
        valueEl.setText(hex || '—');
      }
    });
  }

  async renderInbox(body) {
    // quick add
    const add = body.createDiv({ cls: 'cc-add' });
    const input = add.createEl('input', { cls: 'cc-input', attr: { type: 'text', placeholder: 'Add a task to INBOX… (Enter)' } });
    const send = async () => {
      const v = input.value.trim();
      if (v) { await this.addToInbox(v); }
    };
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') send(); });
    add.createEl('button', { cls: 'cc-b primary', text: '＋' }).onclick = send;

    // task list
    const list = body.createDiv({ cls: 'cc-inbox' });
    const tasks = await this.inboxTasks();
    if (!tasks.length) { list.createDiv({ cls: 'cc-empty', text: 'INBOX is empty 🎉' }); return; }
    for (const t of tasks) {
      const row = list.createDiv({ cls: 'cc-irow' });
      row.createDiv({ cls: 'cc-ic', text: '•' });
      row.createDiv({ cls: 'cc-title', text: t });
    }
    const open = body.createEl('button', { cls: 'cc-b', text: '📥 Open INBOX.md' });
    open.onclick = () => this.app.workspace.openLinkText(INBOX_PATH, '', false);
  }

  // ---------- WIKI TAB ----------
  //
  // WRITE BOUNDARY — the single most important decision in this whole tab.
  // The vault's collaboration rules say: "Never two sessions writing to
  // `wiki/` at once — the conflict is semantic, git won't catch it." The
  // plugin can't check whether the library compile command is running in
  // another window, so instead of faking a lock, I restrict the SCOPE: this
  // panel only ever touches a file's LOCATION and FRONTMATTER FIELDS
  // (`status`, `source-count`), never page content. That way a parallel
  // ingest can never be overwritten — the agent writes paragraphs, the plugin
  // writes metadata, collision is impossible.
  // Deletion goes to the trash (`trashFile` honors the vault's own setting),
  // never a hard delete, and needs a second click.

  // Page descriptions are pulled from `INDEX.md` instead of invented fresh:
  // it's the one place where every page has a one-sentence summary. The
  // format is enforced by SCHEMA (`- [[id]] · kind · status · source-count N
  // · description`), so we take the last segment after the middle dot.
  async wikiDescriptions() {
    const out = {};
    const f = this.app.vault.getAbstractFileByPath(WIKI_INDEX);
    if (!f || !('extension' in f)) return out;
    for (const line of (await this.app.vault.cachedRead(f)).split(/\r?\n/)) {
      const m = line.match(/^\s*-\s*\[\[([^\]|#]+)/);
      if (!m) continue;
      const parts = line.split('·');
      if (parts.length < 2) continue;
      out[m[1].trim()] = parts[parts.length - 1].replace(/\*\*/g, '').trim();
    }
    return out;
  }

  // Index of the whole wiki, built once and kept in memory. At dozens of
  // pages that's a few hundred KB of text — fits without a database or
  // embeddings (SCHEMA defers those to a much higher page count). The set's
  // signature includes paths AND modification times: mtime alone isn't
  // enough, because moving a page to a different folder doesn't change the
  // file, yet the index must rebuild — otherwise it'd still show the old folder.
  async wikiIndex() {
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(WIKI_ROOT + '/'))
      .sort((a, b) => a.path.localeCompare(b.path));
    const sig = files.map(f => `${f.path}@${f.stat.mtime}`).join('|');
    if (this._wikiIdx && this._wikiIdx.sig === sig) return this._wikiIdx;

    const descriptions = await this.wikiDescriptions();
    const rows = [];
    for (const f of files) {
      const fm = this.fm(f);
      const rest = f.path.slice(WIKI_ROOT.length + 1);
      const cut = rest.lastIndexOf('/');
      // NFC before anything else: some files arrive from macOS in NFD
      // decomposition, where an accented letter is two code points, which
      // would throw off match positions when cutting the context snippet.
      const raw = (await this.app.vault.cachedRead(f)).normalize('NFC');
      // Frontmatter is STRIPPED from the searched content. Measured on a real
      // wiki: the word "source" matched on every single page, because every
      // page has `sources:` in its frontmatter — same problem with "active",
      // "concept" or "source-count". Metadata is already in the index
      // separately (kind, status, alias), so in the body it's just noise.
      const text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
      const id = String(fm.id || f.basename);
      const alias = [].concat(fm.alias || fm.aliases || []).map(String).filter(Boolean);
      rows.push({
        f,
        path: f.path,
        name: f.basename,
        folder: cut < 0 ? WIKI_ROOT_LABEL : rest.slice(0, cut),
        id,
        kind: fm.kind ? String(fm.kind) : '',
        status: fm.status ? String(fm.status) : '',
        sourceCount: typeof fm['source-count'] === 'number' ? fm['source-count'] : null,
        // `alias` can be a plain string when the file has a single value with
        // no brackets — without flattening, `.map` would iterate characters
        // and the alias search would go silent.
        alias,
        sources: [].concat(fm.sources || []).filter(Boolean).length,
        // Computed here, not while painting: the content is already read
        // (`cachedRead` above), so this doesn't add a single extra disk read.
        todo: wikiTodos(text, fm.kind ? String(fm.kind) : ''),
        // Wikilinks to source files, not yet resolved to paths: the path is
        // only computed by `metadataCache` at paint time, because the file
        // can move, and the index lives across repaints.
        originals: [].concat(fm.originals || []).map(String)
          .map(s => (s.match(/\[\[([^\]|#]+)/) || [, s])[1].trim()).filter(Boolean),
        description: descriptions[id] || '',
        content: text,
        // Two ready-made search haystacks, computed ONCE when the index is
        // built. Normalizing this much text on every keystroke would turn typing into stutter.
        low: foldDiacritics(text).toLowerCase(),
        head: flattenHeading([f.basename, id, descriptions[id] || '', ...alias].join('   ')),
      });
    }
    this._wikiIdx = { sig, rows };
    return this._wikiIdx;
  }

  // Two match tiers. Header matches (name / id / alias / description from
  // INDEX) are certain and go to the top of the list. A content match is
  // weaker, so it gets a context snippet — without it the row doesn't explain
  // why it showed up at all.
  // `q` arrives as an object with two forms of the query, because headers and
  // body text are normalized differently — see the comment by flattenHeading().
  wikiMatch(row, q) {
    if (!q) return { rank: 0, why: '' };
    if (row.head.includes(q.head)) {
      const a = row.alias.find(x => flattenHeading(x).includes(q.head));
      const wName = flattenHeading(row.name).includes(q.head) || flattenHeading(row.id).includes(q.head);
      return { rank: wName ? 0 : 1, why: !wName && a ? `alias: "${a}"` : '' };
    }
    const i = row.low.indexOf(q.body);
    if (i < 0) return null;
    const from = Math.max(0, i - WIKI_SNIPPET);
    const to = Math.min(row.content.length, i + q.body.length + WIKI_SNIPPET);
    // The snippet is cut from `content`, not `low`: the user should see real
    // accented letters and capitalization, not the flattened version we
    // actually searched against.
    const cut = row.content.slice(from, to).replace(/\s+/g, ' ').trim();
    return { rank: 2, why: `in content: ${from > 0 ? '…' : ''}${cut}${to < row.content.length ? '…' : ''}` };
  }

  // The `log.md` chronicle. Headings have a fixed prefix `## [date] kind |
  // title` — SCHEMA enforces this format specifically so it can be parsed by
  // machine. The file is append-only with the newest entry AT THE END, so we
  // read from the tail.
  async wikiLog() {
    const f = this.app.vault.getAbstractFileByPath(WIKI_LOG);
    if (!f || !('extension' in f)) return [];
    const out = [];
    for (const line of (await this.app.vault.cachedRead(f)).split(/\r?\n/)) {
      const m = line.match(/^##\s*\[(\d{4}-\d{2}-\d{2})\]\s*([^|]+?)\s*\|\s*(.+)$/);
      if (m) out.push({ date: m[1], kind: m[2].trim(), title: m[3].trim() });
    }
    return out.slice(-WIKI_LOG_N).reverse();
  }

  // "What's happening in the Library" bar — the wiki state (below) answers
  // "what do I know", this bar answers "what's unprocessed and what changed
  // recently". Without it the source queue is invisible until /library actually runs.
  async wikiActivity(body) {
    const queue = this.app.vault.getFiles()
      .filter(f => f.path.startsWith(WIKI_INBOX + '/'))
      .sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0));
    const log = await this.wikiLog();
    const wrap = body.createDiv({ cls: 'cc-wiki-act' });

    const paintAct = () => {
      wrap.empty();
      const bar = wrap.createDiv({ cls: 'cc-wiki-act-bar' });

      const q = bar.createDiv({ cls: 'cc-wiki-act-pill' + (queue.length ? ' pending' : '') });
      q.createSpan({ cls: 'cc-wiki-act-ic', text: '📥' });
      q.createSpan({ text: queue.length ? `${queue.length} in queue` : 'queue empty' });
      if (queue.length) {
        q.createSpan({ cls: 'cc-wiki-caret', text: this.wikiQueueOpen ? '▾' : '▸' });
        q.onclick = () => { this.wikiQueueOpen = !this.wikiQueueOpen; paintAct(); };
      }

      const last = bar.createDiv({ cls: 'cc-wiki-act-pill cc-wiki-act-log' });
      last.createSpan({ cls: 'cc-wiki-act-ic', text: '🕐' });
      last.createSpan({ text: log.length ? `${log[0].date.slice(5)} · ${log[0].title}` : 'log empty' });
      last.setAttr('aria-label', 'Open log.md');
      last.onclick = () => this.app.workspace.openLinkText(WIKI_LOG, '', true);

      if (!this.wikiQueueOpen) return;
      const box = wrap.createDiv({ cls: 'cc-wiki-act-box' });
      box.createDiv({ cls: 'cc-wiki-act-h', text: 'Waiting to be compiled' });
      for (const f of queue) {
        const r = box.createDiv({ cls: 'cc-wiki-act-row' });
        r.createSpan({ cls: 'cc-wiki-act-dot', text: '•' });
        r.createSpan({ cls: 'cc-wiki-act-name', text: f.basename });
        r.createSpan({ cls: 'cc-wiki-act-when', text: moment(f.stat.mtime).format('DD.MM') });
        r.onclick = () => this.app.workspace.openLinkText(f.path, '', true);
      }
      // Deliberately NO "run ingest" button: compiling is agent work in chat,
      // not a plugin action. A button would suggest it's one click away, and
      // would drag a 10-minute block into 40 minutes of work.
      box.createDiv({ cls: 'cc-wiki-act-hint', text: 'Compile with the /library command in chat.' });

      if (log.length) {
        box.createDiv({ cls: 'cc-wiki-act-h', text: 'Recently in the log' });
        for (const l of log) {
          const r = box.createDiv({ cls: 'cc-wiki-act-row' });
          r.createSpan({ cls: 'cc-wiki-act-dot', text: '•' });
          r.createSpan({ cls: 'cc-wiki-act-name', text: l.title });
          r.createSpan({ cls: 'cc-wiki-act-when', text: `${l.kind} · ${l.date.slice(5)}` });
          r.onclick = () => this.app.workspace.openLinkText(WIKI_LOG, '', true);
        }
      }
    };
    paintAct();
  }

  async renderWiki(body) {
    await this.wikiActivity(body);
    const idx = await this.wikiIndex();
    if (!idx.rows.length) {
      body.createDiv({ cls: 'cc-empty', text: `Nothing in ${WIKI_ROOT}/ yet — run /library first.` });
      return;
    }

    // Search box. Results are repainted by a local paint(), NOT a full view
    // render(): a full render rebuilds the input and loses the cursor, so
    // typing would stop after the first letter. The query still ends up in
    // this.wikiQuery, because edit actions below call render() and need to restore it.
    const bar = body.createDiv({ cls: 'cc-wiki-bar' });
    const search = bar.createEl('input', {
      cls: 'cc-input cc-wiki-search',
      attr: { type: 'text', placeholder: 'Search the Library — name, alias, content…', value: this.wikiQuery },
    });
    const count = bar.createDiv({ cls: 'cc-wiki-count' });
    const clear = bar.createEl('button', { cls: 'cc-b cc-wiki-clear', text: '✕' });
    clear.setAttr('aria-label', 'Clear search');
    clear.onclick = () => { search.value = ''; this.wikiQuery = ''; paint(); search.focus(); };

    // Filter by `kind:` — a field every page already has. `moc` pages are
    // entry points ("start here"), so one click gets a topic catalog instead
    // of a list of concepts.
    const chips = body.createDiv({ cls: 'cc-wiki-chips' });
    const results = body.createDiv({ cls: 'cc-wiki-res' });

    const paintChips = () => {
      chips.empty();
      const mk = (id, label, n) => {
        const c = chips.createEl('button', { cls: 'cc-chipbtn' + (this.wikiType === id ? ' active' : ''), text: n == null ? label : `${label} ${n}` });
        c.onclick = () => { this.wikiType = id; paintChips(); paint(); };
      };
      mk('all', 'all', idx.rows.length);
      // Types come from the files, not a list in the code. Known ones come
      // first in a fixed order (`moc` leads, since those are topic entry
      // points), the rest alphabetically after — so a new kind invented
      // during ingestion shows up here on its own.
      const counts = new Map();
      for (const r of idx.rows) counts.set(r.kind, (counts.get(r.kind) || 0) + 1);
      const kinds = [...counts.keys()].filter(Boolean).sort((a, b) => {
        const ia = WIKI_TYPE_ORDER.indexOf(a), ib = WIKI_TYPE_ORDER.indexOf(b);
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        return a.localeCompare(b);
      });
      for (const t of kinds) mk(t, t, counts.get(t));
      if (counts.get('')) mk('_none', 'no kind', counts.get(''));
    };

    const paint = () => {
      results.empty();
      const phrase = this.wikiQuery.trim();
      // Two forms of the same phrase: `head` for names and aliases (hyphens
      // treated as spaces), `body` for content (hyphens kept, so `--cached` is still findable).
      const q = phrase ? { head: flattenHeading(phrase), body: foldDiacritics(phrase).toLowerCase() } : null;
      const hits = [];
      for (const r of idx.rows) {
        if (this.wikiType === '_none' ? r.kind : (this.wikiType !== 'all' && r.kind !== this.wikiType)) continue;
        const m = this.wikiMatch(r, q);
        if (m) hits.push({ r, ...m });
      }
      count.setText(q || this.wikiType !== 'all' ? `${hits.length} of ${idx.rows.length}` : `${idx.rows.length} pages`);

      if (!hits.length) {
        results.createDiv({ cls: 'cc-empty', text: 'Nothing matches. Try a shorter word — this also searches page content.' });
        return;
      }

      // No phrase: folders collapsed, one line per topic. This replaces the
      // sidebar file tree — a folder should say how many pages it has and
      // where to start before you even expand it.
      // With a phrase: folders expand on their own, since the result list should be visible right away.
      const groups = new Map();
      for (const h of hits) {
        if (!groups.has(h.r.folder)) groups.set(h.r.folder, []);
        groups.get(h.r.folder).push(h);
      }
      const folders = [...groups.keys()].sort((a, b) => a === WIKI_ROOT_LABEL ? 1 : b === WIKI_ROOT_LABEL ? -1 : a.localeCompare(b));

      for (const folder of folders) {
        const list = groups.get(folder).sort((a, b) => a.rank - b.rank || a.r.name.localeCompare(b.r.name));
        const open = !!q || this.wikiOpen.has(folder);
        const head = results.createDiv({ cls: 'cc-wiki-fold' + (open ? ' open' : '') });
        head.createDiv({ cls: 'cc-wiki-caret', text: open ? '▾' : '▸' });
        head.createDiv({ cls: 'cc-wiki-fname', text: folder });
        head.createDiv({ cls: 'cc-wiki-fn', text: `${list.length}` });
        // A `moc` page is the entry point to a topic — SCHEMA requires one in
        // every folder, so its absence is information in itself and should
        // show without expanding.
        const moc = list.find(h => h.r.kind === 'moc');
        if (moc) {
          const b = head.createDiv({ cls: 'cc-wiki-moc', text: `start here: ${moc.r.name}` });
          b.onclick = (ev) => { ev.stopPropagation(); this.app.workspace.openLinkText(moc.r.path, '', true); };
        } else if (folder !== WIKI_ROOT_LABEL && !q) {
          head.createDiv({ cls: 'cc-wiki-nomoc', text: 'no MOC' });
        }
        head.onclick = () => {
          if (q) return;                       // collapsing while searching would just hide results
          this.wikiOpen.has(folder) ? this.wikiOpen.delete(folder) : this.wikiOpen.add(folder);
          paint();
        };
        if (!open) continue;

        const box = results.createDiv({ cls: 'cc-wiki-list' });

        // MOC comes out of the list and sits ABOVE it. It used to sort with
        // the rest (rank → alphabetical) and land anywhere — but it's the one
        // entry point that carries nearly all the traffic through the
        // Library. Recognized by the `kind: moc` frontmatter field, never by
        // filename: filenames stay lowercase so lint and scripts don't have to touch them.
        const mocHit = list.find(h => h.r.kind === 'moc');
        const rest = list.filter(h => h.r.kind !== 'moc');
        if (mocHit) this.wikiRow(box, mocHit.r, mocHit.why, paint, idx, ' cc-wiki-row--moc');

        // With an active phrase we do NOT group: results should stay a flat,
        // ranked list. Splitting into CONTENT/TODO while searching would hide
        // matches behind a section heading — the opposite of what a search box should do.
        if (q) {
          for (const h of rest) this.wikiRow(box, h.r, h.why, paint, idx);
          continue;
        }

        const contentBox = this.wikiSub(box, folder, 'content', 'CONTENT', rest.length, paint);
        if (contentBox) {
          for (const h of rest) this.wikiRow(contentBox, h.r, h.why, paint, idx);
          const add = contentBox.createEl('button', { cls: 'cc-b cc-wiki-add', text: '＋ new draft' });
          add.onclick = () => this.wikiNewRow(contentBox, folder, add);
        }

        // The TODO section only appears when non-empty. An empty heading in
        // every folder is noise, not a feature — with seven folders, seven
        // empty sections would eat the whole screen the wiki is supposed to fit on.
        const gaps = [];
        for (const h of list) for (const t of h.r.todo) gaps.push({ t, r: h.r });
        if (gaps.length) {
          const box2 = this.wikiSub(box, folder, 'todo', 'TODO', gaps.length, paint);
          if (box2) for (const d of gaps) this.wikiTodoRow(box2, d);
        }
      }

      // SOURCES — the raw material the wiki was built from. These files are
      // NOT in the wiki index, because they aren't pages. Without this
      // section the tab only showed takeaways, and the path to the source
      // material went through the file explorer — the very thing this tab
      // was meant to replace.
      // Filtered by FILENAME ONLY: a transcript can be tens of thousands of
      // characters, so pulling these files into the content search would
      // double the index and flood results with long raw-source snippets.
      // Only under the "all" chip: sources have no `kind` field, so under a
      // kind filter their presence would imply they have that kind.
      const sources = this.wikiType !== 'all' ? [] : this.app.vault.getFiles()
        .filter(f => f.path.startsWith(WIKI_SOURCES + '/'))
        .filter(f => !q || flattenHeading(f.basename).includes(q.head));
      if (sources.length) {
        const groupsS = new Map();
        for (const f of sources) {
          const sub = f.parent && f.parent.path !== WIKI_SOURCES ? f.parent.name : WIKI_ROOT_LABEL;
          if (!groupsS.has(sub)) groupsS.set(sub, []);
          groupsS.get(sub).push(f);
        }
        // `inbox` last: it's a waiting room, not a topic. The rest alphabetically.
        const subs = [...groupsS.keys()].sort((a, b) =>
          a === 'inbox' ? 1 : b === 'inbox' ? -1 : a.localeCompare(b));
        const waiting = (groupsS.get('inbox') || []).length;

        const open = !!q || this.wikiOpen.has(WIKI_SOURCES);
        const head = results.createDiv({ cls: 'cc-wiki-fold' + (open ? ' open' : '') });
        head.createDiv({ cls: 'cc-wiki-caret', text: open ? '▾' : '▸' });
        head.createDiv({ cls: 'cc-wiki-fname', text: 'SOURCES — originals' });
        head.createDiv({ cls: 'cc-wiki-fn', text: `${sources.length}` });
        if (waiting) head.createDiv({ cls: 'cc-wiki-nomoc', text: `${waiting} unprocessed` });
        head.onclick = () => {
          if (q) return;
          this.wikiOpen.has(WIKI_SOURCES) ? this.wikiOpen.delete(WIKI_SOURCES) : this.wikiOpen.add(WIKI_SOURCES);
          paint();
        };
        if (open) {
          const box = results.createDiv({ cls: 'cc-wiki-list' });
          for (const sub of subs) {
            const files = groupsS.get(sub).sort((a, b) => a.basename.localeCompare(b.basename));
            const inner = this.wikiSub(box, WIKI_SOURCES, sub, sub, files.length, paint);
            if (!inner) continue;
            for (const f of files) {
              const w = inner.createDiv({ cls: 'cc-todo-row cc-wiki-row cc-wiki-zrodlo' });
              const main = w.createDiv({ cls: 'cc-wiki-main' });
              main.createDiv({ cls: 'cc-wiki-name', text: f.basename });
              main.createDiv({ cls: 'cc-wiki-sub', text: `${sub} · ${moment(f.stat.mtime).format('DD.MM.YYYY')}` });
              main.onclick = () => this.app.workspace.openLinkText(f.path, '', true);
            }
          }
        }
      }

      // Pages that need attention. Deliberately WITHOUT the `source-count <=
      // 1` condition from books.base: almost the whole wiki sits at
      // source-count 1 today, so that filter would spit out 50 entries and
      // the section would stop meaning anything. What's left is what's
      // genuinely unfinished.
      // Resting view only. With an active phrase this section used to append
      // pages that have nothing to do with the search — the result list
      // should show matches and nothing else.
      const attention = q ? [] : idx.rows.filter(r => !WIKI_NAV_TYPES.includes(r.kind)
        && (!r.status || r.status !== 'active' || !r.kind || !r.sources));
      if (attention.length) {
        const h = results.createDiv({ cls: 'cc-wiki-fold cc-wiki-warn open' });
        h.createDiv({ cls: 'cc-wiki-caret', text: '⚠' });
        h.createDiv({ cls: 'cc-wiki-fname', text: 'Needs attention' });
        h.createDiv({ cls: 'cc-wiki-fn', text: `${attention.length}` });
        const box = results.createDiv({ cls: 'cc-wiki-list' });
        for (const r of attention) {
          const reason = !r.kind ? 'no kind' : !r.status ? 'no status'
            : r.status !== 'active' ? r.status : 'no sources';
          this.wikiRow(box, r, reason, paint, idx);
        }
      }

      const openIdx = results.createEl('button', { cls: 'cc-b cc-wiki-foot', text: '📇 Open INDEX.md' });
      openIdx.onclick = () => this.app.workspace.openLinkText(WIKI_INDEX, '', true);
    };

    search.addEventListener('input', () => { this.wikiQuery = search.value; paint(); });
    paintChips();
    paint();
  }

  // Opens a source file from an `originals` wikilink. `openLinkText` resolves
  // the link the same way clicking it in a note body would, so it still works
  // even after the file has been moved to a different `sources/` subfolder —
  // which happens after every ingest.
  wikiOpenOriginal(link, from) {
    this.app.workspace.openLinkText(link, from, true);
  }

  // Heading for a subsection of an open folder. Returns a content container,
  // or null if the section is collapsed — so the caller doesn't need to know
  // the collapse state. Repaints via `paint`, not `render()`: a full render
  // rebuilds the search field and loses the cursor (see the comment where the bar is built above).
  wikiSub(box, folder, id, label, n, paint) {
    const key = `${folder}/${id}`;
    const open = !this.wikiSubShut.has(key);
    const head = box.createDiv({ cls: 'cc-wiki-sub-h' + (open ? ' open' : '') });
    head.createSpan({ cls: 'cc-wiki-caret', text: open ? '▾' : '▸' });
    head.createSpan({ cls: 'cc-wiki-sub-n', text: label });
    head.createSpan({ cls: 'cc-wiki-fn', text: `${n}` });
    head.onclick = () => {
      this.wikiSubShut.has(key) ? this.wikiSubShut.delete(key) : this.wikiSubShut.add(key);
      paint();
    };
    return open ? box.createDiv({ cls: 'cc-wiki-list cc-wiki-sub-box' }) : null;
  }

  // TODO row. READ-ONLY — clicking opens the file where this gap is
  // documented, and it's closed there. If it could be checked off from here,
  // the plugin would start rewriting page CONTENT, and the whole separation
  // of scope from an agent session (see WRITE BOUNDARY at the top of this
  // tab) rests on exactly it not being able to.
  wikiTodoRow(box, d) {
    const row = box.createDiv({ cls: 'cc-todo-row cc-wiki-row cc-wiki-todo' });
    const main = row.createDiv({ cls: 'cc-wiki-main' });
    main.createDiv({ cls: 'cc-wiki-todo-t', text: d.t });
    main.createDiv({ cls: 'cc-wiki-sub', text: d.r.name });
    main.onclick = () => this.app.workspace.openLinkText(d.r.path, '', true);
  }

  // One result row + a collapsible edit panel. The panel is collapsed by
  // default because density matters in the resting view: 20 pages in a
  // folder should fit on screen, not 6 pages interleaved with rows of buttons.
  wikiRow(box, r, why, paint, idx, extraCls = '') {
    const row = box.createDiv({ cls: 'cc-todo-row cc-wiki-row' + extraCls });
    const main = row.createDiv({ cls: 'cc-wiki-main' });
    main.createDiv({ cls: 'cc-wiki-name', text: r.name });
    const meta = [r.kind || 'no kind', r.status && r.status !== 'active' ? r.status : null,
                  r.sourceCount != null ? `source count ${r.sourceCount}` : null].filter(Boolean).join(' · ');
    const sub = main.createDiv({ cls: 'cc-wiki-sub' });
    if (meta) sub.createSpan({ text: meta });
    if (r.description) sub.createSpan({ text: `${meta ? ' · ' : ''}${r.description}` });
    if (why) sub.createSpan({ cls: 'cc-wiki-why', text: `${meta || r.description ? ' · ' : ''}${why}` });
    main.onclick = () => this.app.workspace.openLinkText(r.path, '', true);

    // Shortcut to the raw source. The `originals` field points at a FILE in
    // the vault, not an external address — that file is richer than the
    // outside original, since the user annotates it. A single source opens
    // right away; with several, one click would have to guess which one, so
    // we expand a list instead. The button's count says up front what to expect from clicking it.
    if (r.originals.length) {
      const many = r.originals.length > 1;
      const src = row.createEl('button', {
        cls: 'cc-b cc-wiki-src-b' + (this.wikiSrc === r.path ? ' armed' : ''),
        text: many ? `📄 ${r.originals.length}` : '📄',
      });
      src.setAttr('aria-label', many ? 'Show source files' : 'Open source file');
      src.onclick = () => {
        if (!many) { this.wikiOpenOriginal(r.originals[0], r.path); return; }
        this.wikiSrc = this.wikiSrc === r.path ? null : r.path;
        paint();
      };
    }

    const edit = row.createEl('button', { cls: 'cc-b cc-wiki-dots', text: '⋯' });
    edit.setAttr('aria-label', 'Manage page');
    edit.onclick = () => {
      this.wikiEdit = this.wikiEdit === r.path ? null : r.path;
      this.wikiKill = null;
      paint();
    };

    if (this.wikiSrc === r.path && r.originals.length > 1) {
      const list = box.createDiv({ cls: 'cc-wiki-panel cc-wiki-src' });
      for (const link of r.originals) {
        const target = this.app.metadataCache.getFirstLinkpathDest(link, r.path);
        const w = list.createDiv({ cls: 'cc-wiki-act-row' + (target ? '' : ' cc-wiki-src-dead') });
        w.createSpan({ cls: 'cc-wiki-act-dot', text: target ? '📄' : '⚠' });
        w.createSpan({ cls: 'cc-wiki-act-name', text: link });
        // A dead wikilink stays VISIBLE instead of being hidden: it's a
        // signal that the source file disappeared or was renamed, i.e. the way back to the raw material is broken.
        if (target) w.createSpan({ cls: 'cc-wiki-act-when', text: target.parent?.name || '' });
        else w.createSpan({ cls: 'cc-wiki-act-when', text: 'no file' });
        w.onclick = () => this.wikiOpenOriginal(link, r.path);
      }
    }

    if (this.wikiEdit !== r.path) return;

    const panel = box.createDiv({ cls: 'cc-wiki-panel' });

    // Moved via renameFile, not vault.rename: only the former rewrites
    // wikilinks across the whole vault. Pages are densely cross-linked, so a
    // "raw" move would leave dead links scattered across a dozen files.
    const folders = [...new Set(idx.rows.map(x => x.folder))].sort();
    const fsel = panel.createEl('select', { cls: 'cc-input cc-wiki-sel' });
    for (const f of folders) {
      const o = fsel.createEl('option', { text: f, attr: { value: f } });
      if (f === r.folder) o.selected = true;
    }
    fsel.addEventListener('change', () => this.wikiMove(r, fsel.value));

    const ssel = panel.createEl('select', { cls: 'cc-input cc-wiki-sel' });
    ssel.createEl('option', { text: '— status —', attr: { value: '' } });
    for (const s of WIKI_STATUSES) {
      const o = ssel.createEl('option', { text: s, attr: { value: s } });
      if (s === r.status) o.selected = true;
    }
    ssel.addEventListener('change', () => { if (ssel.value) this.wikiSetFm(r, 'status', ssel.value); });

    const psel = panel.createEl('input', {
      cls: 'cc-input cc-wiki-pew',
      attr: { type: 'number', min: '0', max: '9', value: r.sourceCount != null ? String(r.sourceCount) : '',
              title: 'source-count — how many sources confirm this page' },
    });
    psel.addEventListener('change', () => {
      const n = parseInt(psel.value, 10);
      if (Number.isFinite(n) && n >= 0) this.wikiSetFm(r, 'source-count', n);
    });

    // Two clicks, because this is the only action in the whole panel that
    // looks irreversible. It actually goes to the vault's trash, but the user doesn't see that at click time.
    const kill = panel.createEl('button', {
      cls: 'cc-b cc-wiki-kill' + (this.wikiKill === r.path ? ' armed' : ''),
      text: this.wikiKill === r.path ? 'sure? →' : '🗑',
    });
    kill.onclick = () => {
      if (this.wikiKill !== r.path) { this.wikiKill = r.path; paint(); return; }
      this.wikiTrash(r);
    };
  }

  // A new page created from the panel is by definition INCOMPLETE — SCHEMA
  // requires `sources:`, and the plugin doesn't know any. So it's born as a
  // `draft` with `source-count 0` and empty sources, which drops it straight
  // into "Needs attention". A deliberate trade-off: better a visible gap than a note living somewhere else.
  wikiNewRow(box, folder, addBtn) {
    addBtn.hide();
    const wrap = box.createDiv({ cls: 'cc-wiki-panel' });
    const input = wrap.createEl('input', {
      cls: 'cc-input cc-wiki-newname',
      attr: { type: 'text', placeholder: `page name in ${folder}/ … (Enter)` },
    });
    const go = async () => {
      const name = input.value.replace(FS_BAD_RE, ' ').replace(/\s+/g, ' ').trim();
      if (!name) { new Notice('Type a page name.'); return; }
      await this.wikiNew(folder, name);
    };
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
    wrap.createEl('button', { cls: 'cc-b primary', text: '＋' }).onclick = go;
    input.focus();
  }

  async wikiMove(r, folder) {
    if (folder === r.folder) return;
    const dir = folder === WIKI_ROOT_LABEL ? WIKI_ROOT : `${WIKI_ROOT}/${folder}`;
    const target = `${dir}/${r.f.name}`;
    if (this.app.vault.getAbstractFileByPath(target)) {
      new Notice(`${folder}/ already has a page with that name.`);
      return;
    }
    this.markSelfWrite();
    await this.app.fileManager.renameFile(r.f, target);
    new Notice(`${r.name} → ${folder}/`);
    this.wikiEdit = target;
    this.render();
  }

  async wikiSetFm(r, key, val) {
    this.markSelfWrite();
    await this.app.fileManager.processFrontMatter(r.f, (fm) => { fm[key] = val; });
    await this.awaitMeta(r.f);
    new Notice(`${r.name}: ${key} = ${val}`);
    this.render();
  }

  // trashFile, not vault.delete: it honors the vault's own setting (system
  // trash or `.trash/`), so a mistake is reversible. On top of that `wiki/` is
  // in git, which is a second safety net.
  async wikiTrash(r) {
    this.markSelfWrite();
    await this.app.fileManager.trashFile(r.f);
    new Notice(`${r.name} → trash. Undo via the vault's trash or git checkout.`);
    this.wikiEdit = null;
    this.wikiKill = null;
    this.render();
  }

  async wikiNew(folder, name) {
    const dir = folder === WIKI_ROOT_LABEL ? WIKI_ROOT : `${WIKI_ROOT}/${folder}`;
    const path = `${dir}/${name}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) { new Notice('A page with that name already exists.'); return; }
    this.markSelfWrite();
    const f = await this.app.vault.create(path, [
      '---',
      'kind: concept',
      `id: ${name}`,
      'alias: []',
      'status: draft',
      `date: ${moment().format('YYYY-MM-DD')}`,
      'sources: []',
      'originals: []',
      'source-count: 0',
      '---',
      '',
      `# ${name}`,
      '',
      '> [!warning] Draft created from Life OS Hub — no source',
      '> Hasn\'t gone through `/library`, so it has no `sources:` and no entry in `INDEX.md`.',
      '> Close the gap by ingesting it, or delete it — until then it sits in "Needs attention".',
      '',
    ].join('\n'));
    // We wait for metadataCache to see the frontmatter — otherwise the first
    // render after creation shows the page as "no kind" and looks like a broken template.
    await this.awaitMeta(f);
    this._wikiIdx = null;
    const leaf = this.app.workspace.getLeaf('tab'); await leaf.openFile(f); this.app.workspace.setActiveLeaf(leaf, { focus: true });
    this.render();
  }
}


// Lists the configured scripts with their exact commands, runs them in order
// on "Run all", and shows each one's output. Nothing runs until the button.
class ScriptRunModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText('Run vault scripts');
    const scripts = this.plugin.scriptList();
    const list = contentEl.createDiv({ cls: 'cc-run-list' });
    for (const e of scripts) {
      const ok = !!parseScriptCmd(e.cmd);
      const row = list.createDiv({ cls: 'cc-run-item' + (ok ? '' : ' bad') });
      row.createDiv({ cls: 'cc-run-name', text: e.name || e.cmd });
      row.createEl('code', { text: e.cmd + (ok ? '' : '   — not allowed, will be skipped') });
    }
    const go = contentEl.createEl('button', { cls: 'cc-b primary', text: 'Run all' });
    const out = contentEl.createDiv({ cls: 'cc-run-out' });
    go.onclick = async () => {
      go.disabled = true;
      out.empty();
      for (const e of scripts) {
        const sec = out.createDiv({ cls: 'cc-run-sec' });
        sec.createDiv({ cls: 'cc-run-name', text: e.name || e.cmd });
        const pre = sec.createEl('pre', { text: 'running…' });
        const r = await this.plugin.runScript(e);
        const text = [r.out, r.err, r.message].map(x => (x || '').trim()).filter(Boolean).join('\n');
        pre.setText(text || '(no output)');
        sec.createDiv({ cls: 'cc-run-meta ' + (r.code === 0 ? 'ok' : 'fail'), text: r.code === 0 ? `ok · ${(r.ms / 1000).toFixed(1)}s` : `exit ${r.code} · ${(r.ms / 1000).toFixed(1)}s` });
      }
      go.disabled = false;
      go.setText('Run again');
      if (this.onDone) this.onDone();
    };
  }
  onClose() { this.contentEl.empty(); }
}

module.exports = class LifeOsHubPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({ book: '', pdfPath: '', minutes: BOOK_MINUTES }, await this.loadData());
    this.settings.colors = this.cleanColors(this.settings.colors);
    this.settings.background = this.cleanBackground(this.settings.background);
    this.applyColorOverrides();
    this.registerView(VIEW_TYPE, (leaf) => new LifeOsHubView(leaf, this));
    // Plain click reveals the existing Hub tab (no dupes piling up). ⌘/Ctrl-click,
    // or the separate command below, forces a fresh tab — for when you deliberately
    // want two Hub tabs open side by side (e.g. Overview + Wiki).
    this.addRibbonIcon('layout-dashboard', 'Life OS Hub (⌘/Ctrl-click: new tab)',
      (evt) => this.activateView(evt.ctrlKey || evt.metaKey));
    this.addCommand({ id: 'open', name: 'Open Life OS Hub', callback: () => this.activateView() });
    this.addCommand({ id: 'open-new-tab', name: 'Open Life OS Hub (new tab)', callback: () => this.activateView(true) });
    this.addCommand({ id: 'open-status', name: 'Open Life OS Hub: Status', callback: async () => {
      await this.activateView();
      const v = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
      if (v) { v.tab = 'status'; v.render(); }
    } });
    this.addCommand({ id: 'run-scripts', name: 'Run vault scripts…', callback: () => this.openScriptRunner() });

    // "DONE" button inside the session note — see the comment by DONE_BLOCK.
    this.registerMarkdownCodeBlockProcessor(DONE_BLOCK, (src, el) => {
      const btn = el.createEl('button', { cls: 'cc-done-btn', text: '✅ DONE — save takeaway' });
      btn.onclick = async () => {
        const view = await this.bookView();
        if (view) view.stampLesson();
        else new Notice('Could not open Life OS Hub.');
      };
    });
    this.addCommand({ id: 'takeaway', name: 'Book: save takeaway', callback: async () => {
      const view = await this.bookView();
      if (view) view.stampLesson();
    } });

    // PDF tabs come and go while you work, so the timer needs to be
    // re-attached on the fly, not just once at startup.
    this.app.workspace.onLayoutReady(() => this.syncPdfTimer());
    this.registerEvent(this.app.workspace.on('layout-change', () => this.syncPdfTimer()));
    this.registerInterval(window.setInterval(() => this.paintPdfTimer(), 1000));
  }

  // Icons injected into a PDF tab's header do NOT disappear on their own when
  // the plugin unloads — the PDF view belongs to Obsidian and outlives us.
  // Without this cleanup, every reload leaves a dead timer, and after a few reloads, a row of duplicates.
  onunload() {
    document.getElementById(COLOR_STYLE_ID)?.remove();
    if (this._colorSaveTO) { clearTimeout(this._colorSaveTO); this.saveData(this.settings); }
    for (const leaf of this.app.workspace.getLeavesOfType('pdf')) {
      const v = leaf.view;
      if (!v) continue;
      for (const k of ['_ccTimerEl', '_ccNoteEl']) {
        if (v[k]) { v[k].remove(); delete v[k]; }
      }
    }
  }

  // Timer in a PDF tab's header — the user should see it right there with the
  // book, not have to jump to Life OS Hub. `addAction` is a semi-private
  // API: if it breaks, everything else (the tab timer, stamping, the bar) keeps working, since this is just a preview.
  syncPdfTimer() {
    for (const leaf of this.app.workspace.getLeavesOfType('pdf')) {
      const v = leaf.view;
      if (!v) continue;
      // `isConnected`, not just whether the marker exists: the PDF view
      // outlives a plugin reload, so afterward the marker points at an
      // element from a dead instance, and a plain `if (v._ccTimerEl)` would
      // block re-injection forever.
      if (v._ccTimerEl && v._ccTimerEl.isConnected) continue;
      try {
        const el = v.addAction('clock', 'Book timer — click: start / pause', async () => {
          const view = await this.bookView();
          if (!view) return;
          view.bookTimer.running ? view.pauseBook() : view.startBook();
          this.paintPdfTimer();
        });
        el.addClass('cc-pdf-timer');
        v._ccTimerEl = el;
        // Note alongside, without going back to Life OS Hub. `leaf` comes
        // from the loop so the split originates from THIS book, not
        // whichever PDF tab happens to be open first.
        v._ccNoteEl = v.addAction('panel-right', 'Open session note alongside', async () => {
          const view = await this.bookView();
          if (view) view.openSideNote(leaf);
        });
      } catch (e) { /* the tab header is a semi-private API — everything else survives without it */ }
    }
    this.paintPdfTimer();
  }
  paintPdfTimer() {
    const host = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const view = host && host.view;
    for (const leaf of this.app.workspace.getLeavesOfType('pdf')) {
      const el = leaf.view && leaf.view._ccTimerEl;
      if (!el) continue;
      // Life OS Hub closed = nowhere to hold timer state; show just the
      // icon instead of zero, so it doesn't look like a stopped countdown.
      if (!view || typeof view.bookRemaining !== 'function') { el.setText('📖'); continue; }
      const s = view.bookRemaining();
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      el.setText(`${view.bookTimer.running ? '⏸' : '▶'} ${mm}:${ss}`);
      el.toggleClass('is-running', !!view.bookTimer.running);
    }
  }

  // The takeaway window lives in the Life OS Hub view. When the tab is
  // closed, we create it in the side panel with `active: false` — a click in
  // the note must NOT kick the user out of the book they're reading, since
  // that's exactly the interruption this whole thing avoids.
  async bookView() {
    const open = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (open) return open.view;
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return null;
    await leaf.setViewState({ type: VIEW_TYPE, active: false });
    return leaf.view;
  }
  async setBook(book) {
    this.settings.book = book;
    await this.saveData(this.settings);
  }
  async setPdf(path) {
    this.settings.pdfPath = path;
    await this.saveData(this.settings);
  }
  async setMinutes(m) {
    this.settings.minutes = m;
    await this.saveData(this.settings);
  }
  // data.json is hand-editable, and these values end up inside a <style>
  // element — anything that isn't a known variable with a plain #RRGGBB is
  // dropped instead of being interpolated into CSS.
  cleanColors(raw) {
    const out = {};
    for (const [key, val] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
      const hex = normHex(val);
      if (ALL_COLOR_KEYS.has(key) && hex) out[key] = hex;
    }
    return out;
  }

  cleanBackground(raw) {
    const num = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
    const glows = (list) => (Array.isArray(list) ? list : []).slice(0, BG_MAX_GLOWS).flatMap(g => {
      const color = g && normHex(g.color);
      return color ? [{ x: num(g.x, 0, 100, 50), y: num(g.y, 0, 100, 50), color, alpha: num(g.alpha, 0, 100, 25), size: num(g.size, 10, 100, 55) }] : [];
    });
    const out = { dark: null, light: null };
    for (const mode of Object.keys(out)) {
      const v = raw && typeof raw === 'object' ? raw[mode] : null;
      if (!v || typeof v !== 'object') continue;
      if (v.kind === 'solid' && normHex(v.color)) {
        out[mode] = { kind: 'solid', color: normHex(v.color), glows: glows(v.glows) };
      } else if (v.kind === 'gradient' && Array.isArray(v.stops)) {
        const stops = v.stops.map(normHex).filter(Boolean).slice(0, BG_MAX_STOPS);
        const angle = Math.round(Number(v.angle));
        if (stops.length >= BG_MIN_STOPS && Number.isFinite(angle)) {
          out[mode] = { kind: 'gradient', angle: ((angle % 360) + 360) % 360, stops, glows: glows(v.glows) };
        }
      }
    }
    return out;
  }

  // The ONE managed <style> element for colours set in the Colors tab, in
  // document.head. It deliberately does not touch the Style Settings plugin's
  // data.json.
  //
  // Precedence: overrides made here win over Style Settings. Style Settings
  // writes its values on `body.css-settings-manager` and themes on
  // `.theme-dark` / `.theme-light`, both more specific than plain `body`, so
  // every declaration here is !important. Removing an override removes its
  // line, and the Style Settings (or theme) value shows through again.
  //
  // --cc-accent gets two companions, because styles.css does not derive
  // everything from it: `-override` is what light mode reads (its accent is
  // otherwise fixed, and must not start following Style Settings' value), and
  // `-rgb` feeds the translucent tints built from --g-rgb.
  applyColorOverrides() {
    const lines = [];
    const rules = [];
    for (const [key, hex] of Object.entries(this.settings.colors)) {
      lines.push(`${key}: ${hex} !important;`);
      if (key === '--cc-accent') {
        lines.push(`--cc-accent-override: ${hex} !important;`);
        lines.push(`--cc-accent-rgb: ${hexToRgb(hex).join(', ')} !important;`);
      } else if (key === '--cc-accent-dark') {
        lines.push(`--cc-accent-dark-override: ${hex} !important;`);
      }
    }
    for (const [mode, cfg] of Object.entries(this.settings.background)) {
      if (!cfg) continue;
      // `:not(#cc-color-overrides)` is only there for its id-level
      // specificity: Border's own rule for the gradient is
      // `body.theme-dark:not(.is-mobile):has(>.app-container).background-underlying-CSS-dark`
      // with !important, and a plain selector would lose to it. The id
      // belongs to this <style> element, so it never matches <body>.
      const scope = `body.theme-${mode}:not(#${COLOR_STYLE_ID})`;
      // --background-underlying only ever holds a plain colour (Border also
      // uses it as a background-color), so a gradient contributes its first stop.
      rules.push(`${scope} { --background-underlying: ${cfg.kind === 'solid' ? cfg.color : cfg.stops[0]} !important; }`);
      rules.push(`${scope}:has(>.app-container) { background: ${backgroundCss(cfg)} !important; background-blend-mode: normal !important; }`);
    }
    if (lines.length) rules.unshift(`body {\n  ${lines.join('\n  ')}\n}`);
    let el = document.getElementById(COLOR_STYLE_ID);
    if (!rules.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('style');
      el.id = COLOR_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = rules.join('\n') + '\n';
  }
  // Applied at once, saved after a short pause: the native colour picker
  // fires `input` continuously while you drag.
  _colorsChanged() {
    this.applyColorOverrides();
    clearTimeout(this._colorSaveTO);
    this._colorSaveTO = setTimeout(() => {
      this._colorSaveTO = null;
      this.saveData(this.settings);
    }, 300);
  }
  setBackground(mode, cfg) {
    this.settings.background[mode] = cfg;
    this._colorsChanged();
  }
  setColor(key, hex) { this.setColors({ [key]: hex }); }
  setColors(map) {
    for (const [key, val] of Object.entries(map)) {
      const hex = normHex(val);
      if (ALL_COLOR_KEYS.has(key) && hex) this.settings.colors[key] = hex;
    }
    this._colorsChanged();
  }
  resetColor(key) { this.resetColors([key]); }
  resetColors(keys) {
    for (const key of keys) delete this.settings.colors[key];
    this._colorsChanged();
  }
  // forceNew skips the "reuse an existing tab" lookup, so a second (or third)
  // independent Hub tab opens even while one is already sitting open elsewhere.
  // ---- script runner ------------------------------------------------------
  // Desktop only: a phone has no Node, and the manifest keeps isDesktopOnly
  // false so the rest of the Hub still works there.
  childProcess() {
    try { return Platform.isDesktopApp ? require('child_process') : null; } catch (e) { return null; }
  }
  vaultDir() {
    const a = this.app.vault.adapter;
    return a && typeof a.getBasePath === 'function' ? a.getBasePath() : null;
  }
  canRunScripts() { return !!(this.childProcess() && this.vaultDir()); }
  scriptList() {
    const s = this.settings.scripts;
    return Array.isArray(s) && s.length ? s.filter(e => e && typeof e.cmd === 'string') : DEFAULT_SCRIPTS;
  }
  // Resolves, never rejects: { code, out, err, ms, message }.
  runScript(entry) {
    const cp = this.childProcess(), cwd = this.vaultDir();
    const parsed = parseScriptCmd(entry.cmd);
    if (!cp || !cwd) return Promise.resolve({ code: 1, out: '', err: '', ms: 0, message: 'Scripts run on the desktop app only.' });
    if (!parsed) return Promise.resolve({ code: 1, out: '', err: '', ms: 0, message: 'Not allowed: only "python3 <System|Library>/<path>.py [--flags]" can run from here.' });
    const t0 = Date.now();
    return new Promise((resolve) => {
      cp.execFile(parsed.exe, parsed.args, { cwd, timeout: SCRIPT_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => resolve({
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          out: stdout || '', err: stderr || '', ms: Date.now() - t0,
          message: error ? (error.killed ? `Timed out after ${SCRIPT_TIMEOUT_MS / 1000}s.` : error.message) : '',
        }));
    });
  }
  openScriptRunner(onDone) {
    if (!this.canRunScripts()) { new Notice('Scripts run on the desktop app only.'); return; }
    new ScriptRunModal(this.app, this, onDone).open();
  }

  async activateView(forceNew = false) {
    const { workspace } = this.app;
    let leaf = forceNew ? null : workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
};
