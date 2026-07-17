#!/usr/bin/env python3
"""Build the EDITABLE AgriSchema-MY hackathon deck directly with python-pptx.

Vision-led storyline (13 slides, 16:9). Real text boxes / shapes / tables —
fully editable in Keynote & PowerPoint (NOT an image-per-slide export).

    .venv/bin/python deck/build_editable_pptx.py

Deps (already in .venv): python-pptx. Output overwrites the canonical
deliverable deck/agrischema-hackathon.pptx. The v1 image deck can still be
regenerated separately via deck/build_pptx.py + deck/index.html.

Design system (v2 polish pass): display font Avenir Next + body Helvetica Neue
(macOS system fonts); tracked-out small-caps kickers; soft drop shadows for
elevation; chevron/rail flow markers instead of block arrows; a two-panel
title slide (proof-stat panel fills the right); disciplined gold (one accent
per slide); simplified grey footer.

Honesty guardrails baked into the copy: the professor step is an "agronomic
review agent" (a competent internal fact-checker, not yet a source-verified
safety gate, not "a cache"); the generation/review LLM is named
vendor-neutrally ("agentic coding CLI + swappable LLM provider"); Layer-2
grounded review + the registration allowlist are framed as roadmap; community
sample content is labelled demo. Exact figures kept: 23 diseases / 8 crops /
654 MARDI passages; community +5 / +15; vouchers 100/500/1000 pts = RM1/5/10;
seller shipping 40 pts/slot. Every slide-2 statistic carries a named source.
"""
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls

DECK_DIR = Path(__file__).resolve().parent
PPTX_OUT = DECK_DIR / "agrischema-hackathon.pptx"

# ---- brand tokens (frontend/src/index.css) ---------------------------------
DEEP = RGBColor(0x1A, 0x6B, 0x3C)   # deep green
LIGHT = RGBColor(0x2D, 0x9E, 0x5F)  # light green
GOLD = RGBColor(0xE8, 0xB8, 0x4B)   # gold
PAPER = RGBColor(0xF6, 0xF7, 0xF3)  # warm paper
INK = RGBColor(0x1C, 0x23, 0x1F)    # ink
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor(0x5F, 0x6B, 0x63)
BORDER = RGBColor(0xCF, 0xD8, 0xD0)
TINT = RGBColor(0xE9, 0xF1, 0xEC)     # soft green card
GOLDTINT = RGBColor(0xFB, 0xF3, 0xDD)  # soft gold card
DEEPTINT = RGBColor(0xDE, 0xEC, 0xE3)
MIST = RGBColor(0xCF, 0xE0, 0xD5)     # muted green (reversed captions)

FONT_DISPLAY = "Avenir Next"      # headings / kickers / big numbers (macOS)
FONT_BODY = "Helvetica Neue"      # body / labels / sources (macOS)

# 16:9
SLIDE_W, SLIDE_H = 13.333, 7.5
MARGIN = 0.6
CONTENT_W = SLIDE_W - 2 * MARGIN  # 12.133
GUTTER = 0.30                     # one gutter deck-wide
CONTENT_TOP = 2.15                # one content-start line
TITLE_SIZE = 24                   # one title size deck-wide

# slide-2 sources (from web research; NAP 2.0 / DOSM / KPKM)
SLIDE2_SOURCES = (
    "Sources: KPKM (Ministry of Agriculture & Food Security) 2023/2024 · "
    "Department of Statistics Malaysia (DOSM) 2023 · National Agrofood Policy "
    "2.0 (NAP 2.0, 2021\u20132030), KPKM/FAOLEX."
)


def In(v):
    return Inches(v)


# ---- text primitives --------------------------------------------------------
def _track(run, pts):
    """Set letter-spacing (tracking) in points via raw XML (no python-pptx API)."""
    if not pts:
        return
    rPr = run.font._rPr
    if rPr is not None:
        rPr.set("spc", str(int(pts * 100)))  # spc unit = 1/100 pt


