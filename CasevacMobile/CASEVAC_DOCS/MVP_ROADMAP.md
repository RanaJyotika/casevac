# CASEVAC — MVP Build Roadmap

**Goal:** Deliver a visible **2–3-day basic demonstration** of QR-based personnel registration, Android clinical record entry and a handover summary.  
**Important:** This is a sprint target for *basic UI and local prototype behaviour*, **not** a guaranteed secure multi-device / production medical deployment. The earlier client pack treats controlled offline-transfer validation and clinical/security sign-off as later work.

## Client UI update — tablet landscape (12 Nov 2026)

The client now requires a **tablet-first, landscape-only** app named **Jeevan** with a command-dashboard home
(`UI_DESIGN_GUIDELINES.md` v2, `REQUIREMENTS.md` FR-22–FR-32). App logic is unchanged; layouts change.

| Order | Task | Status |
| --- | --- | --- |
| 1 | Freeze the tablet layout system (sidebar 240 dp, top bar 64 dp, type scale, card style, chart placement) | Proposed values in UI guide §4 — **awaiting client approval** |
| 2 | Redraw the client's 10 screens as landscape wireframes | To do |
| 3 | Design tokens + tablet-sized inputs/buttons; landscape + portrait layouts (lock removed 13 Nov 2026) | Done (login and Home verified in both orientations) |
| 4 | Login screen — split layout | Done |
| 5 | App shell (TopBar, SideNav) + Home dashboard (cards, charts, activity, quick actions, manual ID entry) | Done with fictional demo data; real figures need evacuation storage with triage + company |
| 6 | Restyle Scan QR and Patient Details into split layouts | After Home |
| 7 | Clinical screens 4–10 in two-column / card layouts | With Phase 3 clinical records |

## 0. Work that is already underway

- React Native CLI project `CasevacMobile` has been generated on a Windows development machine.
- Node.js 24, JDK 17 and ADB were verified in PowerShell.
- Wireless ADB pairing failed due to observed local network reachability; a physical USB-debugging route or an alternate trusted Wi-Fi is a fallback.
- **Android SDK Platform / Build-Tools / command-line tools still need verification.** ADB alone cannot compile the app.
- No claim is made that the first APK has run successfully yet.

## Day 1 — Development foundation + first end-to-end QR identity flow

**Goal:** React Native starter app runs on real phone; dashboard can register a fictional person and issue a QR; app scan screen can decode QR.

| Order | Task | Deliverable / acceptance |
| --- | --- | --- |
| 1 | Verify Android SDK, Gradle/JDK, `adb devices` | Debug app builds and installs, physical device detected |
| 2 | React Native project folders & navigation | Login, Home, Scan/Manual ID, Patient Profile routes |
| 3 | Minimal reusable components | Header, button, field, status label |
| 4 | Next.js dashboard bootstrap | Dashboard loads locally |
| 5 | Soldier registration form | Fictional soldier profile saved (backend or labelled demo repository) |
| 6 | Unique patient ID + random QR token | Printable QR; not patient medical data |
| 7 | QR scanner integration | Scan decoded token shown; matches available fictional identity |

**Client update after passing checks:** “Android app foundation and admin enrolment flow implemented. Demonstrated synthetic patient registration, QR issuance and scan on a test phone.” If a build/hardware step fails, report that step as blocked rather than completed.

## Day 2 — Offline clinical data and patient journey

**Goal:** Start an evacuation and build an observable medical event timeline using fictional data.

| Order | Task | Deliverable / acceptance |
| --- | --- | --- |
| 1 | Basic patient/incident data model | Patient ID separate from Evacuation ID |
| 2 | Local SQLite repository | Create, read and reopen locally saved incidents/events |
| 3 | Initial Assessment form | Provisional diagnosis, priority, basic injury/time, local save |
| 4 | Vitals form | Repeatable time-stamped temperature, pulse, BP, respiration, SpO2 |
| 5 | GCS form | Eye/verbal/motor components and total |
| 6 | Treatment form | Medication category, dose/time, clinician, intervention |
| 7 | Timeline | Every event displayed with type, time and author |
| 8 | Unknown casualty fallback | Temporary ID and new incident without a QR |

**Client update:** “Core AFMSF-21-inspired assessment, vitals, GCS, treatment and chronological history screens are functional with synthetic offline records.” Report persistence as complete only after the airplane-mode/restart test passes.

## Day 3 — Handover summary, consistency and demo packaging

**Goal:** Show Point A → Point B documentation flow with **honest transfer-state handling**.

