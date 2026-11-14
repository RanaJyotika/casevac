# Jeevan (CASEVAC) — Screen Specifications

**Purpose:** Implementation contract for the React Native **Android tablet** app (Jeevan) plus minimal admin dashboard.  
**Revised:** 12 November 2026 — client update: tablet-first, landscape-only (see `UI_DESIGN_GUIDELINES.md` v2).  
**UI character:** clean, formal, low-distraction, operational, English labels.  
**States:** `MVP` build now; `STRETCH` if time; `DEFERRED` after validation.  
**Clinical disclaimer:** data fields drawn from AFMSF-21 are reference fields; clinical team must approve required/optional status and terminology.  

## General screen conventions

- **Landscape tablet layout** at the 1280 × 800 dp baseline: app shell (64 dp top bar + 240 dp left navigation) on
  every screen except Login; split panels and two-column forms; minimal vertical scrolling. Layouts stack
  vertically if the OS shows them narrower than 900 dp or in portrait (`UI_DESIGN_GUIDELINES.md` §3).
- Font sizes, borders, control heights and triage colours follow `UI_DESIGN_GUIDELINES.md` §4–8.
- Every screen: clear title; Back where appropriate; visible Offline/Online status; errors in plain language.
- All save actions: validate → persist → show saved status. Disable duplicate submit while saving.
- Forms: accessible labels, date/time when observed, author attribution, explicit units, required-field messages.
- User may leave and return without losing already committed records.
- Sensitive information should only display after appropriate authorisation. Never use real soldier/medical data in screenshots.
- Prefer modular forms to a single enormous clinical page. Include emergency-first shortcuts where medically approved.

## Client 10-screen workflow (12 Nov 2026) → screen IDs

The client's wireframe (AI-generated, indicative only — not an exact reference) defines this clinical flow.
Each screen is redrawn in landscape as below.

| # | Client screen | Spec ID | Landscape layout |
| --- | --- | --- | --- |
| 1 | Medic Login / Home | M01, M02 | Login: left branding + instructions, right login box. Home: command dashboard |
| 2 | Scan Patient QR | M03 | Left: scanner · Right: manual ID entry, quick actions, last scanned casualty |
| 3 | Patient Details | M04 | Left: identity details · Right: previous medical history + action buttons |
| 4 | Casualty Consciousness Decision | M04B | Two large side-by-side choice cards: Yes → M07, No → M05 temporary registration |
| 5 | Initial Casualty Assessment | M07 (+ M09) | Two columns: left incident details + MARCH · right vitals + notes |
| 6 | Initial Interventions | M11 | Grouped toggle sections: bleeding, airway, breathing, medication, remarks (two columns) |
| 7 | Initial Casualty Condition | M07B | Large triage cards (RED / YELLOW / GREEN / BLACK with text) + provisional diagnosis + remarks |
| 8 | Handover Details | M13 | Numbered grouped boxes: place/date/time, medical officer, next course of action |
| 9 | Prepare Evacuation | M13B | Grouped boxes: date/time, assisting staff, condition during evacuation, mode of evacuation |
| 10 | Evacuation Completed | M19 | Summary report: casualty, triage, interventions, timeline + next-action buttons |

**Open for client confirmation:** the wireframe orders Handover (8) before Prepare Evacuation (9); the Point A → B
flow suggests preparing the evacuation first. "Evacuation Completed" must not imply that a digital transfer was
received or acknowledged (M14 status rules still apply).

## App navigation summary

| ID | Screen | Priority | Entry from |
| --- | --- | --- | --- |
| M01 | Medic Login | MVP — built (landscape) | App startup |
| M02 | Home — command dashboard | MVP — built (demo data) | Login |
| M03 | Scan Patient QR / Manual ID | MVP — scanner built (portrait layout, to restyle) | Home / side navigation |
| M04 | Patient Details & Incident Choice | MVP — built (portrait layout, to restyle) | Scan / manual lookup |
| M04B | Casualty Consciousness Decision | MVP | Patient Details / Unknown Casualty |
| M05 | Unknown Casualty / Temporary Registration | MVP | Scan failure / Home / M04B "No" |
| M06 | Start / Resume Evacuation | MVP | Patient / unknown casualty |
| M07 | Initial Assessment | MVP | Incident / M04B "Yes" |
| M07B | Initial Casualty Condition (triage) | MVP | Interventions |
| M08 | Injury Details | STRETCH | Initial Assessment |
| M09 | Vital Signs | MVP | Incident / Timeline |
| M10 | GCS Assessment | MVP | Incident / Timeline |
| M11 | Treatment / Intervention | MVP | Incident / Timeline |
| M12 | Clinical Timeline | MVP | Incident / saved entry |
| M13 | Handover Details / Prepare Handover | MVP | Timeline / Casualty Condition |
| M13B | Prepare Evacuation | MVP | Handover Details |
| M14 | Transfer Options / Pending | MVP | Handover |
| M15 | Receive & Review Record | DEFERRED for real import | Verified inbound transfer |
| M16 | Clinical Handover Acknowledgement | DEFERRED or labelled demo | Receive & Review |
| M17 | Pending Sync / Transfer | STRETCH | Home |
| M18 | Optional 9-Line MEDEVAC Request | DEFERRED | Separate coordination module |
| M19 | Evacuation Completed (summary report) | MVP | Prepare Evacuation |