def txbox(slide, l, t, w, h, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(In(l), In(t), In(w), In(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = In(0.06)
    tf.margin_right = In(0.06)
    tf.margin_top = In(0.02)
    tf.margin_bottom = In(0.02)
    return tf


def para(tf, text, size, color, bold=False, italic=False,
         align=PP_ALIGN.LEFT, first=False, space_after=6, space_before=0,
         line=1.05, font=None, tracking=0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(space_after)
    p.space_before = Pt(space_before)
    try:
        p.line_spacing = line
    except Exception:
        pass
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    r.font.name = font or FONT_BODY
    _track(r, tracking)
    return p


def runs(p, items, font=None):
    """Append several styled runs to an existing paragraph.
    items: list of (text, size, color, bold)."""
    for text, size, color, bold in items:
        r = p.add_run()
        r.text = text
        r.font.size = Pt(size)
        r.font.color.rgb = color
        r.font.bold = bold
        r.font.name = font or FONT_BODY


# ---- shape primitives -------------------------------------------------------
def _shadow(shape, blur=0.085, dist=0.035, alpha=76):
    """Attach a soft outer drop-shadow (down direction) via raw XML."""
    spPr = shape._element.spPr
    xml = (
        '<a:effectLst %s>'
        '<a:outerShdw blurRad="%d" dist="%d" dir="5400000" rotWithShape="0">'
        '<a:srgbClr val="1C231F"><a:alpha val="%d000"/></a:srgbClr>'
        '</a:outerShdw></a:effectLst>'
    ) % (nsdecls("a"), int(blur * 914400), int(dist * 914400), alpha)
    spPr.append(parse_xml(xml))


def card(slide, l, t, w, h, fill, line=None, radius=0.055, line_w=1.0,
         shadow=True):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                 In(l), In(t), In(w), In(h))
    try:
        shp.adjustments[0] = radius
    except Exception:
        pass
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    if line is not None:
        shp.line.color.rgb = line
        shp.line.width = Pt(line_w)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    if shadow:
        _shadow(shp)
    return shp


def rect(slide, l, t, w, h, fill):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                 In(l), In(t), In(w), In(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def chevron(slide, cx, cy, color=DEEP, size=24):
    """A thin flow arrow glyph centred at (cx, cy) — replaces block arrows."""
    tf = txbox(slide, cx - 0.35, cy - 0.32, 0.70, 0.64,
               anchor=MSO_ANCHOR.MIDDLE)
    para(tf, "\u2192", size, color, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=0, font=FONT_DISPLAY)


# ---- slide scaffolding ------------------------------------------------------
def new_slide(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = PAPER
    return slide


def title_block(slide, kicker, title):
    tf = txbox(slide, MARGIN, 0.42, CONTENT_W, 0.30)
    para(tf, kicker.upper(), 10.5, GOLD, bold=True, first=True, space_after=0,
         font=FONT_DISPLAY, tracking=1.4)
    rect(slide, MARGIN, 0.76, 0.55, 0.035, GOLD)   # repeated motif rule
    tf2 = txbox(slide, MARGIN, 0.86, CONTENT_W, 1.05)
    para(tf2, title, TITLE_SIZE, DEEP, bold=True, first=True, space_after=0,
         line=1.03, font=FONT_DISPLAY)


def footer(slide, n):
    rect(slide, MARGIN, 7.04, CONTENT_W, 0.012, BORDER)
    tf = txbox(slide, MARGIN, 7.09, 6.0, 0.3)
    para(tf, "AgriSchema-MY", 9, GRAY, first=True, space_after=0,
         font=FONT_DISPLAY, tracking=0.6)
    tfp = txbox(slide, SLIDE_W - MARGIN - 1.4, 7.09, 1.4, 0.3)
    para(tfp, f"{n:02d} / 13", 9, GRAY, align=PP_ALIGN.RIGHT, first=True,
         space_after=0, font=FONT_DISPLAY, tracking=0.6)


def bullet(tf, text, size=14, color=INK, bold_lead=None, first=False,
           space_after=9, dot=GOLD):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.space_after = Pt(space_after)
    p.line_spacing = 1.18
    d = p.add_run()
    d.text = "\u2014  "
    d.font.size = Pt(size)
    d.font.color.rgb = dot
    d.font.bold = True
    d.font.name = FONT_DISPLAY
    if bold_lead:
        r = p.add_run()
        r.text = bold_lead
        r.font.size = Pt(size)
        r.font.bold = True
        r.font.color.rgb = DEEP
        r.font.name = FONT_DISPLAY
    r2 = p.add_run()
    r2.text = text
    r2.font.size = Pt(size)
    r2.font.color.rgb = color
    r2.font.name = FONT_BODY
    return p


# ---- diagram node -----------------------------------------------------------
def node(slide, l, t, w, h, title, sub, fill=TINT, border=DEEP,
         border_w=1.25, title_color=DEEP, sub_color=INK):
    shp = card(slide, l, t, w, h, fill, line=border, radius=0.09,
               line_w=border_w)
    tf = shp.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = In(0.10)
    tf.margin_right = In(0.10)
    tf.margin_top = In(0.06)
    tf.margin_bottom = In(0.06)
    para(tf, title, 13, title_color, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=3, line=1.0, font=FONT_DISPLAY)
    para(tf, sub, 9.5, sub_color, align=PP_ALIGN.CENTER, space_after=0,
         line=1.04)
    return shp


# =========================================================================
# Slides
# =========================================================================
def slide1_title(prs):
    s = new_slide(prs)
    # left spine
    rect(s, 0, 0, 0.26, SLIDE_H, DEEP)
    rect(s, 0.26, 0, 0.07, SLIDE_H, GOLD)

    # right proof panel fills the former void
    px = 8.85
    rect(s, px, 0, SLIDE_W - px, SLIDE_H, DEEP)
    rect(s, px, 0, SLIDE_W - px, 0.10, GOLD)
    tf = txbox(s, px + 0.45, 1.15, SLIDE_W - px - 0.7, 0.4)
    para(tf, "VERIFIED KNOWLEDGE BASE", 11, GOLD, bold=True, first=True,
         space_after=0, font=FONT_DISPLAY, tracking=1.2)
    proof = [("23", "verified disease entries"),
             ("8", "Malaysian crops"),
             ("654", "MARDI source passages")]
    y = 2.0
    for num, label in proof:
        tf = txbox(s, px + 0.45, y, SLIDE_W - px - 0.7, 1.3)
        para(tf, num, 46, GOLD, bold=True, first=True, space_after=0,
             font=FONT_DISPLAY, line=1.0)
        para(tf, label, 13, WHITE, space_after=0, font=FONT_BODY)
        y += 1.45

    # left composition (single optical unit, no voids)
    lx = MARGIN + 0.25
    lw = px - lx - 0.5
    tf = txbox(s, lx, 0.85, lw, 0.4)
    para(tf, "TOURISM, CULTURE & LOCAL ECONOMY  \u00b7  HACKATHON 2026", 11.5,
         GOLD, bold=True, first=True, space_after=0, font=FONT_DISPLAY,
         tracking=1.0)

    tf = txbox(s, lx, 2.15, lw, 1.2)
    para(tf, "AgriSchema-MY", 52, DEEP, bold=True, first=True, space_after=0,
         font=FONT_DISPLAY)

    tf = txbox(s, lx, 3.45, lw, 1.1)
    para(tf, "Trustworthy knowledge exchange that lifts Malaysia's harvest "
             "to export grade.", 20, INK, first=True, space_after=0,
         line=1.14, font=FONT_BODY)

    rect(s, lx, 5.15, 0.55, 0.035, GOLD)
    tf = txbox(s, lx, 5.35, lw, 1.5)
    para(tf, "TEAM", 10.5, GRAY, bold=True, first=True, space_after=6,
         font=FONT_DISPLAY, tracking=1.4)
    for name, role in [("Tan Kuan Yu", "Lead / Data & Pipeline"),
                       ("Lee Hui Ying", "Analytics Dashboard, Image ML"),
                       ("Tan Chi Kien", "Agronomy Research")]:
        p = tf.add_paragraph()
        p.line_spacing = 1.28
        runs(p, [(name, 14, DEEP, True),
                 ("   \u00b7   " + role, 13, INK, False)],
             font=FONT_BODY)
    # no footer on the title slide


def slide2_vision(prs):
    s = new_slide(prs)
    title_block(s, "Malaysia's 2026 agriculture vision & local economy",
                "Malaysia is betting big on agrofood \u2014 yet still imports "
                "far more food than it exports")

    stats = [
        ("RM181.4 bil", "Agrofood sector value, 2023 (+4.3% YoY)",
         "KPKM, 2024", LIGHT),
        ("~7.8% of GDP", "Agriculture's share of national GDP, 2023",
         "DOSM, 2023", LIGHT),
        ("RM78.8 bil", "National food import bill, 2023",
         "DOSM, 2023", LIGHT),
        ("\u2212RM32 bil", "Food trade deficit \u2014 imports RM78.8b vs "
         "exports RM46.5b, 2023", "DOSM, 2023", GOLD),   # the tension = gold
        ("56.2%", "Rice self-sufficiency ratio, 2023 (new basis)",
         "KPKM, 2024", LIGHT),
        ("6 \u00b7 21 \u00b7 77", "NAP 2.0 objectives \u00b7 strategies "
         "\u00b7 action plans, 2021\u201330", "NAP 2.0, KPKM", LIGHT),
    ]
    cols = 3
    cw = (CONTENT_W - (cols - 1) * GUTTER) / cols
    ch = 1.78
    y0, ygap = CONTENT_TOP, 0.24
    for i, (num, label, src, accent) in enumerate(stats):
        r, c = divmod(i, cols)
        x = MARGIN + c * (cw + GUTTER)
        y = y0 + r * (ch + ygap)
        card(s, x, y, cw, ch, WHITE, radius=0.06)
        rect(s, x + 0.001, y + 0.28, 0.09, ch - 0.56, accent)
        tf = txbox(s, x + 0.28, y + 0.18, cw - 0.42, ch - 0.3)
        para(tf, num, 27, DEEP, bold=True, first=True, space_after=4,
             font=FONT_DISPLAY)
        para(tf, label, 13, INK, space_after=6, line=1.08)
        para(tf, src, 9.5, GRAY, italic=True, space_after=0, font=FONT_BODY)

    tf = txbox(s, MARGIN, 6.60, CONTENT_W, 0.38)
    para(tf, SLIDE2_SOURCES, 8.5, GRAY, italic=True, first=True,
         space_after=0, line=1.08, font=FONT_BODY)
    footer(s, 2)


def slide3_problem(prs):
    s = new_slide(prs)
    title_block(s, "The problem",
                "Smallholders get pesticide dosages from generic AI \u2014 "
                "shown as \u201cverified\u201d when they are only estimates")

    lf = txbox(s, MARGIN, CONTENT_TOP + 0.1, 6.5, 3.6)
    bullet(lf, "ask ChatGPT, Google or forums how to treat a crop disease.",
           bold_lead="Smallholders and extension officers ", first=True,
           space_after=13)
    bullet(lf, "and pre-harvest intervals (PHI) are presented as fact \u2014 "
               "but are unverified guesses.",
           bold_lead="Pesticide dosages ", space_after=13)
    bullet(lf, "illegal MRL residues \u2192 rejected or destroyed crops "
               "\u2192 farmer-safety and legal risk.",
           bold_lead="Wrong dose or PHI \u2192 ", space_after=13)
    bullet(lf, "no way to tell a verified label from a confident guess.",
           bold_lead="The farmer has ", space_after=0)

    card(s, 7.55, CONTENT_TOP + 0.1, 5.18, 3.75, GOLDTINT)
    tf = txbox(s, 7.8, CONTENT_TOP + 0.32, 4.7, 0.4)
    para(tf, "WHO WE SERVE", 11, DEEP, bold=True, first=True, space_after=8,
         font=FONT_DISPLAY, tracking=1.2)
    crops = ["Padi", "Chilli", "Tomato", "Banana", "Durian", "Cocoa",
             "Oil palm"]
    cw, cch, gap = 1.42, 0.5, 0.14
    x0, y0 = 7.8, CONTENT_TOP + 0.85
    for i, cr in enumerate(crops):
        r, c = divmod(i, 3)
        x = x0 + c * (cw + gap)
        y = y0 + r * (cch + gap)
        chip = card(s, x, y, cw, cch, WHITE, radius=0.28, shadow=False)
        chip.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(chip.text_frame, cr, 12, DEEP, bold=True, first=True,
             align=PP_ALIGN.CENTER, space_after=0, font=FONT_DISPLAY)
    tf = txbox(s, 7.8, y0 + 2 * (cch + gap) + 0.1, 4.7, 1.0)
    para(tf, "\u2026 smallholder farmers of these crops,", 13, INK,
         first=True, space_after=3)
    p = tf.add_paragraph()
    p.line_spacing = 1.12
    runs(p, [("plus ", 13, INK, False),
             ("agricultural extension officers", 13, DEEP, True),
             (" who advise them.", 13, INK, False)])
    footer(s, 3)


def slide4_objective(prs):
    s = new_slide(prs)
    title_block(s, "Our objective",
                "Enable trustworthy knowledge exchange between farmers \u2014 "
                "so quality, and the local economy, rise")

    band = card(s, MARGIN, CONTENT_TOP, CONTENT_W, 1.1, DEEP, radius=0.055)
    band.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    para(band.text_frame, "Trustworthy knowledge exchange between farmers  "
         "\u2192  better crop quality  \u2192  stronger local economy & "
         "agri-exports.", 19, WHITE, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=0, line=1.1, font=FONT_DISPLAY)

    pillars = [
        ("Trustworthy", "Every claim is labelled verified vs estimate; a "
         "fail-closed review gate means REJECT never ships to a farmer."),
        ("Exchange", "Farmers and extension officers share what works \u2014 "
         "an AI knowledge base plus a human Q&A community, both grounded."),
        ("Local economy", "Higher, safer quality lifts rural income and "
         "export earnings \u2014 the Local Economy track, made concrete."),
    ]
    cw = (CONTENT_W - 2 * GUTTER) / 3
    for i, (h, body) in enumerate(pillars):
        x = MARGIN + i * (cw + GUTTER)
        y = CONTENT_TOP + 1.45
        card(s, x, y, cw, 2.35, WHITE, radius=0.055)
        rect(s, x + 0.001, y + 0.001, cw - 0.002, 0.11, GOLD)
        tf = txbox(s, x + 0.24, y + 0.34, cw - 0.46, 1.9)
        para(tf, h, 18, DEEP, bold=True, first=True, space_after=9,
             font=FONT_DISPLAY)
        para(tf, body, 13.5, INK, space_after=0, line=1.2)
    footer(s, 4)


def slide5_capture(prs):
    s = new_slide(prs)
    title_block(s, "How we capture knowledge \u2014 the research & scraper "
                "agents",
                "Automated agents turn authoritative MARDI sources into "
                "structured, machine-readable disease entries")

    steps = [
        ("1  MARDI scraper", "Crawls MARDI bulletin pages and downloads "
         "source PDFs of crop-disease guidance."),
        ("2  Seed generator", "Structures findings into consistent YAML "
         "disease entries (crop, pathogen, treatments)."),
        ("3  PDF extractor", "Parses downloaded PDFs \u2192 extracts text "
         "\u2192 fills structured fields per entry."),
    ]
    cw = (CONTENT_W - 2 * GUTTER) / 3
    y = CONTENT_TOP + 0.15
    ch = 2.15
    for i, (h, body) in enumerate(steps):
        x = MARGIN + i * (cw + GUTTER)
        card(s, x, y, cw, ch, TINT, radius=0.06)
        tf = txbox(s, x + 0.22, y + 0.28, cw - 0.44, ch - 0.4)
        para(tf, h, 16, DEEP, bold=True, first=True, space_after=10,
             font=FONT_DISPLAY)
        para(tf, body, 13.5, INK, space_after=0, line=1.2)
        if i < 2:
            chevron(s, x + cw + GUTTER / 2, y + ch / 2)

    note = card(s, MARGIN, y + ch + 0.35, CONTENT_W, 1.35, GOLDTINT,
                radius=0.05)
    tf = note.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = In(0.28)
    tf.margin_right = In(0.28)
    p = para(tf, "", 13.5, INK, first=True, space_after=5)
    runs(p, [("Vendor-neutral engine:  ", 14, DEEP, True),
             ("generation and review agents run via an ", 13.5, INK, False),
             ("agentic coding CLI + a swappable LLM provider", 13.5, DEEP,
              True), (" \u2014 no vendor lock-in.", 13.5, INK, False)],
         font=FONT_BODY)
    para(tf, "Optional DOA / MYMRL registry crawlers extend coverage when "
             "authoritative data is available.", 12, GRAY, space_after=0)
    footer(s, 5)


def slide6_reviewgate(prs):
    s = new_slide(prs)
    title_block(s, "The review gate \u2014 our quality guarantee",
                "Every claim passes a fail-closed review gate \u2014 REJECT "
                "never ships")

    # Layer 1
    c1w = (CONTENT_W - GUTTER) / 2
    card(s, MARGIN, CONTENT_TOP, c1w, 2.95, WHITE, radius=0.05)
    rect(s, MARGIN + 0.001, CONTENT_TOP + 0.001, c1w - 0.002, 0.5, DEEP)
    tf = txbox(s, MARGIN + 0.22, CONTENT_TOP + 0.08, c1w - 0.4, 0.4)
    para(tf, "LAYER 1 \u00b7 COMPLIANCE  (deterministic, fail-closed)", 12.5,
         WHITE, bold=True, first=True, space_after=0, font=FONT_DISPLAY,
         tracking=0.4)
    tf = txbox(s, MARGIN + 0.22, CONTENT_TOP + 0.68, c1w - 0.44, 2.2)
    bullet(tf, "banned-pesticide denylist \u2192 hard block.",
           bold_lead="REJECT: ", first=True, space_after=10, dot=GOLD)
    bullet(tf, "restricted use, missing PHI, or missing fields.",
           bold_lead="FLAG: ", space_after=10, dot=GOLD)
    bullet(tf, "registration allowlist check is built but disabled until "
               "authoritative DOA data is supplied.",
           bold_lead="Roadmap: ", space_after=0, dot=GRAY)

    # Layer 2 (agronomic review agent)
    x2 = MARGIN + c1w + GUTTER
    card(s, x2, CONTENT_TOP, c1w, 2.95, WHITE, radius=0.05)
    rect(s, x2 + 0.001, CONTENT_TOP + 0.001, c1w - 0.002, 0.5, LIGHT)
    tf = txbox(s, x2 + 0.22, CONTENT_TOP + 0.08, c1w - 0.4, 0.4)
    para(tf, "AGRONOMIC REVIEW AGENT  (LLM reviewer)", 12.5, WHITE, bold=True,
         first=True, space_after=0, font=FONT_DISPLAY, tracking=0.4)
    tf = txbox(s, x2 + 0.22, CONTENT_TOP + 0.68, c1w - 0.44, 2.2)
    bullet(tf, "grades each entry PASS / FLAG / REJECT.",
           bold_lead="Verdict: ", first=True, space_after=10, dot=LIGHT)
    bullet(tf, "a competent internal fact-checker \u2014 not yet a "
               "source-verified safety gate.",
           bold_lead="Honest framing: ", space_after=10, dot=LIGHT)
    bullet(tf, "verdicts feed the admin Review-Queue UI for human oversight.",
           bold_lead="Oversight: ", space_after=0, dot=LIGHT)

    # verified-vs-estimate + REJECT invariant (the one punchline = gold)
    band = card(s, MARGIN, CONTENT_TOP + 3.25, CONTENT_W, 1.05, DEEP,
                radius=0.05)
    band.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = para(band.text_frame, "", 15, WHITE, first=True, space_after=0,
             align=PP_ALIGN.CENTER)
    runs(p, [("Every claim is marked ", 15, WHITE, False),
             ("verified vs estimate", 15, GOLD, True),
             ("   \u00b7   REJECT entries are never embedded and never reach "
              "a farmer.", 15, WHITE, False)], font=FONT_DISPLAY)
    footer(s, 6)


def slide7_architecture(prs):
    s = new_slide(prs)
    title_block(s, "Architecture & end-to-end flow",
                "Source \u2192 review \u2192 publish \u2192 serve: search "
                "works even with zero LLM or API keys")

    stages = [
        ("Sources", "MARDI bulletins & PDFs\n(+ optional DOA / MYMRL)", TINT,
         DEEP),
        ("Capture agents", "Scrape \u00b7 Seed \u00b7 Extract\n\u2192 YAML "
         "entries", TINT, DEEP),
        ("Review gate", "Compliance (fail-closed)\n+ agronomic review\n"
         "REJECT blocked", GOLDTINT, GOLD),
        ("ChromaDB", "2 collections\nlocal all-MiniLM\nfree, no key", TINT,
         DEEP),
        ("API", "/query \u00b7 /ask\n/diagnose", DEEPTINT, DEEP),
    ]
    n = len(stages)
    gap = 0.34
    bw = (CONTENT_W - gap * (n - 1)) / n
    bh = 1.65
    y = CONTENT_TOP + 0.45
    cy = y + bh / 2
    # process rail behind the nodes
    rect(s, MARGIN + bw / 2, cy - 0.015, CONTENT_W - bw, 0.03, BORDER)
    for i, (title, sub, fill, border) in enumerate(stages):
        x = MARGIN + i * (bw + gap)
        node(s, x, y, bw, bh, title, sub, fill=fill, border=border,
             border_w=1.5)
        if i < n - 1:
            chevron(s, x + bw + gap / 2, cy, size=20)

    tf = txbox(s, MARGIN, CONTENT_TOP + 2.4, CONTENT_W, 0.5)
    p = para(tf, "", 13.5, INK, first=True, space_after=0)
    runs(p, [("Stack:  ", 13.5, DEEP, True),
             ("FastAPI  \u00b7  React + Vite  \u00b7  agentic coding CLI + "
              "swappable LLM provider  \u00b7  ChromaDB (local embeddings).",
              13.5, INK, False)], font=FONT_BODY)

    g = card(s, MARGIN, CONTENT_TOP + 3.0, CONTENT_W, 0.95, DEEPTINT,
             radius=0.05)
    g.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = para(g.text_frame, "", 13.5, INK, first=True, space_after=0,
             align=PP_ALIGN.CENTER)
    runs(p, [("Graceful degradation:  ", 14, DEEP, True),
             ("vector search runs with no LLM and no API keys \u2014 the "
              "core product is always free, offline-capable, and can't be "
              "broken by a model outage.", 13.5, INK, False)],
         font=FONT_BODY)
    footer(s, 7)


def slide8_product(prs):
    s = new_slide(prs)
    title_block(s, "Product \u2014 the farmer experience",
                "Photo + text diagnosis grounded in verified sources \u2014 "
                "the AI describes, the KB diagnoses")

    steps = [
        ("Vision DESCRIBES", "/diagnose reads a photo, describes symptoms and "
         "guesses the crop \u2014 it never names the disease itself."),
        ("KB DIAGNOSES", "Verified knowledge-base retrieval matches symptoms "
         "to reviewed entries \u2014 the actual diagnosis is grounded."),
        ("LLM SUMMARISES", "/ask summarises only the retrieved source cards "
         "(\u201cONLY SOURCES\u201d) \u2014 it cannot invent treatments."),
    ]
    cw = (CONTENT_W - 2 * GUTTER) / 3
    y = CONTENT_TOP + 0.15
    ch = 2.45
    for i, (h, body) in enumerate(steps):
        x = MARGIN + i * (cw + GUTTER)
        card(s, x, y, cw, ch, WHITE, radius=0.055)
        rect(s, x + 0.001, y + 0.001, cw - 0.002, 0.55, DEEP)
        htf = txbox(s, x + 0.05, y + 0.11, cw - 0.1, 0.4)
        para(htf, h, 14.5, WHITE, bold=True, first=True, align=PP_ALIGN.CENTER,
             space_after=0, font=FONT_DISPLAY, tracking=0.5)
        tf = txbox(s, x + 0.22, y + 0.78, cw - 0.44, ch - 0.9)
        para(tf, body, 13.5, INK, first=True, space_after=0, line=1.2)
        if i < 2:
            chevron(s, x + cw + GUTTER / 2, y + ch / 2)

    band = card(s, MARGIN, y + ch + 0.32, CONTENT_W, 1.02, GOLDTINT,
                radius=0.05)
    band.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = para(band.text_frame, "", 14, INK, first=True, space_after=0,
             align=PP_ALIGN.CENTER)
    runs(p, [("Honest by construction:  ", 14.5, DEEP, True),
             ("because the AI can only surface reviewed, verified sources, "
              "it cannot hallucinate an unsafe dose.", 14, INK, False)],
         font=FONT_BODY)
    footer(s, 8)


def slide9_community(prs):
    s = new_slide(prs)
    title_block(s, "Community \u2014 the knowledge-exchange engine",
                "Farmers & extension officers answer each other \u2014 and "
                "earn Agri Points for it")

    # left: rewards
    card(s, MARGIN, CONTENT_TOP, 6.0, 3.85, WHITE, radius=0.055)
    tf = txbox(s, MARGIN + 0.25, CONTENT_TOP + 0.22, 5.5, 0.4)
    para(tf, "HOW REPUTATION IS EARNED", 11, DEEP, bold=True, first=True,
         space_after=0, font=FONT_DISPLAY, tracking=1.2)
    rows = [("Post an answer", "+5 pts", LIGHT),
            ("Answer gets accepted", "+15 pts", DEEP),
            ("Ask a question / upvotes", "0 pts", GRAY)]
    y = CONTENT_TOP + 0.72
    for label, val, col in rows:
        cd = card(s, MARGIN + 0.25, y, 5.5, 0.6, TINT, radius=0.1,
                  shadow=False)
        cd.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        cd.text_frame.margin_left = In(0.18)
        para(cd.text_frame, label, 13.5, INK, first=True, space_after=0)
        vb = txbox(s, MARGIN + 0.25 + 3.55, y, 1.75, 0.6,
                   anchor=MSO_ANCHOR.MIDDLE)
        para(vb, val, 17, col, bold=True, align=PP_ALIGN.RIGHT, first=True,
             space_after=0, font=FONT_DISPLAY)
        y += 0.72
    tf = txbox(s, MARGIN + 0.25, y + 0.04, 5.5, 0.5)
    para(tf, "5 reputation levels: Seedling \u2192 Community Champion.", 13.5,
         DEEP, bold=True, first=True, space_after=0, font=FONT_DISPLAY)

    # right: why it matters
    card(s, 7.0, CONTENT_TOP, 5.73, 3.85, DEEPTINT, radius=0.055)
    tf = txbox(s, 7.25, CONTENT_TOP + 0.25, 5.25, 3.4)
    para(tf, "THE HUMAN LAYER", 11, DEEP, bold=True, first=True,
         space_after=11, font=FONT_DISPLAY, tracking=1.2)
    bullet(tf, "local, practical know-how the AI knowledge base can't "
               "capture alone.", bold_lead="Peer exchange surfaces ",
           space_after=13)
    bullet(tf, "answer well, build reputation, and gain visibility across "
               "the platform.", bold_lead="Contributors ", space_after=13)
    bullet(tf, "points become spendable value \u2014 the bridge into the "
               "marketplace (next).", bold_lead="Earned ", space_after=13)
    para(tf, "Seeded questions & ledger lines are demo data; the earn "
             "mechanics are fully real (localStorage wallet).", 11, GRAY,
         italic=True, space_after=0, line=1.12)
    footer(s, 9)


def slide10_funnel(prs):
    s = new_slide(prs)
    title_block(s, "Marketplace + the acquisition funnel",
                "Knowledge exchange acquires, vouchers retain, the "
                "marketplace monetizes")

    steps = [
        ("Answer Q&A", "+5 pts \u00b7 accepted +15"),
        ("Earn points\n+ reputation", "5 levels \u00b7 exposure"),
        ("Redeem vouchers", "RM1/5/10 =\n100/500/1000 pts"),
        ("Spend in\nMarketplace", "voucher = checkout\ndiscount"),
        ("Sellers sponsor\nshipping", "40 pts / slot \u2192\nmore buyers"),
    ]
    n = len(steps)
    gap = 0.30
    bw = (CONTENT_W - gap * (n - 1)) / n
    bh = 1.5
    y = CONTENT_TOP + 0.35
    cy = y + bh / 2
    rect(s, MARGIN + bw / 2, cy - 0.015, CONTENT_W - bw, 0.03, BORDER)
    for i, (title, sub) in enumerate(steps):
        x = MARGIN + i * (bw + gap)
        gold_node = (i == 2)   # the monetization payoff = the one gold node
        node(s, x, y, bw, bh, title, sub,
             fill=GOLDTINT if gold_node else TINT,
             border=GOLD if gold_node else DEEP, border_w=1.5)
        if i < n - 1:
            chevron(s, x + bw + gap / 2, cy, size=20)

    loop = card(s, MARGIN, CONTENT_TOP + 2.35, CONTENT_W, 0.62, DEEP,
                radius=0.1)
    loop.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    para(loop.text_frame, "\u21ba  Closed loop  \u2014  vouchers are spendable "
         "ONLY in the Marketplace:  engagement \u2192 retention \u2192 "
         "local-economy monetization", 13.5, WHITE, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=0, font=FONT_DISPLAY)

    tf = txbox(s, MARGIN, CONTENT_TOP + 3.2, CONTENT_W, 0.8)
    para(tf, "The knowledge exchange is the acquisition engine  \u00b7  "
             "vouchers are retention  \u00b7  the marketplace is "
             "monetization \u2014 all mechanics are real; sample listings are "
             "demo data.", 13.5, INK, first=True, space_after=0,
         align=PP_ALIGN.CENTER, line=1.15)
    footer(s, 10)


def slide11_impact(prs):
    s = new_slide(prs)
    title_block(s, "Why it matters \u2014 impact",
                "Verified knowledge exchange \u2192 export-grade quality "
                "\u2192 rural income & agri-exports rise")

    cards = [
        ("Serves the 2026 vision", "Directly answers NAP 2.0 goals: raise "
         "quality & productivity, grow agrofood exports, cut import "
         "dependence, empower smallholders.", LIGHT),
        ("Trust by alignment", "Content is structured for DOA / MARDI "
         "alignment and labelled verified vs estimate \u2014 safe to act on "
         "in the field.", LIGHT),
        ("Scales without retraining", "New verified entries are ingested and "
         "embedded locally \u2014 no model retraining, no API cost to grow "
         "coverage. The moat vs generic AI.", LIGHT),
        ("Local Economy, made real", "Higher, safer quality lifts rural "
         "livelihoods and export earnings \u2014 the track's goal, delivered "
         "on the ground.", GOLD),   # the track punchline = the one gold card
    ]
    cw = (CONTENT_W - GUTTER) / 2
    ch = 1.9
    for i, (h, body, accent) in enumerate(cards):
        r, c = divmod(i, 2)
        x = MARGIN + c * (cw + GUTTER)
        y = CONTENT_TOP + r * (ch + 0.3)
        card(s, x, y, cw, ch, WHITE, radius=0.055)
        rect(s, x + 0.001, y + 0.28, 0.11, ch - 0.56, accent)
        tf = txbox(s, x + 0.32, y + 0.24, cw - 0.55, ch - 0.4)
        para(tf, h, 16, DEEP, bold=True, first=True, space_after=8,
             font=FONT_DISPLAY)
        para(tf, body, 13, INK, space_after=0, line=1.18)
    footer(s, 11)


def slide12_roadmap(prs):
    s = new_slide(prs)
    title_block(s, "Roadmap",
                "From a verified fact-checker to a source-verified safety "
                "gate")

    items = [
        ("Broaden coverage", "More crops and diseases beyond today's 8 crops "
         "/ 23 entries."),
        ("Authoritative allowlist", "Supply DOA registration data to enable "
         "the built-but-disabled Layer-1 allowlist check."),
        ("Complete Layer-2 grounding", "Finish source-verified grounded "
         "review \u2014 today a paddy-only prototype, blocked by a thin MARDI "
         "corpus (~6% paddy)."),
        ("Live DOA integration", "Direct integration with authoritative "
         "registries for real-time compliance."),
        ("Mobile / offline-first", "Field-ready access for farmers with "
         "limited connectivity."),
    ]
    y = CONTENT_TOP
    stride = 0.9
    for i, (h, body) in enumerate(items):
        card(s, MARGIN, y, CONTENT_W, 0.78, WHITE, radius=0.05)
        num = card(s, MARGIN + 0.001, y + 0.001, 0.78, 0.778, DEEP,
                   radius=0.05, shadow=False)
        num.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(num.text_frame, str(i + 1), 24, GOLD, bold=True, first=True,
             align=PP_ALIGN.CENTER, space_after=0, font=FONT_DISPLAY)
        tf = txbox(s, MARGIN + 1.05, y + 0.05, CONTENT_W - 1.3, 0.7,
                   anchor=MSO_ANCHOR.MIDDLE)
        p = para(tf, "", 14.5, INK, first=True, space_after=0)
        runs(p, [(h + "   \u2014   ", 14.5, DEEP, True),
                 (body, 13, INK, False)], font=FONT_BODY)
        y += stride
    footer(s, 12)


def slide13_close(prs):
    s = new_slide(prs)
    rect(s, 0, 0, SLIDE_W, SLIDE_H, DEEP)
    rect(s, 0, 0, SLIDE_W, 0.12, GOLD)
    # right motif: oversized translucent proof stat block
    rect(s, 9.4, 0.12, SLIDE_W - 9.4, SLIDE_H - 0.12, LIGHT)
    proof = [("23", "disease entries"), ("8", "crops"),
             ("654", "MARDI passages")]
    y = 1.6
    for num, label in proof:
        tf = txbox(s, 9.85, y, 3.2, 1.2)
        para(tf, num, 40, WHITE, bold=True, first=True, space_after=0,
             font=FONT_DISPLAY, line=1.0)
        para(tf, label, 12.5, MIST, space_after=0, font=FONT_BODY)
        y += 1.35

    tf = txbox(s, MARGIN + 0.25, 1.4, 8.3, 0.4)
    para(tf, "THANK YOU", 12, GOLD, bold=True, first=True, space_after=0,
         font=FONT_DISPLAY, tracking=1.6)

    tf2 = txbox(s, MARGIN + 0.25, 2.0, 8.3, 2.0)
    para(tf2, "Trustworthy knowledge exchange =", 29, WHITE, bold=True,
         first=True, space_after=4, line=1.1, font=FONT_DISPLAY)
    para(tf2, "export-grade quality + a stronger local economy.", 29, GOLD,
         bold=True, space_after=0, line=1.1, font=FONT_DISPLAY)

    tf3 = txbox(s, MARGIN + 0.25, 4.15, 8.3, 0.9)
    para(tf3, "Verified crop-disease knowledge for Malaysian smallholders and "
              "extension officers. Try /ask, /diagnose, the community and the "
              "marketplace.", 14.5, RGBColor(0xE6, 0xEF, 0xE9), first=True,
         space_after=0, line=1.22, font=FONT_BODY)

    rect(s, MARGIN + 0.25, 5.35, 0.55, 0.035, GOLD)
    tf4 = txbox(s, MARGIN + 0.25, 5.6, 8.3, 1.3)
    para(tf4, "Tan Kuan Yu  \u00b7  Lee Hui Ying  \u00b7  Tan Chi Kien", 16,
         WHITE, bold=True, first=True, space_after=5, font=FONT_DISPLAY)
    para(tf4, "Tourism, Culture & Local Economy  \u2014  Hackathon 2026", 12.5,
         MIST, space_after=0, font=FONT_BODY, tracking=0.6)


def main():
    prs = Presentation()
    prs.slide_width = In(SLIDE_W)
    prs.slide_height = In(SLIDE_H)
    slide1_title(prs)
    slide2_vision(prs)
    slide3_problem(prs)
    slide4_objective(prs)
    slide5_capture(prs)
    slide6_reviewgate(prs)
    slide7_architecture(prs)
    slide8_product(prs)
    slide9_community(prs)
    slide10_funnel(prs)
    slide11_impact(prs)
    slide12_roadmap(prs)
    slide13_close(prs)
    prs.save(PPTX_OUT)
    print(f"wrote {PPTX_OUT} ({len(prs.slides._sldIdLst)} slides)")


if __name__ == "__main__":
    main()
