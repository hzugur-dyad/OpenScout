# Design System: OpenScout — Candidate Dashboard (Home)

Stitch handoff: semantic rules for **Google Stitch** screen generation. Single palette, one brand accent, dashboard-safe typography (sans + mono only).

---

## 1. Visual Theme & Atmosphere

**Mood:** Calm, editorial-product hybrid — warm bone canvas, crisp structural lines, confident asymmetry. Feels like a focused workspace, not a marketing landing page.

- **Density:** 5/10 — Daily-app balanced. Enough whitespace to scan; plan + bento tiles carry real data.
- **Variance:** 6/10 — Offset asymmetric. Hero and plan sit in a **12-column split** (7 / 5); quick actions use **non-equal spans** (5+7 on row one, 6+6 on row two, full-width referral). **No three equal feature cards in one row.**
- **Motion:** 6/10 — Fluid Framer-style **spring physics** (not linear easing). Lists **stagger in**; no cinematic full-screen choreography. Micro-motion on hover is **transform-only** (e.g. slight `translateX` on link rows).

**Depth:** Optional **fixed** ambient layer only — e.g. very soft radial wash at ~3–4% opacity behind content, `pointer-events: none`. Never on scrolling children.

---

## 2. Color Palette & Roles

**Mandatory:** Maximum **one** saturated brand accent (**Harvest Gold**). No purple/blue neon, no outer glows, no gradient text on large titles. **Never use pure black (`#000000`)** for text or UI ink — use off-black / zinc family.

| Token | Hex / value | Role |
|--------|-------------|------|
| **Bone Canvas** | `#F7F6F3` | Primary background for candidate dashboard home (light) |
| **Pure Surface** | `#FFFFFF` | Card and panel fill (light) |
| **Charcoal Ink** | `#111111` | Primary text (light); use `#18181B` (Zinc-950) as equivalent token name |
| **Muted Parchment** | `#787774` | Secondary body, labels, descriptions |
| **Whisper Rule** | `#EAEAEA` | 1px borders, dividers, input outlines (light) |
| **Harvest Gold** | `#D4A843` | **Only brand accent** — focus rings, brand moments, optional primary actions outside charcoal utilitarian CTAs |
| **Gold Pressed** | `#B8912E` | Primary hover/active darker gold |
| **Dark Stage** | `#0A0A0A` or `#09090B` | App dark background (Zinc-950 family — not `#000000`) |
| **Dark Elevated** | `#141414` / `#18181B` | Cards on dark |
| **Semantic Pastel — Butter** | Fill `#FBF3DB`, text `#956400` | Small tags, icon wells (status, plan chip “free”) — not a second accent |
| **Semantic Pastel — Mist** | Fill `#E1F3FE`, text `#1F6C9F` | Icon well for “jobs” tile only — still not a global accent |
| **Semantic Pastel — Sage** | Fill `#EDF3EC`, text `#346538` | Plan chip “paid” tier tag |

**Dark mode:** Borders `rgba(255,255,255,0.08–0.12)`; secondary text `#A09C98` or Zinc-400; maintain **one** gold accent for focus/links where needed.

---

## 3. Typography Rules

**Dashboard constraint (strict):** **Sans-serif only** on dashboard surfaces. **No serif** for headlines or UI in this product area.

| Role | Font | Rules |
|------|------|--------|
| **Display / page title** | **Geist Sans** (or `font-sans` in app) | Track-tight, weight **semibold** 600. Scale ~`1.875rem` mobile → ~`2.25rem` desktop. Hierarchy via **weight + color**, not only size. |
| **Section / card titles** | Geist Sans | Medium 500–semibold 600, tight tracking. |
| **Body** | Geist Sans | `1rem`, **leading 1.6**, max **65ch** where paragraphs run long. |
| **Meta / kicker** | Geist Sans | `text-xs`, **uppercase**, **letter-spacing 0.05em**, Muted Parchment color. |
| **Numbers / quotas** | **Geist Mono** | Tabular figures for plan usage (`3/5`, codes, counts). |

**Banned:** Inter (explicit). Generic serif (Times, Georgia, Garamond) **on dashboard**. Distinctive serifs reserved for **non-dashboard** marketing if ever used.

---

## 4. Component Stylings

**Buttons**

- **Primary (utilitarian):** Charcoal fill `#111111`, white label, `border-radius` **6px** (`0.375rem`). Hover `#333333`. Active: subtle **scale 0.98** — tactile, no glow.
- **Brand primary (optional):** Harvest Gold fill for high-emphasis actions; hover Gold Pressed.
- **Secondary:** Outline `1px solid #EAEAEA`, transparent fill, hover slight surface tint (`#F7F6F3`).
- **Focus:** **2px ring** in **Harvest Gold** (or Zinc-200 on dark charcoal buttons) — visible, not neon.