## M01 — Medic Login

**Purpose:** Enter authorised clinical workflow.

- **Layout (landscape, no app shell):** left panel — JEEVAN name, one-line purpose, short numbered sign-in
  instructions, version; right panel — Offline/Online badge and a bordered login box (max 480 dp wide).
- **Fields:** User ID; Password with show/hide control. Visible "Demo mode" line while authentication is mocked.
- **Actions:** Login; Forgot Password? (placeholder: explains reset is not available yet — no recovery flow).
- **Validations:** missing user ID / password; credentials not recognised. Network not required for an already provisioned offline session (later).
- **Next:** M02 Home.
- **Security note:** do not claim a fingerprint unlock alone proves clinician credentials; production requires enrolment, roles and revocation design.

## M02 — Home (command dashboard)

**Purpose:** Situational overview and one-tap access to the main medic actions.

- **Layout:** app shell; content rows (see `UI_DESIGN_GUIDELINES.md` §5): quick actions → summary cards → two
  charts side by side → recent activity table + evacuation status. At 1280 × 800 the actions, cards and both charts
  are visible without scrolling; the activity row starts just below (one short scroll).
- **Quick actions (large tiles):** **Scan Patient QR** → M03; **Enter Patient ID** → manual lookup dialog (exact
  match on this tablet; result marked "identified manually — wristband not verified" → M04); **Temporary
  Evacuation** → M05 for a casualty with no ID or a destroyed/unreadable wristband (placeholder until evacuation
  storage exists). Receive Handover and Track Casualty are reached from the side navigation.
- **Summary cards:** Total Casualties; Critical (RED); Moderate (YELLOW); Stable (GREEN); Deceased / Expectant
  (BLACK); Active Evacuations; Pending Handover; Completed Evacuations. Triage cards show colour **and** label and count.
- **Chart 1 — Casualties by company:** stacked bar, one bar per company (6 companies, e.g. Alpha–Foxtrot),
  segments RED/YELLOW/GREEN/BLACK, total per bar.
- **Chart 2 — Casualties by category:** horizontal bar with the count beside each bar (e.g. RED – 12).
- **Recent casualty activity:** table — casualty ID, patient name, company, status, last update time; row → M12.
- **Evacuation status:** vertical flow Awaiting pickup → In transfer → Handed over → Completed, with counts.
  Provisional definitions: Active = not Completed; Pending handover = Awaiting pickup + In transfer. These are
  operational stages, not digital transfer states.
- **Data scope:** figures count records **on this tablet** until server sync exists; label "On this tablet · updated HH:MM".
- **Empty states:** no casualties yet (cards show 0, charts show an explanation, not blank axes).
- **Depends on:** triage category and company recorded per casualty (REQUIREMENTS FR-28, FR-29); evacuation
  status definitions (client decision).

## M03 — Scan Patient QR / Manual ID

**Purpose:** Read permanent patient identity token, not clinical history.

- **Fields:** camera preview with scan guide; manual Patient ID input; optional torch toggle.
- **Actions:** Scan; Enter ID; Unknown Casualty → M05; Cancel.
- **Validations:** camera denied, invalid token, unknown token, ambiguous match, identity unavailable offline.
- **Next:** valid and available identity → M04. QR alone cannot pull Team A's unsynced notes from Phone B.

## M04 — Patient Details & Incident Choice

**Purpose:** Confirm correct person and select current evacuation.

- **Layout:** left — identity details and credential verification; right — previous medical history, existing evacuations, action buttons.

- **Display (as available):** name, service ID, unit, age/sex, blood group and Rh, relevant history, identity verification status; minimise sensitive fields.
- **Actions:** Start New Evacuation → M06; Resume Active Incident → M12; Back; Flag Mismatch.
- **Rules:** each new casualty episode gets its own incident ID; patient ID persists.

## M04B — Casualty Consciousness Decision

**Purpose:** Route the casualty quickly (client screen 4).

