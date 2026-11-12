# CASEVAC — Screen Specifications

**Purpose:** Implementation contract for basic React Native Android UI plus minimal admin dashboard.  
**UI character:** clean, formal, low-distraction, English labels.  
**States:** `MVP` build now; `STRETCH` if time; `DEFERRED` after validation.  
**Clinical disclaimer:** data fields drawn from AFMSF-21 are reference fields; clinical team must approve required/optional status and terminology.

## General screen conventions

- Every screen: clear title; Back where appropriate; visible Offline/Online status; errors in plain language.
- All save actions: validate → persist → show saved status. Disable duplicate submit while saving.
- Forms: accessible labels, date/time when observed, author attribution, explicit units, required-field messages.
- User may leave and return without losing already committed records.
- Sensitive information should only display after appropriate authorisation. Never use real soldier/medical data in screenshots.
- Prefer modular forms to a single enormous clinical page. Include emergency-first shortcuts where medically approved.

## Mobile navigation summary

| ID | Screen | Priority | Entry from |
| --- | --- | --- | --- |
| M01 | Medic Login | MVP | App startup |
| M02 | Home | MVP | Login |
| M03 | Scan Patient QR / Manual ID | MVP | Home |
| M04 | Patient Profile & Incident Choice | MVP | Scan / manual lookup |
| M05 | Unknown Casualty | MVP | Scan failure / Home |
| M06 | Start / Resume Evacuation | MVP | Patient / unknown casualty |
| M07 | Initial Assessment | MVP | Incident |
| M08 | Injury Details | STRETCH | Initial Assessment |
| M09 | Vital Signs | MVP | Incident / Timeline |
| M10 | GCS Assessment | MVP | Incident / Timeline |
| M11 | Treatment / Intervention | MVP | Incident / Timeline |
| M12 | Clinical Timeline | MVP | Incident / saved entry |
| M13 | Prepare Handover | MVP | Timeline |
| M14 | Transfer Options / Pending | MVP | Handover |
| M15 | Receive & Review Record | DEFERRED for real import | Verified inbound transfer |
| M16 | Clinical Handover Acknowledgement | DEFERRED or labelled demo | Receive & Review |
| M17 | Pending Sync / Transfer | STRETCH | Home |
| M18 | Optional 9-Line MEDEVAC Request | DEFERRED | Separate coordination module |

## M01 — Medic Login

**Purpose:** Enter authorised clinical workflow.

- **Fields:** clinician identifier; password/MPIN only as appropriate for chosen prototype; visible Demo Mode tag if mocked.
- **Actions:** Sign In, optional Device Unlock (future), Help.
- **Validations:** missing credentials; invalid demo account; network not required for an already provisioned offline session (later).
- **Next:** M02 Home.
- **Security note:** do not claim a fingerprint unlock alone proves clinician credentials; production requires enrolment, roles and revocation design.

## M02 — Home

**Purpose:** Quickly begin casualty documentation or resume active work.

- **Content:** Scan Patient QR (primary action); Active Evacuations; Local Patient Records; Pending Transfers/Sync; current clinician, Offline indicator.
- **Actions:** Scan QR → M03; open ongoing incident → M12; open pending list → M17.
- **Empty states:** No active evacuations; no cached identities; sync unavailable.

## M03 — Scan Patient QR / Manual ID

**Purpose:** Read permanent patient identity token, not clinical history.

- **Fields:** camera preview with scan guide; manual Patient ID input; optional torch toggle.
- **Actions:** Scan; Enter ID; Unknown Casualty → M05; Cancel.
- **Validations:** camera denied, invalid token, unknown token, ambiguous match, identity unavailable offline.
- **Next:** valid and available identity → M04. QR alone cannot pull Team A's unsynced notes from Phone B.

## M04 — Patient Profile & Incident Choice

**Purpose:** Confirm correct person and select current evacuation.

- **Display (as available):** name, service ID, unit, age/sex, blood group and Rh, relevant history, identity verification status; minimise sensitive fields.
- **Actions:** Start New Evacuation → M06; Resume Active Incident → M12; Back; Flag Mismatch.
- **Rules:** each new casualty episode gets its own incident ID; patient ID persists.

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
- [ ] Patient and evacuation identifiers never conflated.
- [ ] Invalid QR never displays an arbitrary person's profile.
- [ ] All clinically relevant entries carry observed time + author.
- [ ] Offline records remain visible after restart (once storage implemented).
- [ ] UI never claims an unimplemented transport succeeded.
- [ ] Unknown casualty workflow does not block immediate documentation.
- [ ] Buttons have visible disabled/loading/error states; screen-reader labels tested.
