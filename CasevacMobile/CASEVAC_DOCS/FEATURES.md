# CASEVAC — Feature Catalogue

**Baseline:** QR-first, **Android tablet, landscape-first with portrait support** ("Jeevan"), demonstration build. Client UI update 12 Nov 2026.  
**Legend:** `MVP-P0` essential for core demo, `MVP-P1` stretch, `SPIKE` technical experiment, `LATER` not in basic sprint.

## 1. Web Admin Dashboard

| Feature | Priority | Behaviour / notes |
| --- | --- | --- |
| Admin sign-in | MVP-P0 | Demo auth only initially; production needs audited identity verification |
| Register soldier/person | MVP-P0 | Personnel fields and generated random patient ID |
| Generate/issue QR | MVP-P0 | Opaque token; display, print/download QR and assignment status |
| Patient directory | MVP-P0 | Search by permitted identity fields / ID |
| Register clinician | MVP-P1 | Name, clinician identifier, unit/role, active status |
| QR replacement/revocation | MVP-P1 | Rotate token on loss; prevent duplicate active assignment |
| Device management | LATER | Approve devices and credentials |
| RFID provisioning | LATER | Secure writable NFC chip workflow, no hardware yet |
| Audit/admin reports | LATER | Real roles, traceable changes, monitoring |

## 2. Medic Tablet App (Jeevan, landscape)

| Feature | Priority | Behaviour / notes |
| --- | --- | --- |
| Login / demo unlock | MVP-P0 | Split layout: branding + instructions / login box. User ID, password, forgot-password placeholder; clear demo mode |
| App shell | MVP-P0 | Top bar (app name, page title, offline/sync status, clinician, log out) + left module navigation |
| Home command dashboard | MVP-P0 | Built with demo data. Quick actions (Scan Patient QR, Enter Patient ID, Temporary Evacuation); summary cards (Total, RED, YELLOW, GREEN, BLACK, Active, Pending handover, Completed); company-wise stacked bar; triage horizontal bar; recent activity; evacuation status flow |
| Triage category | MVP-P0 | RED / YELLOW / GREEN / BLACK as large selectable cards; colour + text label always |
| Consciousness decision | MVP-P1 | Yes → initial assessment; No → temporary registration |
| Prepare evacuation | MVP-P1 | Date/time, assisting staff, condition, mode (ambulance / helicopter / stretcher) |
| Evacuation completed summary | MVP-P1 | Casualty, triage, interventions, timeline; next casualty / track / report actions |
| Scan QR | MVP-P0 | Camera permission, valid/invalid/unknown token states |
| Manual lookup | MVP-P0 | Manual Patient ID; show not-cached/not-authorised status |
| Unknown casualty | MVP-P0 | Generate temporary ID and begin care offline |
| Patient profile | MVP-P0 | Minimal identity fields, relevant history if available |
| Start/resume incident | MVP-P0 | Fresh evacuation ID vs continuation of existing incident |
| Initial assessment | MVP-P0 | Time, care stage, priority, injury/provisional diagnosis |
| Injury details | MVP-P1 | Basic front/back body-location markers; more detailed annotation later |
| Vitals entry | MVP-P0 | Time-stamped temperature, pulse, BP, respiration, SpO2 |
| GCS entry | MVP-P0 | E/V/M selections, total calculation, observation time |
| Treatment entry | MVP-P0 | IV fluids, analgesics, antibiotics, other medication, interventions |
| Clinical timeline | MVP-P0 | Append-only entries; source, time, clinician; chronological list |
| Handover preparation | MVP-P0 | Patient/incident confirmation, clinical summary, intended receiver |
| Transfer status | MVP-P0 | Pending / sent / received / acknowledged without simulated success |
| Local offline storage | MVP-P0 | Persist and reopen after app restart; no network dependence |
| Real direct import | SPIKE | Authenticated, encrypted package; two-phone tests required |
| Server sync | LATER | Outbox, retry, merge and conflict resolution |
| Photos | LATER | Client-approved storage, size and privacy policy |

## 3. Offline transfer feature experiments

**Important:** QR scanning is identification, not transmission of another phone's unsynced events.

| Mode | What to prove | Constraints to investigate |
| --- | --- | --- |
| Bluetooth | Secure discovery, pairing/authorised receiver, package delivery, receipt | Android permissions, throughput, nearby access rules |
| Wi-Fi Direct | Local peer connection without internet, secure transfer, rollback/retry | Device APIs, supported hardware, restrictions, negotiation latency |
| USB | Data transfer between authorised devices or via approved physical medium | USB host/accessory modes, supported connectors, cable, drivers, client policy |

Choose **one** direct transfer method for first real prototype after a time-boxed spike; do not imply all three are simultaneously implemented. In the 2–3-day demo, a well-marked **Transfer Pending** state is acceptable.

## 4. Medical field features based on AFMSF-21

- Patient personnel details and relevant past history (PDF p.1).
- Tourniquet applied/released, Inj TT, reporting time, priority and provisional diagnosis (p.1).
- Front/back body diagrams for injury location (p.2).
- Repeated temperature, pulse, blood pressure, respiratory rate, SpO2 with stage/time (p.2).
- Glasgow Coma Scale eye/verbal/motor plus total, complaints and findings (p.3).
- IV fluids, analgesics, antibiotics, other drugs, medical officer attribution and stage-specific treatment (p.4).

Digital field validation, diagnosis vocabularies, care-stage naming and required fields must be confirmed with clinicians.

## 5. Evacuation coordination — optional module

**General 9-Line MEDEVAC** is a separate request form. Capture lines 1–9 only if client signs it into scope. Keep operational coordination data separate from patient QR payload and clinical timeline; access should follow approved policy.

## 6. Feature flags / simulated components

For the first UI implementation, keep explicit capability flags in development (for example, `enableRealTransfer`, `enableServerSync`, `enableNfc`). A feature not implemented must show **Unavailable / Demo / Coming later**, not a success banner. Never ship mock credentials or mock clinical history as real functionality.

## 7. Tablet UI rules (client, 12 Nov 2026)

Landscape (primary) and portrait · large touch targets · bordered boxes and sections · font sizes readable from a distance · minimal
scrolling · side-by-side layouts · dashboard home · fast access under pressure. Details and frozen values:
`UI_DESIGN_GUIDELINES.md` v2.

## 8. Minimum meaningful demo sequence

`Register fictional Soldier → Issue QR → Scan on tablet → Start Incident → Save Assessment → Save Vitals → Record Treatment → View Timeline → Prepare Handover → Display accurate pending status`.

Once that works reliably, build the admin directory and clinician registration polish, then consider one real transfer spike.