- **Question:** "Is the casualty conscious and able to provide details?"
- **Actions:** two large side-by-side cards — **Yes** → M07 Initial Assessment; **No** → M05 Temporary Registration.
- **Rules:** the choice is recorded as a time-stamped, attributed event; it is not a clinical consciousness score (GCS stays in M10).

## M05 — Unknown Casualty

**Purpose:** Document lifesaving care without requiring a pre-issued QR.

- **Fields:** temporary ID (generated), estimated/unknown identity markers if approved, incident notes, event location/time if safe.
- **Actions:** Create Temporary Record → M06; Return to Scan → M03.
- **Rules:** no forced identity guess; later reconciliation by authorised users only.

## M06 — Start / Resume Evacuation

**Purpose:** Create the current A-to-B episode.

- **Fields:** generated Evacuation ID; patient or temporary ID; started-at time; initial care stage (approved labels); reporting location if permitted.
- **Actions:** Start → M07; View Existing → M12.
- **Validations:** warn if an active incident already exists for same patient; prevent accidental duplicates while allowing distinct legitimate incidents.

## M07 — Initial Assessment

**Purpose:** Capture first available clinical state.

- **Fields (AFMSF-21 p.1):** reporting time; priority (as defined by client); provisional diagnosis; complaint/findings; tourniquet applied/released times and Inj TT details when applicable; stage/author.
- **Actions:** Save Locally → M12 or next clinical section; Injury Details → M08; Vitals → M09.
- **Rules:** optional/mandatory rules from clinical team; timestamps must be explicit; avoid clinical advice in app.

## M07B — Initial Casualty Condition (triage)

**Purpose:** Record triage category and provisional diagnosis (client screen 7).

- **Fields:** triage category as four large cards — RED (critical), YELLOW (delayed/moderate), GREEN (minor),
  BLACK (deceased/expectant), each with colour, text label and short meaning; provisional diagnosis; additional remarks.
- **Rules:** the category feeds the Home dashboard; changes are new attributed events (re-triage keeps history);
  category definitions require clinical approval.

## M08 — Injury Details

**Purpose:** Document injury location and descriptions.

- **Fields (AFMSF-21 p.2):** front/back body area selection; injury type/description; optional annotation.
- **Actions:** Add Injury, Save, Return to Assessment/Timeline.
- **MVP fallback:** simple controlled body-region list if drawing interactions exceed sprint; preserve compatibility with later diagram.

## M09 — Vital Signs

**Purpose:** Repeated physiological observations.

- **Fields (AFMSF-21 p.2):** observed_at, care stage, temperature with unit, pulse bpm, systolic/diastolic BP mmHg, respiratory rate /min, SpO2 %, notes.
- **Actions:** Save Vitals, Add Another Observation, View Timeline.
- **Validation:** numeric ranges should guard input format, not substitute for clinical judgment; handle unavailable values explicitly.
- **Rules:** new observation is appended, previous readings remain visible.

## M10 — GCS Assessment

**Purpose:** Record neurological status per observation.

- **Fields (AFMSF-21 p.3):** eye-opening score, verbal-response score, motor-response score, observed_at, care stage and notes.
- **Derived:** score total from selected valid components; never silently infer a missing score.
- **Actions:** Save GCS → M12; View Prior Assessments.
- **Rules:** verify scoring options and special scenarios with clinical team before production.

## M11 — Treatment / Intervention

**Purpose:** Record medication and procedure history.

- **Fields (AFMSF-21 p.4):** category (IV fluids, analgesics, antibiotics, other drugs, procedure), item name, dose/value, unit, route if applicable, administration time, clinician, stage, notes.
- **Actions:** Save Locally; Add Another; Return to Timeline.
- **Validations:** category and item required; clinically mandated dose/route/time fields per approved specification; duplicate submission prevention.
- **Rules:** preserve treatment history, do not edit old entries without traceable correction.

## M12 — Clinical Timeline

**Purpose:** Single chronological view across the current incident.

- **Displays:** patient/incident context; saved local status; event type, observed/recorded time, clinician, summary, care stage; filtering by type if time.
- **Actions:** Add Assessment / Vitals / GCS / Treatment; Prepare Handover → M13.
- **Empty state:** No care events yet.
- **Offline:** work from local storage; indicate if a record has not synced or transferred.

## M13 — Prepare Handover

**Purpose:** Review care for the intended recipient.

- **Displays:** patient/incident IDs, latest vitals/GCS, injuries, treatment list, outstanding considerations, sending clinician, intended receiver/team, handover time.
- **Fields:** handover notes; intended receiver ID/team (when known).
- **Actions:** Save Handover Request; Go to Transfer Options → M14.
- **Rules:** Preparing a summary is **not** proof of receipt.

## M13B — Prepare Evacuation

