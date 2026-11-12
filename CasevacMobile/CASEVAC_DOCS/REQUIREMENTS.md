# CASEVAC — Requirements and Scope

**Version:** MVP draft v0.1 · **Last revised:** 12 November 2026  
**Classification:** Product working draft; not a clinical specification or approval.

## Requirement status key

- **Baseline:** agreed project direction from discussion; still subject to formal acceptance.
- **Document-derived:** field/format appearing in user-supplied AFMSF-21 or 9-Line reference.
- **Proposed:** suggested engineering/UX behaviour; requires confirmation.
- **Deferred:** not in 2–3-day basic build.

## A. Baseline functional requirements

| ID | Requirement | Priority | Status / acceptance evidence |
| --- | --- | --- | --- |
| FR-01 | Admin can register fictional soldier/person profile | P0 | Baseline; form + persisted ID |
| FR-02 | System generates unique, non-guessable patient ID and separate QR token | P0 | Baseline; uniqueness test; token has no clinical data |
| FR-03 | Admin can view, issue, reissue and revoke QR assignment | P1 | Proposed; basic issue for demo |
| FR-04 | Admin can register medic/clinician identity and role | P1 | Baseline; demo accounts are not actual verified credentials |
| FR-05 | Medic can use demo authentication and role-gated screens | P0 | Baseline; security is mock until production integration |
| FR-06 | App can scan QR through phone camera | P0 | Baseline; on-device tested |
| FR-07 | Manual ID entry and unknown casualty fallback | P0 | Baseline; temporary ID created offline |
| FR-08 | App distinguishes person ID from new evacuation incident ID | P0 | Baseline; new event sequence per incident |
| FR-09 | Medic can record clinical assessment and injury locations | P0 | AFMSF-21-informed; basic fields in demo |
| FR-10 | Medic can repeatedly record vital observations | P0 | AFMSF-21-derived; timestamped records |
| FR-11 | Medic can record Glasgow Coma Scale components | P0 | AFMSF-21-derived; calculated total, preserve component scores |
| FR-12 | Medic can record medications and interventions | P0 | AFMSF-21-derived; drug category, dose/time/author |
| FR-13 | App persists records offline through restart | P0 | Baseline; test with airplane mode enabled |
| FR-14 | Timeline displays entries chronologically without overwriting past events | P0 | Baseline; repeated-entry test |
| FR-15 | App generates reviewable clinical handover summary | P0 | Baseline; data drawn from active incident |
| FR-16 | App distinguishes handover preparation, digital receipt and clinical acknowledgement | P0 | Baseline; no false success claim |
| FR-17 | Attempt secure direct transfer via Bluetooth / Wi-Fi Direct / USB | P2 | Proposed feasibility spike; not promised in 3 days |
| FR-18 | Receive, validate, import and de-duplicate transferred events | P2 | Proposed; required for real transfer claim |
| FR-19 | Sync to central server when authorised connectivity returns | P2 | Planned; not an automatic day-3 deliverable |
| FR-20 | Support secure NFC/RFID identification/rewriting | Future | Deferred until hardware selected |
| FR-21 | Optional 9-Line MEDEVAC request form | P2 | Document-derived fields, module inclusion requires client decision |

## B. AFMSF-21 clinical field mapping

This is a *source-informed starting dictionary* from the four-page client PDF; confirm labels, mandatory rules and clinical workflows with designated subject-matter experts.

| PDF page | Recorded content | Proposed digital handling |
| --- | --- | --- |
| 1 | Service details, name, unit, age, sex, religion, address, blood group/Rh, medical category, marks, next of kin | Patient profile with access controls and minimised offline cache |
| 1 | Past medical history, tourniquet applied/released, Inj TT, reporting time, provisional diagnosis, priority at RAP/ADS | Structured initial assessment and interventions, timestamped |
| 2 | Front/back injury diagrams | Injury-location selection; optional marks/annotations in full version |
| 2 | Date/time, temperature, pulse, BP, respiratory rate, SpO2 at care stages | Repeatable vitals events, not one mutable row |
| 3 | GCS eye, verbal, motor, scores by RAP/ADS/FSC; complaints/findings | Repeatable neuro observations plus notes |
| 4 | IV fluids, analgesics, antibiotics, other drugs, stage-labelled treatment, medical officer signature/unit | Medication/intervention events and authenticated author/acknowledgement |

