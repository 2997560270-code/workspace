# Design System: Product Drill

> 本文件是 Product Drill 前端的设计契约（single source of truth）。
> 适用对象：多面板训练工具（software UI），目标用户为零基础产品新人。
> 约束基调：简约、克制、高可读；信息密度够用但不压迫；注意力只给「下一步该做什么」。

## 1. Visual Theme & Atmosphere

A calm, gallery-quiet training workspace. Density sits at "Daily App Balanced" (5/10):
cards breathe, hairlines are rare, and numbers are the only mono elements.
Variance is low (4/10): predictable grids, left-aligned content, no asymmetry for its own sake.
Motion is restrained (3/10): 150-200ms ease-out transitions and a single -1px press translate;
no scroll hijacks, no marquees, no perpetual loops. The atmosphere should read like a
well-lit practice studio: neutral paper, one deep-green accent, and type that never shouts.

Dials: `DESIGN_VARIANCE: 4` / `MOTION_INTENSITY: 3` / `VISUAL_DENSITY: 5`.

## 2. Color Palette & Roles

- **Paper Canvas** (#F6F7F8) - primary app background, cool neutral, never warm cream
- **Pure Surface** (#FCFCFD) - card and container fill, off-white not pure white
- **Charcoal Ink** (#16181D) - primary text and the single dark-block fill, off-black not #000000
- **Evidence Ink** (#4A4F57) - body copy, descriptions
- **Provenance Ink** (#7A8089) - metadata, timestamps, disabled-adjacent text
- **Hairline** (#E4E6E9) - 1px structural borders and the rare row divider
- **Practice Green** (#1F6F54) - THE single accent: primary CTA fill, active nav, focus ring, coverage checks. Saturation < 80%.
- **State Amber** (#97661A) - semantic ONLY: "in progress / medium confidence" text and badge. Never a section border or block identity.
- **State Coral** (#B0432F) - semantic ONLY: errors, destructive confirmation. Never a section border or block identity.

Color Consistency Lock: Practice Green is the only accent used for identity and action across
every panel. Amber and Coral appear only as state semantics. No indigo, no per-row rainbow
left-borders, no green-to-pink banner flips.

## 3. Typography Rules

- **Display:** Geist (Latin) + PingFang SC / Microsoft YaHei (CJK), weight 600, tracking -0.01em.
  Controlled scale: page claim 32-40px, card title 20px, item title 17px. Hierarchy via weight
  and color, never raw size. Headlines max 2 lines.
- **Body:** same family, weight 400, 15px, line-height 1.6, max 65ch.
- **Mono:** Geist Mono / JetBrains Mono, reserved for numbers, IDs, timestamps, coverage
  percentages. tabular-nums always.
- **Banned:** Inter as any tier. All serif families (Noto Serif SC, Songti, SimSun, Georgia) in
  every tier - serif is forbidden in software UI. Fraunces / Instrument Serif outright.

## 4. Component Stylings

- **Buttons:** three tiers only. Primary = Charcoal Ink fill, white label, radius 8px, -1px
  translate on active. Secondary = 1px Hairline border, Charcoal Ink label. Ghost = no border,
  Provenance Ink label, gains a Paper tint on hover; used only for tertiary actions and always
  >= 44px tall. No neon glows, no gradients.
- **Disabled state:** label at 40% Charcoal Ink on Hairline fill - still legible, never a dead
  grey slab - and ALWAYS paired with a one-line unlock hint beside it ("填写核心问题与建议行动后可提交").
- **Cards:** radius 10px, 1px Hairline border, no shadow by default. Shadow only for overlays
  (modals, FAB panel), tinted to the canvas hue. Replace cards with whitespace + a single
  top hairline whenever elevation adds no hierarchy.
- **Dark block:** reserved for exactly one purpose, the single recommended next action.
  One dark block per screen, maximum.
- **Status pills:** 999px radius, 12px mono or sans, tinted background of the state color at
  ~10% alpha. Render a pill only when the state is non-default; never repeat "尚未训练" twelve times.
- **Inputs:** label above, helper text optional, error text below in State Coral. Focus ring
  2px Practice Green. No placeholder-as-label.
- **Icons:** one library (Phosphor or Tabler), strokeWidth 1.5 globally. No emoji, no hand-rolled
  glyphs (no ⚙ ● ↗ ▸).
- **Loaders:** skeletal shimmer matching final layout. No circular spinners.
- **Empty states:** one per screen, composed: a short headline, one sentence of "how this gets
  populated", and one primary CTA. Never two stacked voids, never a giant empty card.

## 5. Layout Principles

- App frame: fixed 240px sidebar + fluid content, content max-width 1280px, 24px gutters.
- 12-column CSS Grid; no flexbox percentage math. Multi-column collapses to a single column
  below 768px with no exceptions and no horizontal overflow.
- Section vertical rhythm 32-40px; card internal padding 24px.
- One scroll context per screen. No nested scroll regions inside the workbench; the scenario
  brief flows with the page or becomes a collapsible disclosure.
- Floating action button keeps a reserved safe-area (content padding-right/bottom >= 72px) so it
  never covers copy or CTAs at any breakpoint.
- Full-height regions use `min-h-[100dvh]`, never `h-screen`.

## 6. Motion & Interaction

- 150-200ms `cubic-bezier(0.16, 1, 0.3, 1)` on hover/active/expand. Transform and opacity only.
- Press feedback: `-translate-y-[1px]` on primary/secondary buttons.
- List and card entry: 40ms stagger cascade on first mount of a panel, once.
- Coverage feedback: when a question maps to a dimension, that dimension's check fills Practice
  Green with a 150ms scale-in - the only perpetual-adjacent feedback in the product, and it is
  motivated (acknowledges a user action).
- All motion collapses to instant under `prefers-reduced-motion`.

## 7. Anti-Patterns (Banned)

- No emojis or hand-rolled glyph characters anywhere (⚙ ● ↗ ▸ ■).
- No Inter, no serif of any kind, no pure #000000 / #FFFFFF.
- No neon or outer-glow shadows; no gradient text.
- No section-number labels (01 / 02 / "QUESTION 05") on nav, lists, or empty states.
- No eyebrow micro-label above every card; maximum one eyebrow per three sections.
- No em-dash or en-dash as separator or range; use hyphen for ranges ("5-10 分钟").
- No more than one accent color for identity; no per-row colored left borders.
- No decorative status dots; a dot only when it carries live semantic state.
- No fake or placeholder data visualizations (no ascending grey bars for a zero-data user).
- No duplicate CTA intent on one screen (one label per intent).
- No grey "dead" primary button without an unlock hint.
- No infrastructure jargon in end-user copy (Supabase, Rubric, 服务端记录, API 密钥 as first sight).
- No nested scrollbars; no FAB overlapping content.
- No centered hero over dark mesh, no three-equal-card rows, no generic placeholder names.
- No scroll cues, no version stamps, no locale/time strips.
