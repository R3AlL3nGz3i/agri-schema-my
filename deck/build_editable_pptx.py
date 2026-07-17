#!/usr/bin/env python3
"""Build the EDITABLE AgriSchema-MY hackathon deck directly with python-pptx.

Vision-led storyline (13 slides, 16:9). Real text boxes / shapes / tables —
fully editable in Keynote & PowerPoint (NOT an image-per-slide export).

    .venv/bin/python deck/build_editable_pptx.py

Deps (already in .venv): python-pptx. Output overwrites the canonical
deliverable deck/agrischema-hackathon.pptx. The v1 image deck can still be
regenerated separately via deck/build_pptx.py + deck/index.html.

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

FONT = "Arial"

# 16:9
SLIDE_W, SLIDE_H = 13.333, 7.5
MARGIN = 0.6
CONTENT_W = SLIDE_W - 2 * MARGIN  # 12.133

# slide-2 sources (from web research; NAP 2.0 / DOSM / KPKM)
SLIDE2_SOURCES = (
    "Sources: KPKM (Ministry of Agriculture & Food Security) 2023/2024 · "
    "Department of Statistics Malaysia (DOSM) 2023 · National Agrofood Policy "
    "2.0 (NAP 2.0, 2021\u20132030), KPKM/FAOLEX."
)


def In(v):
    return Inches(v)


# ---- primitive helpers ------------------------------------------------------
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
         line=1.05, font=FONT):
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
    r.font.name = font
    return p


def runs(p, items):
    """Append several styled runs to an existing paragraph.
    items: list of (text, size, color, bold)."""
    for text, size, color, bold in items:
        r = p.add_run()
        r.text = text
        r.font.size = Pt(size)
        r.font.color.rgb = color
        r.font.bold = bold
        r.font.name = FONT


def card(slide, l, t, w, h, fill, line=None, radius=0.06, line_w=1.0):
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
    return shp


def rect(slide, l, t, w, h, fill):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                 In(l), In(t), In(w), In(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def arrow(slide, l, t, w, h, fill=GOLD, shape=MSO_SHAPE.RIGHT_ARROW):
    shp = slide.shapes.add_shape(shape, In(l), In(t), In(w), In(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


# ---- slide scaffolding ------------------------------------------------------
def new_slide(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = PAPER
    return slide


def title_block(slide, kicker, title, title_size=26, tint=GOLD):
    tf = txbox(slide, MARGIN, 0.40, CONTENT_W, 0.34)
    para(tf, kicker.upper(), 12, tint, bold=True, first=True, space_after=0)
    tf2 = txbox(slide, MARGIN, 0.74, CONTENT_W, 1.12)
    para(tf2, title, title_size, DEEP, bold=True, first=True,
         space_after=0, line=1.02)


def footer(slide, n):
    rect(slide, MARGIN, 7.02, CONTENT_W, 0.022, GOLD)
    tf = txbox(slide, MARGIN, 7.08, 9.0, 0.3)
    para(tf, "AgriSchema-MY  \u00b7  Trustworthy knowledge exchange for "
             "export-grade harvests", 9, GRAY, first=True, space_after=0)
    tfp = txbox(slide, SLIDE_W - MARGIN - 1.2, 7.08, 1.2, 0.3)
    para(tfp, f"{n} / 13", 9, GRAY, align=PP_ALIGN.RIGHT, first=True,
         space_after=0)


def bullet(tf, text, size=13, color=INK, bold_lead=None, first=False,
           space_after=8, dot=GOLD):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.space_after = Pt(space_after)
    p.line_spacing = 1.08
    d = p.add_run()
    d.text = "\u25AA  "
    d.font.size = Pt(size)
    d.font.color.rgb = dot
    d.font.bold = True
    d.font.name = FONT
    if bold_lead:
        r = p.add_run()
        r.text = bold_lead
        r.font.size = Pt(size)
        r.font.bold = True
        r.font.color.rgb = DEEP
        r.font.name = FONT
    r2 = p.add_run()
    r2.text = text
    r2.font.size = Pt(size)
    r2.font.color.rgb = color
    r2.font.name = FONT
    return p


# ---- diagram node -----------------------------------------------------------
def node(slide, l, t, w, h, title, sub, fill=TINT, border=DEEP,
         border_w=1.25, title_color=DEEP, sub_color=INK):
    shp = card(slide, l, t, w, h, fill, line=border, radius=0.10,
               line_w=border_w)
    tf = shp.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = In(0.10)
    tf.margin_right = In(0.10)
    tf.margin_top = In(0.06)
    tf.margin_bottom = In(0.06)
    para(tf, title, 13, title_color, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=3, line=1.0)
    para(tf, sub, 9.5, sub_color, align=PP_ALIGN.CENTER, space_after=0,
         line=1.02)
    return shp


# =========================================================================
# Slides
# =========================================================================
def slide1_title(prs):
    s = new_slide(prs)
    # left green band
    rect(s, 0, 0, 0.28, SLIDE_H, DEEP)
    rect(s, 0.28, 0, 0.08, SLIDE_H, GOLD)
    tf = txbox(s, MARGIN + 0.2, 0.5, CONTENT_W - 0.2, 0.4)
    para(tf, "TOURISM, CULTURE & LOCAL ECONOMY  \u2014  HACKATHON 2026", 12.5,
         GOLD, bold=True, first=True, space_after=0)

    tf2 = txbox(s, MARGIN + 0.2, 2.05, CONTENT_W - 0.2, 1.5)
    para(tf2, "AgriSchema-MY", 60, DEEP, bold=True, first=True, space_after=0)

    tf3 = txbox(s, MARGIN + 0.2, 3.35, 10.6, 1.1)
    para(tf3, "Trustworthy knowledge exchange that lifts Malaysia's harvest "
              "to export grade.", 22, INK, first=True, space_after=0, line=1.1)

    rect(s, MARGIN + 0.2, 4.95, 4.2, 0.03, GOLD)
    tf4 = txbox(s, MARGIN + 0.2, 5.2, CONTENT_W - 0.2, 1.3)
    para(tf4, "TEAM", 11, GRAY, bold=True, first=True, space_after=4)
    p = tf4.add_paragraph()
    p.line_spacing = 1.2
    p.space_after = Pt(0)
    runs(p, [("Tan Kuan Yu", 14, DEEP, True),
             ("  \u00b7  Lead / Data & Pipeline", 13, INK, False)])
    p = tf4.add_paragraph()
    p.line_spacing = 1.2
    runs(p, [("Lee Hui Ying", 14, DEEP, True),
             ("  \u00b7  Analytics Dashboard, Image ML", 13, INK, False)])
    p = tf4.add_paragraph()
    p.line_spacing = 1.2
    runs(p, [("Tan Chi Kien", 14, DEEP, True),
             ("  \u00b7  Agronomy Research", 13, INK, False)])
    footer(s, 1)


def slide2_vision(prs):
    s = new_slide(prs)
    title_block(s, "Malaysia's 2026 agriculture vision & local economy",
                "Malaysia is betting big on agrofood \u2014 yet still imports "
                "far more food than it exports", title_size=25)

    stats = [
        ("RM181.4 bil", "Agrofood sector value, 2023 (+4.3% YoY)",
         "KPKM, 2024"),
        ("~7.8% of GDP", "Agriculture's share of national GDP, 2023",
         "DOSM, 2023"),
        ("RM78.8 bil", "National food import bill, 2023",
         "DOSM, 2023"),
        ("RM46.5 bil", "Food exports, 2023 \u2192 ~RM32 bil trade deficit",
         "DOSM, 2023"),
        ("56.2%", "Rice self-sufficiency ratio, 2023 (new basis)",
         "KPKM, 2024"),
        ("6 \u00b7 21 \u00b7 77", "NAP 2.0 objectives \u00b7 strategies \u00b7 "
         "action plans, 2021\u201330", "NAP 2.0, KPKM"),
    ]
    cols, gap = 3, 0.28
    cw = (CONTENT_W - (cols - 1) * gap) / cols  # 3.86
    ch = 1.78
    y0, ygap = 2.05, 0.24
    for i, (num, label, src) in enumerate(stats):
        r, c = divmod(i, cols)
        x = MARGIN + c * (cw + gap)
        y = y0 + r * (ch + ygap)
        cd = card(s, x, y, cw, ch, WHITE, line=BORDER, radius=0.07)
        rect(s, x, y, 0.09, ch, GOLD if i in (2, 3) else LIGHT)
        tf = cd.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.TOP
        tf.margin_left = In(0.22)
        tf.margin_top = In(0.16)
        tf.margin_right = In(0.12)
        para(tf, num, 27, DEEP, bold=True, first=True, space_after=3)
        para(tf, label, 12, INK, space_after=6, line=1.05)
        para(tf, src, 9, GRAY, italic=True, space_after=0)

    tf = txbox(s, MARGIN, 6.62, CONTENT_W, 0.36)
    para(tf, SLIDE2_SOURCES, 8.5, GRAY, italic=True, first=True,
         space_after=0, line=1.05)
    footer(s, 2)


def slide3_problem(prs):
    s = new_slide(prs)
    title_block(s, "The problem",
                "Smallholders get pesticide dosages from generic AI \u2014 "
                "shown as \u201cverified\u201d when they are only estimates",
                title_size=24)

    # left: the risk chain
    lf = txbox(s, MARGIN, 2.1, 6.6, 3.4)
    bullet(lf, "ask ChatGPT, Google or forums how to treat a crop disease.",
           bold_lead="Smallholders and extension officers ", first=True,
           space_after=11)
    bullet(lf, "and pre-harvest intervals (PHI) are presented as fact \u2014 "
               "but are unverified guesses.",
           bold_lead="Pesticide dosages ", space_after=11)
    bullet(lf, "illegal MRL residues \u2192 rejected or destroyed crops \u2192 "
               "farmer-safety and legal risk.",
           bold_lead="Wrong dose or PHI \u2192 ", space_after=11)
    bullet(lf, "no way to tell a verified label from a confident guess.",
           bold_lead="The farmer has ", space_after=0)

    # right: who we serve
    card(s, 7.55, 2.1, 5.18, 3.9, GOLDTINT, line=GOLD, radius=0.06)
    tf = txbox(s, 7.75, 2.32, 4.8, 0.5)
    para(tf, "WHO WE SERVE", 12, DEEP, bold=True, first=True, space_after=6)
    crops = ["Padi", "Chilli", "Tomato", "Banana", "Durian", "Cocoa",
             "Oil palm"]
    cw, ch, gap = 1.42, 0.5, 0.14
    x0, y0 = 7.75, 2.9
    for i, cr in enumerate(crops):
        r, c = divmod(i, 3)
        x = x0 + c * (cw + gap)
        y = y0 + r * (ch + gap)
        chip = card(s, x, y, cw, ch, WHITE, line=BORDER, radius=0.3)
        chip.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(chip.text_frame, cr, 12, INK, bold=True, first=True,
             align=PP_ALIGN.CENTER, space_after=0)
    tf = txbox(s, 7.75, 4.95, 4.8, 1.0)
    para(tf, "\u2026 smallholder farmers of these crops,", 12.5, INK,
         first=True, space_after=2)
    p = tf.add_paragraph()
    p.line_spacing = 1.1
    runs(p, [("plus ", 12.5, INK, False),
             ("agricultural extension officers", 12.5, DEEP, True),
             (" who advise them.", 12.5, INK, False)])
    footer(s, 3)


def slide4_objective(prs):
    s = new_slide(prs)
    title_block(s, "Our objective",
                "Enable trustworthy knowledge exchange between farmers \u2014 "
                "so quality, and the local economy, rise", title_size=24)

    # thesis band
    band = card(s, MARGIN, 2.0, CONTENT_W, 1.15, DEEP, radius=0.06)
    band.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    para(band.text_frame, "Trustworthy knowledge exchange between farmers  "
         "\u2192  better crop quality  \u2192  stronger local economy & "
         "agri-exports.", 19, WHITE, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=0, line=1.1)

    pillars = [
        ("Trustworthy", "Every claim is labelled verified vs estimate; a "
         "fail-closed review gate means REJECT never ships to a farmer."),
        ("Exchange", "Farmers and extension officers share what works \u2014 "
         "an AI knowledge base plus a human Q&A community, both grounded."),
        ("Local economy", "Higher, safer quality lifts rural income and "
         "export earnings \u2014 the Local Economy track, made concrete."),
    ]
    cw, gap = (CONTENT_W - 2 * 0.3) / 3, 0.3
    for i, (h, body) in enumerate(pillars):
        x = MARGIN + i * (cw + gap)
        cd = card(s, x, 3.55, cw, 2.55, WHITE, line=BORDER, radius=0.06)
        rect(s, x, 3.55, cw, 0.11, GOLD)
        tf = cd.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.TOP
        tf.margin_left = In(0.2)
        tf.margin_right = In(0.2)
        tf.margin_top = In(0.28)
        para(tf, h, 18, DEEP, bold=True, first=True, space_after=8)
        para(tf, body, 12.5, INK, space_after=0, line=1.12)
    footer(s, 4)


def slide5_capture(prs):
    s = new_slide(prs)
    title_block(s, "How we capture knowledge \u2014 the research & scraper "
                "agents",
                "Automated agents turn authoritative MARDI sources into "
                "structured, machine-readable disease entries", title_size=23)

    steps = [
        ("1  MARDI scraper", "Crawls MARDI bulletin pages and downloads "
         "source PDFs of crop-disease guidance."),
        ("2  Seed generator", "Structures findings into consistent YAML "
         "disease entries (crop, pathogen, treatments)."),
        ("3  PDF extractor", "Parses downloaded PDFs \u2192 extracts text "
         "\u2192 fills structured fields per entry."),
    ]
    cw, gap = (CONTENT_W - 2 * 0.35) / 3, 0.35
    for i, (h, body) in enumerate(steps):
        x = MARGIN + i * (cw + gap)
        cd = card(s, x, 2.15, cw, 2.3, TINT, line=DEEP, radius=0.07)
        tf = cd.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.TOP
        tf.margin_left = In(0.2)
        tf.margin_right = In(0.2)
        tf.margin_top = In(0.24)
        para(tf, h, 16, DEEP, bold=True, first=True, space_after=8)
        para(tf, body, 12.5, INK, space_after=0, line=1.12)
        if i < 2:
            arrow(s, x + cw + 0.04, 3.05, gap - 0.08, 0.5)

    note = card(s, MARGIN, 4.75, CONTENT_W, 1.35, GOLDTINT, line=GOLD,
                radius=0.05)
    tf = note.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = In(0.25)
    tf.margin_right = In(0.25)
    p = para(tf, "", 13, INK, first=True, space_after=4)
    runs(p, [("Vendor-neutral engine:  ", 13.5, DEEP, True),
             ("generation and review agents run via an ", 13, INK, False),
             ("agentic coding CLI + a swappable LLM provider", 13, DEEP, True),
             (" \u2014 no vendor lock-in.", 13, INK, False)])
    para(tf, "Optional DOA / MYMRL registry crawlers extend coverage when "
             "authoritative data is available.", 12, GRAY, space_after=0)
    footer(s, 5)


def slide6_reviewgate(prs):
    s = new_slide(prs)
    title_block(s, "The review gate \u2014 our quality guarantee",
                "Every claim passes a fail-closed review gate \u2014 REJECT "
                "never ships", title_size=24)

    # Layer 1
    c1 = card(s, MARGIN, 2.05, 5.86, 2.7, WHITE, line=DEEP, radius=0.06,
              line_w=1.5)
    rect(s, MARGIN, 2.05, 5.86, 0.5, DEEP)
    tf = txbox(s, MARGIN + 0.2, 2.11, 5.5, 0.4)
    para(tf, "LAYER 1 \u00b7 COMPLIANCE  (deterministic, fail-closed)", 13,
         WHITE, bold=True, first=True, space_after=0)
    tf = txbox(s, MARGIN + 0.2, 2.68, 5.5, 2.0)
    bullet(tf, "banned-pesticide denylist \u2192 hard block.",
           bold_lead="REJECT: ", first=True, space_after=8, dot=GOLD)
    bullet(tf, "restricted use, missing PHI, or missing fields.",
           bold_lead="FLAG: ", space_after=8, dot=GOLD)
    bullet(tf, "registration allowlist check is built but disabled until "
               "authoritative DOA data is supplied.",
           bold_lead="Roadmap: ", space_after=0, dot=GRAY)

    # Layer 2 (agronomic review agent)
    c2 = card(s, 6.86, 2.05, 5.87, 2.7, WHITE, line=LIGHT, radius=0.06,
              line_w=1.5)
    rect(s, 6.86, 2.05, 5.87, 0.5, LIGHT)
    tf = txbox(s, 7.06, 2.11, 5.5, 0.4)
    para(tf, "AGRONOMIC REVIEW AGENT  (LLM reviewer)", 13, WHITE, bold=True,
         first=True, space_after=0)
    tf = txbox(s, 7.06, 2.68, 5.5, 2.0)
    bullet(tf, "grades each entry PASS / FLAG / REJECT.",
           bold_lead="Verdict: ", first=True, space_after=8)
    bullet(tf, "a competent internal fact-checker \u2014 not yet a "
               "source-verified safety gate.",
           bold_lead="Honest framing: ", space_after=8)
    bullet(tf, "verdicts feed the admin Review-Queue UI for human oversight.",
           bold_lead="Oversight: ", space_after=0)

    # verified-vs-estimate + REJECT invariant
    band = card(s, MARGIN, 4.95, CONTENT_W, 0.75, GOLDTINT, line=GOLD,
                radius=0.05)
    band.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = para(band.text_frame, "", 14, INK, first=True, space_after=0,
             align=PP_ALIGN.CENTER)
    runs(p, [("Every claim is marked ", 14, INK, False),
             ("verified vs estimate", 14, DEEP, True),
             ("  \u00b7  REJECT entries are never embedded and never reach "
              "a farmer.", 14, INK, False)])

    # stats bar
    stats = [("23", "disease entries"), ("8", "crops"),
             ("654", "MARDI passages")]
    cw = (CONTENT_W - 2 * 0.3) / 3
    for i, (num, label) in enumerate(stats):
        x = MARGIN + i * (cw + 0.3)
        cd = card(s, x, 5.88, cw, 0.85, DEEP, radius=0.05)
        cd.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = para(cd.text_frame, "", 18, WHITE, first=True,
                 align=PP_ALIGN.CENTER, space_after=0)
        runs(p, [(num + "  ", 22, GOLD, True), (label, 14, WHITE, False)])
    footer(s, 6)


def slide7_architecture(prs):
    s = new_slide(prs)
    title_block(s, "Architecture & end-to-end flow",
                "Source \u2192 review \u2192 publish \u2192 serve: search "
                "works even with zero LLM or API keys", title_size=23)

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
    total_gap = 0.34 * (n - 1)
    bw = (CONTENT_W - total_gap) / n
    bh = 1.6
    y = 2.55
    for i, (title, sub, fill, border) in enumerate(stages):
        x = MARGIN + i * (bw + 0.34)
        node(s, x, y, bw, bh, title, sub, fill=fill, border=border,
             border_w=1.5)
        if i < n - 1:
            arrow(s, x + bw + 0.02, y + bh / 2 - 0.16, 0.30, 0.32)

    # stack line
    tf = txbox(s, MARGIN, 4.55, CONTENT_W, 0.5)
    p = para(tf, "", 13, INK, first=True, space_after=0)
    runs(p, [("Stack:  ", 13, DEEP, True),
             ("FastAPI  \u00b7  React + Vite  \u00b7  agentic coding CLI + "
              "swappable LLM provider  \u00b7  ChromaDB (local embeddings).",
              13, INK, False)])

    g = card(s, MARGIN, 5.15, CONTENT_W, 0.95, TINT, line=DEEP, radius=0.05)
    g.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = para(g.text_frame, "", 13, INK, first=True, space_after=0,
             align=PP_ALIGN.CENTER)
    runs(p, [("Graceful degradation:  ", 13.5, DEEP, True),
             ("vector search runs with no LLM and no API keys \u2014 the "
              "core product is always free. REJECT entries are never "
              "published.", 13, INK, False)])
    footer(s, 7)


def slide8_product(prs):
    s = new_slide(prs)
    title_block(s, "Product \u2014 the farmer experience",
                "Photo + text diagnosis grounded in verified sources \u2014 "
                "the AI describes, the KB diagnoses", title_size=23)

    steps = [
        ("Vision DESCRIBES", "/diagnose reads a photo, describes symptoms and "
         "guesses the crop \u2014 it never names the disease itself.", LIGHT),
        ("KB DIAGNOSES", "Verified knowledge-base retrieval matches symptoms "
         "to reviewed entries \u2014 the actual diagnosis is grounded.", DEEP),
        ("LLM SUMMARISES", "/ask summarises only the retrieved source cards "
         "(\u201cONLY SOURCES\u201d) \u2014 it cannot invent treatments.",
         GOLD),
    ]
    cw, gap = (CONTENT_W - 2 * 0.3) / 3, 0.3
    for i, (h, body, accent) in enumerate(steps):
        x = MARGIN + i * (cw + gap)
        cd = card(s, x, 2.2, cw, 2.5, WHITE, line=BORDER, radius=0.06)
        rect(s, x, 2.2, cw, 0.55, accent)
        htf = txbox(s, x + 0.05, 2.28, cw - 0.1, 0.4)
        para(htf, h, 15, WHITE, bold=True, first=True, align=PP_ALIGN.CENTER,
             space_after=0)
        tf = txbox(s, x + 0.2, 2.95, cw - 0.4, 1.6)
        para(tf, body, 13, INK, first=True, space_after=0, line=1.15)
        if i < 2:
            arrow(s, x + cw + 0.02, 3.2, gap - 0.04, 0.42)

    band = card(s, MARGIN, 5.0, CONTENT_W, 1.05, GOLDTINT, line=GOLD,
                radius=0.05)
    band.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = para(band.text_frame, "", 14, INK, first=True, space_after=0,
             align=PP_ALIGN.CENTER)
    runs(p, [("Guest-friendly and honest by construction:  ", 14, DEEP, True),
             ("because the AI can only surface reviewed, verified sources, "
              "it cannot hallucinate an unsafe dose.", 13.5, INK, False)])
    footer(s, 8)


def slide9_community(prs):
    s = new_slide(prs)
    title_block(s, "Community \u2014 the knowledge-exchange engine",
                "Farmers & extension officers answer each other \u2014 and "
                "earn Agri Points for it", title_size=23)

    # left: rewards
    lf_card = card(s, MARGIN, 2.15, 6.0, 3.85, WHITE, line=BORDER,
                   radius=0.06)
    tf = txbox(s, MARGIN + 0.25, 2.35, 5.5, 0.4)
    para(tf, "HOW REPUTATION IS EARNED", 12.5, DEEP, bold=True, first=True,
         space_after=8)
    rows = [("Post an answer", "+5 pts", LIGHT),
            ("Answer gets accepted", "+15 pts", DEEP),
            ("Ask a question / upvotes", "0 pts", GRAY)]
    y = 2.85
    for label, val, col in rows:
        cd = card(s, MARGIN + 0.25, y, 5.5, 0.62, TINT, radius=0.12)
        cd.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        tfa = cd.text_frame
        para(tfa, label, 13.5, INK, first=True, space_after=0)
        vb = txbox(s, MARGIN + 0.25 + 3.7, y + 0.02, 1.75, 0.58,
                   anchor=MSO_ANCHOR.MIDDLE)
        para(vb, val, 17, col, bold=True, align=PP_ALIGN.RIGHT, first=True,
             space_after=0)
        y += 0.75
    tf = txbox(s, MARGIN + 0.25, y + 0.02, 5.5, 0.7)
    para(tf, "5 reputation levels: Seedling \u2192 Community Champion.", 13,
         DEEP, bold=True, first=True, space_after=0)

    # right: why it matters
    rc = card(s, 7.0, 2.15, 5.73, 3.85, DEEPTINT, line=DEEP, radius=0.06)
    tf = txbox(s, 7.25, 2.4, 5.25, 3.4)
    para(tf, "THE HUMAN LAYER", 12.5, DEEP, bold=True, first=True,
         space_after=10)
    bullet(tf, "local, practical know-how the AI knowledge base can't "
               "capture alone.", bold_lead="Peer exchange surfaces ",
           space_after=12)
    bullet(tf, "answer well, build reputation, and gain visibility across "
               "the platform.", bold_lead="Contributors ", space_after=12)
    bullet(tf, "points become spendable value \u2014 the bridge into the "
               "marketplace (next).", bold_lead="Earned ", space_after=12)
    para(tf, "Seeded questions & ledger lines are demo data; the "
             "earn mechanics are fully real (localStorage wallet).", 11,
         GRAY, italic=True, space_after=0, line=1.1)
    footer(s, 9)


def slide10_funnel(prs):
    s = new_slide(prs)
    title_block(s, "Marketplace + the acquisition funnel",
                "Knowledge exchange acquires, vouchers retain, the "
                "marketplace monetizes", title_size=23)

    steps = [
        ("Answer Q&A", "+5 pts \u00b7 accepted +15"),
        ("Earn points\n+ reputation", "5 levels \u00b7 exposure"),
        ("Redeem vouchers", "RM1/5/10 =\n100/500/1000 pts"),
        ("Spend in\nMarketplace", "voucher = checkout\ndiscount"),
        ("Sellers sponsor\nshipping", "40 pts / slot \u2192\nmore buyers"),
    ]
    n = len(steps)
    bw = (CONTENT_W - 0.30 * (n - 1)) / n
    bh = 1.5
    y = 2.5
    for i, (title, sub) in enumerate(steps):
        x = MARGIN + i * (bw + 0.30)
        fill = GOLDTINT if i in (2, 4) else TINT
        border = GOLD if i in (2, 4) else DEEP
        node(s, x, y, bw, bh, title, sub, fill=fill, border=border,
             border_w=1.5)
        if i < n - 1:
            arrow(s, x + bw + 0.01, y + bh / 2 - 0.15, 0.28, 0.30)

    # loop-back bar
    loop = card(s, MARGIN, 4.5, CONTENT_W, 0.62, DEEP, radius=0.1)
    loop.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    para(loop.text_frame, "\u21ba  Closed loop  \u2014  vouchers are spendable "
         "ONLY in the Marketplace:  engagement \u2192 retention \u2192 "
         "local-economy monetization", 13.5, WHITE, bold=True, first=True,
         align=PP_ALIGN.CENTER, space_after=0)

    tf = txbox(s, MARGIN, 5.35, CONTENT_W, 0.8)
    p = para(tf, "", 13.5, INK, first=True, space_after=0, align=PP_ALIGN.CENTER)
    runs(p, [("The knowledge exchange is the acquisition engine  \u00b7  "
              "vouchers are retention  \u00b7  the marketplace is monetization "
              "\u2014 all mechanics are real; sample listings are demo data.",
              13, INK, False)])
    footer(s, 10)


def slide11_impact(prs):
    s = new_slide(prs)
    title_block(s, "Why it matters \u2014 impact",
                "Verified knowledge exchange \u2192 export-grade quality "
                "\u2192 rural income & agri-exports rise", title_size=23)

    cards = [
        ("Serves the 2026 vision", "Directly answers NAP 2.0 goals: raise "
         "quality & productivity, grow agrofood exports, cut import "
         "dependence, empower smallholders."),
        ("Trust by alignment", "Content is structured for DOA / MARDI "
         "alignment and labelled verified vs estimate \u2014 safe to act on "
         "in the field."),
        ("Scales without retraining", "New verified entries are ingested and "
         "embedded locally \u2014 no model retraining, no API cost to grow "
         "coverage."),
        ("Local Economy, made real", "Higher, safer quality lifts rural "
         "livelihoods and export earnings \u2014 the track's goal, delivered "
         "on the ground."),
    ]
    cw, ch, gx, gy = (CONTENT_W - 0.35) / 2, 1.85, 0.35, 0.3
    for i, (h, body) in enumerate(cards):
        r, c = divmod(i, 2)
        x = MARGIN + c * (cw + gx)
        y = 2.15 + r * (ch + gy)
        cd = card(s, x, y, cw, ch, WHITE, line=BORDER, radius=0.06)
        rect(s, x, y, 0.11, ch, GOLD if i in (0, 3) else LIGHT)
        tf = txbox(s, x + 0.28, y + 0.2, cw - 0.5, ch - 0.35)
        para(tf, h, 16, DEEP, bold=True, first=True, space_after=7)
        para(tf, body, 12.5, INK, space_after=0, line=1.13)
    footer(s, 11)


def slide12_roadmap(prs):
    s = new_slide(prs)
    title_block(s, "Roadmap",
                "From a verified fact-checker to a source-verified safety "
                "gate", title_size=24)

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
    y = 2.15
    for i, (h, body) in enumerate(items):
        cd = card(s, MARGIN, y, CONTENT_W, 0.82, WHITE, line=BORDER,
                  radius=0.05)
        num = card(s, MARGIN, y, 0.82, 0.82, DEEP, radius=0.05)
        num.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(num.text_frame, str(i + 1), 24, GOLD, bold=True, first=True,
             align=PP_ALIGN.CENTER, space_after=0)
        tf = txbox(s, MARGIN + 1.05, y + 0.06, CONTENT_W - 1.3, 0.72,
                   anchor=MSO_ANCHOR.MIDDLE)
        p = para(tf, "", 14, INK, first=True, space_after=0)
        runs(p, [(h + "  \u2014  ", 14.5, DEEP, True),
                 (body, 13, INK, False)])
        y += 0.92
    footer(s, 12)


def slide13_close(prs):
    s = new_slide(prs)
    # full deep background
    rect(s, 0, 0, SLIDE_W, SLIDE_H, DEEP)
    rect(s, 0, 0, SLIDE_W, 0.14, GOLD)

    tf = txbox(s, MARGIN + 0.2, 1.35, CONTENT_W - 0.4, 0.4)
    para(tf, "THANK YOU", 13, GOLD, bold=True, first=True, space_after=0)

    tf2 = txbox(s, MARGIN + 0.2, 1.95, CONTENT_W - 0.4, 1.9)
    para(tf2, "Trustworthy knowledge exchange =", 30, WHITE, bold=True,
         first=True, space_after=4, line=1.08)
    para(tf2, "export-grade quality + a stronger local economy.", 30, GOLD,
         bold=True, space_after=0, line=1.08)

    tf3 = txbox(s, MARGIN + 0.2, 4.05, CONTENT_W - 0.4, 0.8)
    para(tf3, "AgriSchema-MY  \u2014  verified crop-disease knowledge for "
              "Malaysian smallholders and extension officers. Try /ask, "
              "/diagnose, the community and the marketplace.", 15,
         RGBColor(0xE6, 0xEF, 0xE9), first=True, space_after=0, line=1.2)

    rect(s, MARGIN + 0.2, 5.15, 4.0, 0.03, GOLD)
    tf4 = txbox(s, MARGIN + 0.2, 5.4, CONTENT_W - 0.4, 1.3)
    para(tf4, "Tan Kuan Yu  \u00b7  Lee Hui Ying  \u00b7  Tan Chi Kien", 16,
         WHITE, bold=True, first=True, space_after=4)
    para(tf4, "Tourism, Culture & Local Economy  \u2014  Hackathon 2026", 12.5,
         RGBColor(0xCF, 0xE0, 0xD5), space_after=0)


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
