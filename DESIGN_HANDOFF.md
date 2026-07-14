# AgriScheme — Design System Handoff

> A design brief for producing on-brand UI. Everything below is extracted from the
> existing frontend (`HY` branch: `tailwind.config.js`, `src/index.css`, and the
> React components). Match these tokens exactly so new work is visually consistent.

---

## 1. Product identity

- **Product name (UI):** **AgriScheme** (the repo is "AgriSchema-MY", but the UI wordmark is "AgriScheme" — use this).
- **What it is:** An evidence-based crop-disease assistant for Malaysia. Farmers upload a crop photo and get a science-backed, regulation-validated action plan; admins/researchers build and validate the knowledge base.
- **Logo:** `Leaf` icon (from **lucide-react**) + bold wordmark "AgriScheme", always side by side. On dark/gradient surfaces the leaf is gold (`text-accent`).
- **Tone / voice:** Scientific, trustworthy, regulatory. Eyebrow phrases like *"Evidence-Based · Malaysia Validated"*. Always includes a safety disclaimer: *"AI-assisted screening only — not a substitute for laboratory diagnosis."*
- **Stack:** React + Vite + **Tailwind CSS** + **lucide-react** icons. Use Tailwind utility classes.

---

## 2. Color palette

### Brand colors (from `tailwind.config.js`)
| Token | Hex | Use |
|---|---|---|
| `primary` (DEFAULT) | `#1a6b3c` | Main brand green — buttons, links, active nav, icons |
| `primary-light` | `#2d9e5f` | Gradient stops, lighter accents |
| `primary-dark` | `#0f4a28` | Button hover, dark cards, gradient base |
| `accent` (DEFAULT) | `#e8b84b` | Gold — highlights on dark bg, logo leaf, emphasis text, admin badges |
| `accent-light` | `#f5d07a` | Lighter gold |

### Neutrals (Tailwind defaults)
| Purpose | Class |
|---|---|
| Page background | `bg-gray-50` |
| Body text | `text-gray-800` |
| Muted / secondary text | `text-gray-500` |
| Labels | `text-gray-700` |
| Card border | `border-gray-100` |
| Dark chrome (sidebar) | `bg-gray-900` |
| Dark chrome borders | `border-gray-700` |
| Dark chrome muted text | `text-gray-400` |

### Signature gradient (hero / auth / marketing surfaces)
```
bg-gradient-to-br from-primary-dark via-primary to-primary-light
```
White + gold text sits on top of this. Use for landing page, login page, any full-bleed marketing surface.

---

## 3. Status color system (semantic — keep consistent)

All are pills: `text-xs px-2 py-0.5 rounded-full font-medium`, style `bg-{c}-100 text-{c}-700`.

### Regulatory status
| Status | Colors |
|---|---|
| approved (`MY_approved`) | green-100 / green-700 |
| restricted | orange-100 / orange-700 |
| banned | red-100 / red-700 |
| unknown | gray-100 / gray-600 |

### Pathogen type
| Type | Color base |
|---|---|
| fungi | amber |
| bacteria | blue |
| virus | purple |
| pest | red |
| nematode | pink |
| abiotic | sky |
| oomycete | teal |

---

## 4. Typography

- **Font family:** system sans (`font-sans` — Tailwind default stack). No custom webfont.
- **Scale:**
  | Role | Classes |
  |---|---|
  | Hero heading | `text-4xl md:text-5xl font-bold leading-tight` |
  | Page / card title | `text-xl font-bold` |
  | Logo wordmark | `text-xl`–`text-3xl font-bold` |
  | Body | `text-sm` (default), `text-lg` for lead paragraphs |
  | Eyebrow / section label | `text-xs uppercase tracking-wider` (often `text-gray-500`) |
  | Button text | `text-sm font-medium` / `font-semibold` |

---

## 5. Shape, elevation & motion

- **Corner radius:** buttons & inputs `rounded-lg`; cards `rounded-xl`; hero/auth cards `rounded-2xl`; badges & pills `rounded-full`. Friendly, generous rounding.
- **Elevation:** soft. `shadow-sm` at rest; `shadow-xl` on prominent/auth cards; `hover:shadow-xl` to lift interactive cards. Cards are white with a thin `border-gray-100`.
- **Motion:** subtle and quick — `transition-colors` on buttons/nav; `group-hover:scale-110` on card icons; `hover:shadow` lifts. No heavy animation.

---

## 6. Reusable component classes (already defined in `src/index.css`)

