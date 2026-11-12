# CASEVAC — UI Design Guidelines

**Design direction:** formal, minimal, calm, clinical, Android-first. **No fancy gradients, animations, decorative illustrations or marketing-style cards.** Use English labels and consistent line-box wireframes in early screens.

## 1. Design principles

1. **Speed under pressure:** primary actions easy to locate; keep field entry short; avoid unnecessary screens before care documentation.
2. **Clear system status:** Offline, Saved Locally, Pending Transfer, Received, Acknowledged mean different things.
3. **Clinical clarity:** labels and units explicit; no accidental hiding of previous treatment/observations.
4. **Privacy by default:** show only required identity fields; use fictional data for prototype screenshots.
5. **Reliable touch interaction:** large buttons, high contrast, explicit error and retry states.
6. **Future-proof scan:** QR now; optional NFC/RFID later without redesigning the clinical screens.

## 2. Foundation tokens (suggested, not mandated)

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#FFFFFF` | Main surfaces |
| Card surface | `#F7F8FA` | Light containment only when needed |
| Primary text | `#1C2630` | Headings/body |
| Secondary text | `#5D6772` | Supporting information |
| Border | `#D3D9DF` | Input/card outlines |
| Primary action | `#244B66` | Limited use for main button |
| Error | `#AA3030` | Form validation / verified error |
| Success | `#24744B` | True confirmed success only |
| Warning | `#8B5B15` | Pending/attention statuses |

**Prefer grayscale for wireframes**; introduce the restrained blue accent in actual functional UI. Never use colour alone to convey status.

## 3. Type and spacing

- Native system sans-serif; headings 20–24, body 14–16, labels 13–14, helper text 12–13 (device units: dp/sp as appropriate).
- Base spacing scale: `4, 8, 12, 16, 24, 32`.
- Minimum practical tap-target area **48 × 48 dp**, including icon controls.
- Normal screen horizontal padding ~16–20 dp; group related fields; maintain consistent line spacing.
- Use visible field labels; placeholders are supplemental, not labels.

## 4. Navigation patterns

- **Login** → **Home** → **Scan QR / Manual ID** → **Patient Profile** → **Start/Resume Incident**.
- During care, maintain an obvious link to **Timeline**, **Add Vitals**, **Add Treatment** and **Prepare Handover**.
- Provide Back/Cancel actions with unsaved-change confirmation.
- Avoid giant multi-step wizards if urgent care requires jumping directly to medication entry.

## 5. Reusable components to build

| Component | Props/role |
| --- | --- |
| `AppHeader` | title, back button, clinician/role when relevant |
| `StatusStrip` | Offline/Online; local save/transfer state |
| `PrimaryButton` | action, loading, disabled |
| `SecondaryButton` | navigation/less urgent actions |
| `FormField` | label, value, helper, error, required |
| `SectionPanel` | restrained bordered grouping |
| `PatientIdentityHeader` | verified person/temporary ID and incident ID |
| `ClinicalEventRow` | observed time, type, author, summary |
| `ConfirmationDialog` | irreversible or potentially harmful navigation |
| `EmptyState` | concise explanation and next action |
| `InlineError` | actionable field/scan/transfer failure message |

## 6. Screen layout examples

### Home (simple text wireframe)

```text
+------------------------------------+
| CASEVAC                      Offline|
| Medic Dashboard                   ⋮ |
+------------------------------------+
| SCAN PATIENT QR                   > |
| Identify an enrolled casualty       |
+------------------------------------+
| ACTIVE EVACUATIONS                > |
+------------------------------------+
| LOCAL RECORDS                     > |
+------------------------------------+
| PENDING TRANSFER / SYNC           > |
+------------------------------------+
```

### Clinical entry

```text
+------------------------------------+
| < VITAL SIGNS               Offline |
| Patient PAT-DEMO-001                |
| Evacuation EVAC-DEMO-001            |
+------------------------------------+
| Observed At      [Date / Time]      |
| Temperature      [value] [°C]       |
| Pulse            [value] [bpm]      |
| BP               [sys] / [dia] mmHg |
| Resp. Rate       [value] [/min]     |
| SpO2             [value] [%]        |
| Stage            [Select]           |
+------------------------------------+
| [ SAVE LOCALLY ]                   |
| [ VIEW TIMELINE ]                  |
+------------------------------------+
```

## 7. State design: truth over polish

| State | Good message | Avoid |
| --- | --- | --- |
| Offline | `Offline — local entries available` | `Connected` without network |
| Saved to SQLite | `Saved on this phone` | `Shared with next team` |
| QR not cached | `Identity not available offline` | Automatically showing random profile |
| Handover prepared | `Summary ready — transfer pending` | `Handover completed` |
| Transfer failed | `Transfer failed; record remains saved locally` | Silent retry/success |
| Received/imported | `Imported and verified on this device` | `Received` when only sender tapped Send |

## 8. Forms and validation

- Keep typed clinical field values until explicit save/cancel; confirm discard for unsaved edits.
- Numeric inputs require clearly indicated units and sensible formatting; do not hardcode medical threshold advice without clinical validation.
- Present time of observation separately from time of data entry.
- Allow `Unknown`/`Not recorded` where clinically approved, instead of fabricating a default value.
- Show edit/correction attribution and audit notes in follow-up implementation.
- Use built-in text scaling, adequate contrast and device screen-size testing.

## 9. QR and future RFID design

Current scan screen prioritises camera QR with manual ID fallback. Abstract identity source as `QR | MANUAL | NFC_FUTURE`. Later NFC will be a new input method, not a different patient database or treatment workflow. Do not put medical history into printed static patient QR.

## 10. Assets and privacy

- Reuse a simple line-style body map when ready; clinical markings must be reviewed.
- Avoid personal/operational photographs, live coordinates and real patient data in development assets.
- Keep screenshots, demo data and Figma prototypes clearly labelled **synthetic / demonstration only**.

## 11. UI sign-off checklist

- [ ] Screen has a clearly stated task and most important action.
- [ ] Labels, units and author/time information are unambiguous.
- [ ] Active patient and incident identifiers remain visible on clinical pages.
- [ ] Offline/transfer state is accurate and readable without relying on colour.
- [ ] Emergency care can proceed without a valid wristband.
- [ ] Failure messages are actionable, not technical stack traces.