**Purpose:** Record how the casualty is being evacuated (client screen 9).

- **Fields:** date and time of evacuation; assisted by medical officer (yes/no); assisted by nursing assistant
  (yes/no); patient condition during evacuation; mode of evacuation — Ambulance (ground), Helicopter (air),
  Stretcher (manual / on-site).
- **Layout:** grouped bordered boxes in two columns; Save at the bottom.

## M14 — Transfer Options / Pending

**Purpose:** Show accurate transfer paths and completion status.

- **Options:** Server transfer (future), Bluetooth (spike), Wi-Fi Direct (spike), USB (spike), Emergency verbal/paper handover.
- **MVP behaviour:** unimplemented modes disabled or marked Prototype; primary action **Mark Digital Transfer Pending**.
- **Status:** Saved Locally; Prepared; Transfer Pending; Sent (only after actual send); Received (only after verified import); Acknowledged (separate).
- **Failure states:** radio unavailable, receiver absent, permission denied, package invalid, retry pending.

## M15 — Receive & Review (future verified transfer)

**Purpose:** Import and inspect a protected clinical package on Team B's device.

- **Preconditions:** authorised clinician + compatible transfer channel + validated patient/incident identifiers.
- **Displays:** manifest, incident match, new event count, prior care, integrity/duplicate results.
- **Actions:** Accept Import → local append/merge; Reject Mismatch; Acknowledge later → M16.
- **Critical rule:** don't show imported-history success until validation and durable storage actually succeed.

## M16 — Clinical Handover Acknowledgement

**Purpose:** Capture separate clinical receipt after record review.

- **Fields:** receiving clinician ID, time, source team, acknowledgement, exception notes.
- **Actions:** Confirm Clinical Handover; Continue Care → M12.
- **Rules:** clinical acknowledgement can occur in an emergency without successful digital transfer; statuses must reflect both facts separately.

## M17 — Pending Sync / Transfer

**Purpose:** Make locally saved but not centrally delivered data visible.

- **Content:** incident list, local event count, last verified sync/import, pending reason, retry button only if implemented.
- **Rules:** no auto-success based on a QR scan or button tap.

## M18 — 9-Line MEDEVAC (optional, not day-3 MVP)

**Purpose:** Create an evacuation request separate from the patient medical record.

- **Fields:** nine lines exactly as displayed on the supplied reference image; one request may cover multiple patients.
- **Rules:** access-controlled operational details; confirm abbreviations, classifications and transmission channel with client before implementation.

## M19 — Evacuation Completed

**Purpose:** Close the evacuation record with a reviewable summary (client screen 10).

- **Displays:** casualty identity, triage category, interventions, timeline, handover and transfer status (honest — see M14).
- **Actions:** Next Casualty; Track Case; Summary of Total Evacuation; Generate Report (later).
- **Rules:** "Completed" means the evacuation record is closed on this tablet, not that a digital transfer was received.

---

# Admin Dashboard screens

## A01 — Admin Login

**Purpose:** restricted personnel-enrolment access. Basic demo login only until verified identity/auth infrastructure exists.

## A02 — Dashboard Overview

**Cards:** registered soldiers, issued QR tokens, registered clinicians, recent registrations. Avoid showing sensitive clinical detail on this dashboard.

## A03 — Soldier Registration

**Fields:** approved identity fields (minimum for MVP: fictional name, service identifier, unit, basic demographic data if needed). **Generate:** non-guessable Patient ID and opaque QR token. **Action:** Save → A04.

## A04 — QR Issuance / Print

**Displays:** soldier name/ID, generated QR token, printable QR, issued/revoked status. **Actions:** Mark Issued; Print/Download; Replace (later).

## A05 — Soldier Directory

**Functions:** search/inspect registered identities, QR assignment state; reissue (stretch).

## A06 — Clinician Registration (stretch)

**Fields:** clinician identifier, role, unit, approval state. Genuine verification and device credential issuance are not in the 2–3-day demo.

---

# UI test checklist

- [ ] Navigation matches `APP_FLOW.md`.
- [ ] Landscape layout at 1280 × 800 dp and portrait layout at 800 × 1280 dp; still usable at 960 × 600 dp.
- [ ] Triage always shown with colour **and** text label.
- [ ] Patient and evacuation identifiers never conflated.
- [ ] Invalid QR never displays an arbitrary person's profile.
- [ ] All clinically relevant entries carry observed time + author.
- [ ] Offline records remain visible after restart (once storage implemented).
- [ ] UI never claims an unimplemented transport succeeded.
- [ ] Unknown casualty workflow does not block immediate documentation.
- [ ] Buttons have visible disabled/loading/error states; screen-reader labels tested.
