# CASEVAC — Dashboard ↔ Mobile integration contract (draft)

Status: **not connected.** The dashboard and the mobile app share an identity *format*; there is no live
synchronisation. Generating a QR in the dashboard does not make that patient resolvable on a disconnected phone.

## 1. Shared identifiers

| Concept | Dashboard field | Mobile use |
| --- | --- | --- |
| Patient (person) | `Person.id` (UUID, permanent) | `patientId` on evacuation incidents |
| Admin reference | `Person.displayId` (e.g. `PAT-00012`) | Shown to medics for confirmation |
| Wristband credential | `IdentityCredential.token` (128-bit, base64url) | Read from the QR |
| Evacuation incident | — (mobile only) | `EVAC-…`, never derived from the QR |

## 2. QR payload v1

```text
CASEVAC:1:<token>          token = 22 chars [A-Za-z0-9_-]
```

Mobile parsing rules (mirror `src/lib/domain/qr-format.ts`):

1. Prefix must be `CASEVAC`, otherwise "Not a CASEVAC wristband".
2. Version must be `1`, otherwise "Unsupported wristband version — update the app".
3. Token must match the pattern, otherwise "Invalid code".
4. Look the token up in the **local** identity directory. Not found → "Identity not available offline" (never
   guess or show another profile).

Future NFC wristbands will carry the same token under a new format version, so clinical screens do not change.

## 3. Identity directory format v1

Produced today by `GET /api/integration/identity-directory` (demo, admin session, unencrypted download):

```json
{
  "format": "casevac.identity-directory",
  "formatVersion": 1,
  "generatedAt": "2026-11-12T10:00:00.000Z",
  "dataSource": "DEMO",
  "entries": [
    {
      "token": "…22 chars…",
      "qrFormatVersion": 1,
      "credentialVersion": 2,
      "patientId": "uuid",
      "displayId": "PAT-00012",
      "fullName": "Rahul Sharma",
      "rank": "Sepoy",
      "unit": "2 Demo Rifles",
      "bloodGroup": "B",
      "rhFactor": "POSITIVE"
    }
  ]
}
```

Only ACTIVE soldiers with an ACTIVE credential are included. Revoked/replaced tokens are omitted, so a phone
that refreshes its directory stops resolving them.

## 4. What is needed before phones can use it

1. **Backend** (`../backend`, PostgreSQL) implementing `CasevacRepository` and serving the directory.
2. **Device enrolment & medic authentication** — approved devices download the directory while online.
3. **Encryption** of the cached directory on the phone (key handling per client policy).
4. **Refresh/expiry policy** — how often phones refresh and how revocations propagate.
5. **Mobile changes** — a `QR → token → directory lookup` service and a "directory last updated" indicator.

The mobile app (`../CasevacMobile`) was **not modified** for this milestone.