```css
.btn-primary   /* bg-primary text-white px-4 py-2 rounded-lg font-medium
                  hover:bg-primary-dark transition-colors disabled:opacity-50 */
.btn-outline   /* border border-primary text-primary px-4 py-2 rounded-lg font-medium
                  hover:bg-primary hover:text-white transition-colors */
.card          /* bg-white rounded-xl shadow-sm border border-gray-100 p-5 */

/* status pills */
.badge-approved .badge-restricted .badge-banned .badge-unknown
.badge-fungi .badge-bacteria .badge-virus .badge-pest
.badge-nematode .badge-abiotic .badge-oomycete
```

Reuse these instead of re-inventing buttons/cards/badges.

---

## 7. Form & input pattern (from Login page)

- **Text input:**
  ```
  w-full border rounded-lg px-3 py-2.5 text-sm
  focus:outline-none focus:ring-2 focus:ring-primary
  ```
- **Label:** `text-sm font-medium text-gray-700 block mb-1`
- **Password field:** input has `pr-10`; an `Eye`/`EyeOff` (lucide) toggle absolutely positioned `right-3 top-1/2 -translate-y-1/2 text-gray-400`.
- **Tabs (e.g. Sign In / Create Account):** active tab = `text-primary border-b-2 border-primary bg-white`; inactive = `text-gray-400 bg-gray-50 hover:text-gray-600`.
- **Errors:** use lucide `AlertCircle`, red text. **Loading:** lucide `Loader` spinner, disable buttons via `disabled:opacity-50`.
- **Field spacing:** stack with `space-y-4`.

---

## 8. Layout patterns

### App shell (`AppLayout`)
- Fixed left **`w-64` sidebar, dark `bg-gray-900 text-white`**; scrollable `main` beside it.
- Sidebar: logo top, grouped nav (uppercase `text-xs tracking-wider text-gray-500` section headers), user block pinned to bottom.
- **Active nav item:** `bg-gray-700 text-white font-medium`. **Inactive:** `text-gray-400 hover:bg-gray-800 hover:text-white`.
- **Responsive:** below `md:` the sidebar becomes a hamburger drawer (`Menu` icon) overlay with `bg-black/50` scrim; a dark `gray-900` mobile top bar appears.
- Primary CTA in sidebar ("New Scan"): `bg-primary hover:bg-primary-dark` rounded-lg with a `Plus` icon.

### Two roles / two portals
- **Farmer:** Home, Search, History, Scan Crop, Diagnosis Result. Friendly, minimal, no-login-required path ("Continue as guest").
- **Admin / Researcher:** Dashboard, Evidence Search, Review Queue, Knowledge Base, Query Analytics. Admin desktop top bar: white, `border-b`, title `text-sm font-medium text-gray-500`, user chip `bg-primary/10 text-primary rounded-full`.

### Marketing surfaces (Landing / Login)
- Full-screen green gradient (§2). White content cards float on top.
- Role-selection cards: white `rounded-2xl p-7`, `hover:shadow-xl`, big lucide icon (`size={32}`) that does `group-hover:scale-110`; a "→" text link in `text-primary` (or `text-accent` on dark cards).
- Dark variant card: `bg-primary-dark rounded-2xl border border-primary` with gold icon + white text.
- Small pill chips on gradient: `bg-white/10 text-accent px-4 py-1.5 rounded-full text-sm`.

---

## 9. Iconography

- **Library:** `lucide-react` — use it for ALL icons (thin, consistent stroke).
- **Sizes:** ~12–16px inline/nav, ~20–26px headers/logo, ~32px feature/card icons.
- **Icons already in use:** `Leaf` (brand), `Camera`/`ScanCrop`, `Search`, `History`, `Home`, `LayoutDashboard`, `ClipboardCheck` (review queue), `BookOpen` (knowledge base), `BarChart2` (analytics), `FlaskConical` (research), `Globe`, `ShieldCheck`, `AlertCircle`, `Loader`, `Eye`/`EyeOff`, `User`, `LogIn`/`LogOut`, `Plus`, `Menu`/`X`.

---

## 10. One-paragraph summary (paste this if you only send one thing)

> AgriScheme is an evidence-based Malaysian crop-disease assistant. Design language:
> **deep agricultural green (`#1a6b3c`, with `#2d9e5f` light / `#0f4a28` dark) + warm
> gold accent (`#e8b84b`)** on a light gray (`gray-50`) canvas. White cards with soft
> shadows and generous rounding (`rounded-lg`/`xl`/`2xl`), pill badges for every status
> (green=approved, orange=restricted, red=banned; pathogen types color-coded). Full-bleed
> **green diagonal gradient** (`from-primary-dark via-primary to-primary-light`) for
> hero/login surfaces with white + gold text. Dark `gray-900` sidebar chrome. System-sans
> typography, bold headings, uppercase-tracked micro-labels. **lucide-react** icons
> throughout. Tailwind CSS. Two audiences — farmers (friendly, guest-friendly) and
> admins/researchers (data-dense dashboards). Tone: scientific, trustworthy, regulation-aware.
