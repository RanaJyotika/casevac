# Jeevan (CASEVAC) — UI Design Guidelines

**Version:** 2.0 · **Revised:** 12 November 2026 (client update) · Supersedes v1 (phone, portrait).  
**Design direction:** tablet-first, **landscape-first with full portrait support** (revised 13 Nov 2026), operational medical workflow UI. Formal, minimal, calm and
clinical. **No gradients, animations, decorative illustrations or marketing-style cards.** English labels.  
**App name:** Jeevan. "CASEVAC" remains the programme name in documents.

## 1. Client UI rules (12 Nov 2026)

1. Landscape mode only. *(Revised 13 Nov 2026: portrait is also supported; landscape remains the primary design.)*
2. Large, touch-friendly UI.
3. Clear boxes and bordered sections.
4. Font sizes readable from a distance.
5. Less vertical scrolling.
6. More side-by-side layouts.
7. Dashboard-style home screen.
8. Fast access for medics under pressure.

## 2. Design principles

1. **Speed under pressure:** primary actions always visible; quick actions on Home; no deep menus before care documentation.
2. **Clear system status:** Offline, Saved Locally, Pending Transfer, Received, Acknowledged mean different things.
3. **Clinical clarity:** explicit labels and units; never hide previous treatment or observations.
4. **Privacy by default:** show only required identity fields; fictional data in all screenshots and demos.
5. **Reliable touch interaction:** large controls, high contrast, explicit error and retry states.
6. **Use the width:** side-by-side panels and two-column forms instead of long single columns.
7. **Future-proof identification:** QR now; NFC/RFID later without redesigning clinical screens.

## 3. Device and orientation

| Item | Decision |
| --- | --- |
| Primary device | Android tablet, ~10 inch |
| Design baseline | **1280 × 800 dp** (e.g. 1920 × 1200 px at 1.5× density, or 1280 × 800 px at 1×) |
| Minimum supported | 960 × 600 dp (e.g. 1920 × 1200 px at 2×). Layouts must not break here. |
| Orientation | Landscape (primary design) **and** portrait (800 × 1280 dp), following the device sensor (`fullSensor`) |
| Units | Client "px" values below are applied as dp (sizes) and sp (text) at the baseline |

**Both orientations (13 Nov 2026).** The orientation lock was removed: Android 16+ ignores orientation locks on
large screens for apps targeting API 36+, so a portrait-proof layout was needed anyway. Every screen adapts to the
window size rather than the orientation:

- **Landscape (1280 × 800 dp):** full sidebar with labels; Home shows the three first actions in one row and
  Alerts + Casualty records in a right-hand column.
- **Portrait (800 × 1280 dp):** compact icon sidebar (below `navCollapseBelow`, 1200 dp); Home shows Scan tag and
  Enter ID side by side with Register casualty as a full-width bar below, then a single column with **Alerts directly
  under the counts** (so a critical alert is visible without scrolling), then the charts and Casualty records.
- Login stacks the branding panel above the form when the window is narrower than `splitBreakpoint` (900 dp) or
  taller than wide.
- Split-screen and any other window size fall back to the same rules.

Strict landscape, if ever required again, should be enforced through the client's device management (kiosk /
rotation lock), not by the app.

## 4. Layout system v1 (proposed — freeze on client approval)

| Token | Value | Notes |
| --- | --- | --- |
| Top bar height | 64 dp | App name, page title, offline/sync status, clinician, Log out |
| Left sidebar width | 240 dp | Persistent module navigation, icon + text label; 96 dp compact (icon + short label) when the window is narrower than 1200 dp |
| Content padding | 24 dp | Around the main content area |
| Gutter (gap between cards) | 16 dp | Client range 12–16 |
| Card / section padding | 16 dp | Client range 12–16 |
| Card radius | 10 dp | Inputs and buttons 8 dp |
| Border | 1 dp | Cards `#C3CAD2`; inputs/controls `#8C96A0` (≥ 3:1 on white) |
| Input height | 52 dp | Client range 48–56 |
| Button height | 56 dp | Minimum 48 dp for any tap target |
| Table row height | 48 dp | Client range 44–52 |
| Split breakpoint | 900 dp | Below this, side-by-side panels stack |

Implemented in `src/theme/tokens.ts` (`layout`, `typography`, `colors`, `triage`).

### App shell (all screens except Login)

```text
+---------------------------------------------------------------------------------+
| [+] JEEVAN  | Page title                   ● Offline   Cpl. R. Demo · Team A  [Log out] |  64 dp
+-------------+-------------------------------------------------------------------+
| Home        |                                                                   |
| Scan QR     |                    Main content area                              |
| Casualties  |      (dashboard, split panels or two-column forms)                |
| Evacuations |                                                                   |
| Handover    |                                                                   |
| Track       |                                                                   |
|             |                                                                   |
| 240 dp      |                                                                   |
+-------------+-------------------------------------------------------------------+
```