**Open terminology:** some sections use `FAC`, others `FSC`; don't silently equate those care-stage labels. The document does not itself prescribe a mobile UI, API, QR format, cryptography or RFID storage scheme.

## C. General 9-Line MEDEVAC reference

The supplied image depicts nine operational request lines: (1) pickup grid/GPS/map, (2) frequency/call sign, (3) number/name and priority, (4) special equipment, (5) casualty types, (6) pickup-site security, (7) site marking, (8) nationality/status, (9) NBC contamination/terrain. **This is evacuation coordination, not the AFMSF-21 clinical chart.** Client to confirm whether digitised 9-Line is in scope. Do not include sensitive radio or pickup operational details in static QR tokens.

## D. Non-functional requirements

| ID | Requirement | Prototype expectation | Production expectation |
| --- | --- | --- | --- |
| NFR-01 | Offline availability | Local forms & records usable without network | Secure key/session policy, durable storage under failure |
| NFR-02 | Data integrity | No missing/duplicate local events in test dataset | Tamper-evident, versioned audit/event processing |
| NFR-03 | Privacy | Fictional data only; avoid logging clinical payload | Encrypt at rest/in transit; data minimisation; verified device policy |
| NFR-04 | Security | Role-shaped UI, explicit mock auth label | Verified credentials, access policies, revocation/offline expiry |
| NFR-05 | Accessibility | Readable type, large tap targets, clear validation | Field usability and accessibility review |
| NFR-06 | Reliability | Restart persistence & cancelable dialogs | Recovery from power loss, interrupted transfer and corrupt data |
| NFR-07 | Traceability | event_id, author, observed_at, recorded_at | Signed/authenticated events and full audit trail |
| NFR-08 | Hardware | Test QR scanner on one Android device | Validate supported Android models and transfer radios |
| NFR-09 | Handover safety | Distinguish saved/transfer pending/acknowledged | Verifiable import, read-back and recipient acknowledgement |

## E. Core data constraints

- **Patient ID** remains stable; **Evacuation ID** is new for each incident.
- QR contains an opaque random token mapped to the Patient ID; do not encode patient name/medical data as the default.
- **Event** has an id, incident id, type, payload, clinician id, observation time, record time, and source device.
- **Handover** has sending/receiving identities, intended destination, status, summary, and separate transmission/import/ack timestamps.
- Corrections are attributable *new events*; avoid silent mutation of historical entries.
- A patient may be unknown at Point A; temporary ID can later be merged with verified identity through a controlled reconciliation process.
- Without network or direct transfer, Team B's device cannot derive Team A's unsynchronised notes from the patient QR.

## F. Explicitly deferred / outside MVP

- Real-world deployment with patient data, hospital inpatient management, live military communication fields, AI clinical advice.
- Automatic cross-device history from static QR, untested Bluetooth/Wi-Fi Direct/USB transfer, certified biometric identity verification.
- Secure NFC wristband data carriage; RFID purchase and read/write validation not yet complete.
- Fully integrated online sync, mature conflict resolution and organisational credential lifecycle in a 2–3-day sprint.

## G. MVP acceptance criteria (synthetic data only)

1. Register two fictional people; demonstrate distinct IDs and unique printable QR tokens.
2. Scan QR on Android; resolve correct record if the identity directory is accessible or cached; show a clear error if not.
3. Start a separate incident for a patient already known to the system.
4. Add at least two vitals events, one GCS observation and one treatment; see author/time in timeline.
5. Disable internet, restart app and reopen committed local entries.
6. Prepare handover and show **Pending digital transfer** until an actual import succeeds.
7. Unknown casualty can start urgently without QR and later be linked by authorised reconciliation.
8. Optional transfer proof requires two devices, protected package, mismatch rejection, de-duplication and explicit receiving acknowledgement.

## H. Client decisions needed

- Clinical required fields and care-stage definitions (RAP/ADS/FAC/FSC); signatures and GCS rules.
- Whether to include 9-Line MEDEVAC and who may see its operational details.
- Which organisation approves medics, offline access, phone models and service locations.
- First allowed transfer mode (Bluetooth vs Wi-Fi Direct vs USB) and security constraints.
- Whether cloud/backend may contain sensitive data, hosting policy, data retention and audit requirements.
- Which features constitute the client's *approved* MVP vs demonstration-only mockups.