**Cards**

- Use when **hierarchy** needs grouping (plan, next step, tiles).
- **Radius:** **8px** (`rounded-lg`) for dashboard cards — not 2.5rem hero cards.
- **Border:** `1px solid #EAEAEA` (light); subtle white/alpha border dark.
- **Shadow:** Default **none**; hover **only** if needed: `0 2px 8px rgba(0,0,0,0.04)` (light) — whisper depth, no `shadow-lg`.
- **Padding:** Generous **24–40px** (`p-6` to `p-10`).

**Icon wells**

- **Phosphor** icons, **bold** weight, consistent 24px box in rounded **8px** container with semantic pastel fill (see palette).

**Inputs (referral URL, etc.)**

- Label **above**; monospace for URL field; error text **below** in muted red text `#9F2F2D` (light) — no toast-only errors for copy failures.

**Loading**

- **Skeleton blocks** matching final layout (title bars, plan panel, tile rectangles). **No** lone circular spinners for page load.

**Empty / error (referral)**

- Short explanation + single **Try again** outline button — composed, not only “Error”.

---

## 5. Layout Principles

- **Grid-first:** CSS **Grid** 12 columns; **asymmetric** column spans as specified above.
- **Contain:** Main column content `max-width: 80rem` (`1280px`, `max-w-7xl`) centered with horizontal padding.
- **Hero / header:** **Left-aligned** intro block (`max-w-2xl` for copy); **not** centered hero when variance > 4.
- **Vertical rhythm:** Large section gaps `clamp(3rem, 6vw, 7rem)` between header block, next-step module, and quick actions.
- **Responsive:** Below **768px**, bento **collapses to one column**; **no horizontal scroll**.
- **Touch:** Interactive targets **min 44px** height where possible.
- **No overlapping:** No stacked absolute text; skip links and modals except standard patterns.

---

## 6. Motion & Interaction

- **Default spring (Framer Motion):** `type: "spring"`, **`stiffness: 100`**, **`damping: 20`** for enter and staggered children.
- **Stagger:** Parent `staggerChildren: ~0.08s`, `delayChildren: ~0.05s` — waterfall, not simultaneous pop-in.
- **Respect `prefers-reduced-motion`:** Zero stagger, instant opacity.
- **Animate only** `transform` and `opacity` for motion safety; avoid animating width/height/top/left for layout.
- **Optional “alive” UI:** Very subtle **pulse** on a single primary dashboard indicator (e.g. live quota) — low amplitude, long period, `transform`/`opacity` only — never distracting.

---

## 7. Hero & Marketing Exception (not this screen)

This file targets **dashboard home** only. If Stitch generates **marketing heroes**: asymmetric split layouts; **inline image typography** allowed **only** on marketing — **not** on dashboard. No “Scroll to explore”, no bounce chevrons, **one** primary CTA per hero.

---

## 8. Anti-Patterns (Banned)

- Emojis in UI, copy, or alt text  
- Inter font  
- Serif on **dashboard** UI  
- Pure **`#000000`** text or background  
- Purple/blue **neon**, gradient **CTA** fills, **outer glow** shadows  
- **Three equal-width** feature cards in a row  
- Centered hero for high-variance marketing (when variance > 4)  
- Generic placeholder names (“John Doe”, “Acme Corp”)  
- Fake stats (“99.99%”, round marketing numbers)  
- AI copy clichés: “Elevate”, “Seamless”, “Unleash”, “Next-Gen”, “Game-changer”, “Delve”  
- Filler UI: “Swipe down”, decorative scroll arrows, bouncing chevrons  
- Broken Unsplash — use `https://picsum.photos/seed/{context}/1200/800` or SVG  
- Custom mouse cursors  
- Overlapping text and imagery without clear separation  
- `h-screen` for full viewport — prefer **`min-h-[100dvh]`** for mobile Safari  

---

## 9. Reference Implementation

**Repo path:** `openscout-app/design/DESIGN.md` (this file).

**Next.js routes / files:** `/dashboard` — `src/app/(dashboard)/dashboard/page.tsx`, `NextStepCard`, `InviteFriendCard`, `SharePublicProfileButton` (`minimal`), `DashboardShell` (bone canvas + radial wash when path is `/dashboard`), `CardInteractive` (`flat`).

Use this document as the **single source of truth** when prompting Stitch to extend or redesign candidate dashboard screens.