| Order | Task | Deliverable / acceptance |
| --- | --- | --- |
| 1 | Handover summary | Latest clinical details and complete incident timeline summary |
| 2 | Receiving team identification | Recipient details / clinical handover note captured |
| 3 | Transfer status flow | Prepared → Pending; never claim received without import |
| 4 | Basic admin directory & clinician registration | Find fictional personnel; role/status display |
| 5 | End-to-end smoke test | Register → QR → Incident → Care → Timeline → Handover |
| 6 | Offline persistence test | Turn off network; restart app; records remain available |
| 7 | Demo build / walkthrough | Installable dev APK and video/screenshots using fictional cases |
| 8 | Hardware spike (only if feasible) | Prototype one transfer channel on two devices; otherwise explicitly deferred |

**Client update:** “Demonstrated QR-based identification, offline care timeline and prepared handover. Real cross-device direct transfer is [verified / experimental / pending] according to test evidence.”

## Prioritisation if only 2 days are available

- **Day 1:** running app, dashboard registration and QR issuance, scan/manual lookup, patient/incident screens.
- **Day 2:** local persistence, assessment/vitals/treatment, timeline, handover *pending* state and smoke test.
- Defer separate GCS UI, polished body diagram, advanced role management, complete server sync, 9-Line module and Bluetooth/Wi-Fi Direct/USB integration if time constrained. Record all deferrals in the client update.

## Follow-up phases (not promised inside 3 days)

| Phase | Focus | Definition of done |
| --- | --- | --- |
| Phase 2 — Secure transfer feasibility | Test Bluetooth vs Wi-Fi Direct vs USB on actual approved devices | Two-phone transfer, authentication, encryption, identity matching, retry and duplicate handling |
| Phase 3 — Backend & sync | API, PostgreSQL, sync outbox, conflict/reconciliation | Controlled server round-trip and versioned audit |
| Phase 4 — Identity/security | Real verified medics, offline session policy, provisioning, local encryption/key handling | Security review and field test |
| Phase 5 — Clinical validation | Complete AFMSF-21 data dictionary, GCS, injury body map, handover sign-off | Client clinician approval and scenario testing |
| Phase 6 — RFID/NFC | Secure writable wristband selection, device support and read/write proof | Capacity, protected access, interruption testing and verified data carry |
| Phase 7 — Optional 9-Line | Separate evacuation coordination request module | Client-approved fields and controls |

## Dependency / risk tracker

| Risk | Immediate workaround | Escalate to client when |
| --- | --- | --- |
| Wireless ADB not pairing on current Wi-Fi | Use USB debugging temporarily or alternate trusted network | Approved radio/network policy restricts testing |
| Android SDK incomplete | Install SDK platform, build-tools and command-line tools | Device/OS cannot support targeted build |
| Admin dashboard not linked to app | Use explicit synthetic fixture/mock API **labelled demo** | Live online identity lookup required for acceptance |
| Identity unavailable offline | Preload a permitted fictional local identity directory | Client expects unprovisioned offline lookup |
| Transfer method not ready | Clearly show `DIGITAL_TRANSFER_PENDING` | Client expects full two-phone proof in sprint |
| Sensitive data handling undecided | Use synthetic patient data only | Real users/records requested |
| Clinical data field definitions uncertain | Mark source-informed and request clinician review | Before release or real clinical use |

## Demo script and evidence

1. On web dashboard, register **fictional** Soldier A and print/display QR.
2. On Android, scan QR and show correct locally available identity.
3. Start **EVAC-001** for that person.
4. Record an injury/assessment, two different vitals events, GCS and one treatment.
5. Turn internet off, restart app and re-open timeline.
6. Prepare handover for fictional Team B; display `Digital Transfer Pending`.
7. If Phase-2 spike passed, demonstrate actual protected package import and separate recipient acknowledgement; otherwise explain the limitation.
8. Show current backlog, tests and next sprint commitments.

## Sprint completion checklist

- [ ] Android app builds on a real device.
- [ ] Dashboard loads and creates distinct demo patient IDs.
- [ ] QR holds opaque identifier and decodes on phone.
- [ ] Offline identity availability/miss states are correct.
- [ ] Patient and incident IDs are separate.
- [ ] Clinical events are saved and re-opened after restart.
- [ ] Timeline shows repeated observations and treatment, with timestamps.
- [ ] Handover summary accurately reflects stored care.
- [ ] `Transfer Pending` is not shown as `Received`.
- [ ] Demonstration uses fictional records only.

## Daily client update template

```text
CASEVAC — [Day X] Update
Completed (verified):
- ...
Demonstrated:
- ...
Blocked / dependent on hardware or policy:
- ...
Next milestone:
- ...
```

**Definition of “done”:** feature implemented **and tested** with visible evidence; wireframe, mock-up, or unexecuted code alone is not complete.