- The active module is marked by a filled background **and** a text/indicator change, not colour alone.
- On clinical entry screens the content area starts with a patient/incident identity strip that stays visible.
- Back/Cancel stays available inside the content area; Android Back pops one step.

## 5. Screen layout patterns

| Pattern | Use for | Structure |
| --- | --- | --- |
| Full-screen split | Login | Left: Jeevan branding + short instructions · Right: bordered login box |
| Split panel | Scan QR, Patient Details | Left: primary task (scanner / identity) · Right: secondary actions and context |
| Two-column form | Initial Assessment, Interventions | Left and right columns of bordered sections; save bar at the bottom |
| Large choice cards | Consciousness decision, Triage | Side-by-side cards ≥ 120 dp tall with text label (and colour for triage) |
| Grouped steps | Handover, Prepare Evacuation | Numbered bordered sections in one or two columns |
| Summary report | Evacuation Completed | Casualty, triage, interventions, timeline + next-action buttons |
| Dashboard | Home | Quick actions, summary cards, two charts, activity table, status summary |

### Home dashboard (1280 × 800 baseline)

```text
+--------------------------------------------------------------------------------------+
| Top bar                                                                              |
+-----------+--------------------------------------------------------------------------+
| Sidebar   | [Scan Patient QR] [Start New Evacuation] [Receive Handover] [Track Casualty] |  quick actions
|           | [Total][RED][YELLOW][GREEN][BLACK][Active][Pending handover][Completed]      |  summary cards
|           | +-- Casualties by company (stacked) --+ +-- By triage category ---------+    |
|           | | Alpha   ███▓▓▒▒░  14                | | RED     ██████  12            |    |  charts
|           | | Bravo   ██▓▓▓▒░░  11   …            | | YELLOW  ██████████  20  …     |    |  (≈60 / 40)
|           | +-------------------------------------+ +-------------------------------+    |
|           | +-- Recent casualty activity ---------+ +-- Evacuation status ----------+    |
|           | | ID | Name | Company | Status | Time | | Awaiting pickup · In transfer…|    |  table + summary
+-----------+--------------------------------------------------------------------------+
```

- Quick actions: Scan Patient QR (primary), Enter Patient ID, Temporary Evacuation — large tiles, one row.
- Summary cards in one row of 8 when the content area is ≥ 900 dp wide; otherwise two rows of 4. Number first,
  then label; triage cards add a colour strip and the category name (RED · Critical).
- At 1280 × 800, quick actions, summary cards and both charts are visible without scrolling; the activity table and
  evacuation status start directly below. With 48 dp table rows the whole dashboard cannot fit one screen.
- Charts are drawn with plain Views (no chart library): stacked bars with the count printed in each segment and the
  total at the end; legend in the chart header.
- **Data scope:** until server sync exists, every figure counts records **on this tablet** only. Label it
  ("On this tablet · updated 14:05"). Never present local counts as force-wide totals.

## 6. Typography (client scale)

| Role | Size (sp) | Token |
| --- | --- | --- |
| App / page title | 26 (24–28) | `typography.title` |
| Section heading | 20 (18–22) | `typography.heading` |
| Card value numbers | 30 (24–32) | `typography.cardValue` |
| Labels | 15 (14–16) | `typography.label` |
| Input text | 17 (16–18) | `typography.input` |
| Button text | 17 (16–18) | `typography.button` |
| Body | 16 | `typography.body` |
| Table text / metadata | 15 (14–15) | `typography.table` |
| Helper text | 13 (12–13) | `typography.helper` — avoid anything smaller |

Native system sans-serif. Respect the device's font-scale setting; test at 1.3×.

## 7. Colour

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#FFFFFF` | Main surfaces |
| Surface | `#F4F6F8` | Panels, sidebar, pressed states |
| Border | `#C3CAD2` | Card / section outlines |
| Border strong | `#8C96A0` | Inputs, secondary buttons |
| Primary text | `#1C2630` | Headings / body |
| Secondary text | `#4F5A66` | Supporting information |
| Primary action | `#244B66` | Main button, active navigation |
| Error | `#AA3030` | Validation / verified error |
| Success | `#1F6641` | Confirmed success only |
| Warning | `#7A4F12` | Pending / attention |

### Triage categories (clinical safety)

| Category | Fill | Text on fill | Meaning |
| --- | --- | --- | --- |
| RED | `#C62828` | white | Critical (immediate) |
| YELLOW | `#F2B705` | dark `#1C2630` | Delayed / moderate (urgent, stable) |
| GREEN | `#2E7D32` | white | Minor / stable (ambulatory) |
| BLACK | `#1C1C1C` | white | Deceased / expectant |

**Never rely on colour alone.** Always show the text label and, where relevant, the count — e.g. `RED (12)` — plus
a badge or shape. Reasons: bright sunlight, colour-vision deficiency, operational safety. Use the same four
colours everywhere (cards, charts, badges, selectors). Final category definitions require clinical approval.

## 8. Boxes, borders and spacing

- **Cards / section boxes:** 1 dp border, 10 dp radius, 16 dp padding, 16 dp between cards, titled header.
- **Inputs:** 52 dp high, 1 dp strong border (2 dp primary when focused), visible label above, placeholder only as a hint.
- **Buttons:** 56 dp high (min 48), clear primary (filled) and secondary (outlined) styles, ≥ 12 dp apart.
- **Tables / lists:** 48 dp rows, header row on surface colour, optional alternate row shading, column borders if needed.
- Spacing scale: `4, 8, 12, 16, 24, 32`.

## 9. Reusable components (design system)

| Component | Role | Status |
| --- | --- | --- |
| `TopBar` | App name, page title, connectivity/sync status, clinician, Log out | To build (with Home) |
| `SideNav` | Persistent module navigation with active state | To build (with Home) |
| `DashboardCard` | Label + large value (+ triage colour bar and text) | To build |
| `ChartCard` | Titled bordered box with chart, legend (text) and data-scope note | To build |
| `SectionBox` | Titled bordered section (current `SectionPanel`) | Exists — restyle |
| `FormField` | Label, input, helper, error; optional leading icon / trailing control | Exists (tablet sizes) |
| `PrimaryButton` / `SecondaryButton` | Action buttons with loading / disabled | Exist (tablet sizes) |
| `StatusBadge` | Text + dot status chip | Exists |
| `TriageBadge` / `TriageSelector` | Category label + colour + count; large selectable cards | To build |
| `InfoRow` | Label / value row in detail panels | Exists inside Patient Identification — extract |
| `DataTable` | Bordered table with 48 dp rows | To build |
| `Notice`, `ConfirmationDialog`, `EmptyState` | Messages, confirmations, empty states | Notice exists |

## 10. Charts

| Chart | Type | Content |
| --- | --- | --- |
| Casualties by company | **Stacked bar** (one bar per company) | 6 companies (examples: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot); segments RED / YELLOW / GREEN / BLACK; total at bar end |
| Casualties by category | **Horizontal bar** (preferred for exact reading) | RED, YELLOW, GREEN, BLACK with the count printed next to each bar |

Rules: text legend with counts; no animation; numeric values printed on or beside bars; empty state when there
is no data; data-scope note ("On this tablet"). Library: an SVG-based chart library (e.g. `react-native-svg` with
`react-native-gifted-charts`) is the candidate — verify React Native 0.88 / new-architecture compatibility before
installing; simple bars may be drawn with plain Views instead.

## 11. State design: truth over polish

| State | Good message | Avoid |
| --- | --- | --- |
| Offline | `Offline — local entries available` | `Connected` without network |
| Saved to SQLite | `Saved on this tablet` | `Shared with next team` |
| QR not cached | `Patient details unavailable offline` | Automatically showing a random profile |
| Handover prepared | `Summary ready — transfer pending` | `Handover completed` |
| Transfer failed | `Transfer failed; record remains saved locally` | Silent retry/success |
| Received/imported | `Imported and verified on this device` | `Received` when only sender tapped Send |
| Dashboard counts | `On this tablet · updated 14:05` | Implying force-wide totals |

## 12. Forms and validation

- Keep typed values until explicit save/cancel; confirm discard of unsaved edits.
- Two columns on tablets; group related fields in bordered sections; most important section top-left.
- Numeric inputs show units; no hard-coded clinical threshold advice without clinical validation.
- Show time of observation separately from time of entry.
- Allow `Unknown` / `Not recorded` where clinically approved instead of fabricated defaults.
- Do not require every field before an emergency record can be saved.

## 13. QR and future RFID

Scan screen: camera on the left, manual ID entry and quick actions on the right. Identity source abstracted as
`QR | MANUAL | NFC_FUTURE`. NFC will be a new input method, not a different patient database or workflow. No
medical history in printed QR codes.

## 14. Assets and privacy

- Simple line-style body map when ready; clinical markings must be reviewed.
- No personal/operational photographs, live coordinates or real patient data in development assets.
- Screenshots, demo data and prototypes are labelled **synthetic / demonstration only**.

## 15. UI sign-off checklist

- [ ] Renders correctly at 1280 × 800 dp and at the 960 × 600 dp minimum; stacks sensibly if shown in portrait.
- [ ] Uses the app shell (top bar + side navigation), except Login.
- [ ] Clear task and primary action; fits without vertical scrolling where practical.
- [ ] Font sizes follow §6; nothing below 13 sp.
- [ ] Bordered boxes, 48 dp+ tap targets, 52 dp inputs.
- [ ] Triage shown with colour **and** text label (and count where relevant).
- [ ] Patient and incident identifiers visible on clinical pages.
- [ ] Offline/transfer state accurate and readable without colour.
- [ ] Emergency care can proceed without a valid wristband.
- [ ] Failure messages are actionable, not technical.
