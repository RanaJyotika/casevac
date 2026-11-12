# CASEVAC — Dashboard ↔ Mobile integration contract (draft)

Status: **offline verification works; live provisioning does not exist yet.** Phones verify the dashboard's
digital signature on a wristband QR without any network. Patient details and revocations reach a phone only
through a *demo* provisioning step (`npm run mobile:provision`) that writes files into the app source. There is no
backend, device enrolment or encrypted directory download yet.

## 1. Shared identifiers

| Concept | Dashboard field | Mobile use |
| --- | --- | --- |
| Patient (person) | `Person.id` (UUID, permanent) | `patientId` inside the signed QR; future evacuation incidents |
| Admin reference | `Person.displayId` (e.g. `PAT-00012`) | Shown to medics for confirmation |
| Wristband credential | `IdentityCredential.id` (UUID) | `credentialId` inside the signed QR; revocation lookup |
| Issuer signing key | `CASEVAC_QR_ISSUER_KEY_ID` | `keyId` → trusted public key on the phone |
| Evacuation incident | — (mobile only) | Never derived from the QR |

## 2. QR payload v2 (signed)

```text
CASEVAC:2:P:<keyId>:<credentialId>:<patientId>:<credentialVersion>:<issuedAt>:<signature>
```

| Field | Format |
| --- | --- |
| `P` | Credential type: CASEVAC_PATIENT |
| `keyId` | `[a-z0-9][a-z0-9-]{0,31}` |
| `credentialId`, `patientId` | lower-case UUID |
| `credentialVersion` | integer 1–999999 (per-patient issue sequence) |
| `issuedAt` | Unix seconds, UTC, 10 digits |
| `signature` | Ed25519, base64url without padding, 86 chars (canonical encoding only) |

**Signed bytes:** the exact ASCII text before the final `:`. The whole payload must match one anchored pattern,
so each set of claims has exactly one encoding and nothing is re-serialised before verification. About 200
characters, comfortably within a printable QR.

The payload carries no name, service number, contact or medical data. Implementations:
`src/lib/domain/qr-format.ts` + `src/lib/crypto/qr-issuer.ts` (dashboard, Node `crypto`) and
`CasevacMobile/src/services/qr/` (phone, `@noble/curves`). Both test suites pin the same test vector.

### Mobile decision order (all offline)

1. Not `CASEVAC:` → "Unrecognised QR code". `CASEVAC:1:<token>` → "Unsigned wristband — reissue".
   Other version → "Unsupported QR version". Bad syntax → "QR read error".
2. `keyId` not in the phone's trusted keys → "Unknown issuer".
3. Signature invalid → "Invalid QR signature" (forged or altered).
4. Directory lists the credential as REVOKED / REPLACED → rejected. Directory record names a different
   patient, key or version → "Patient record mismatch".
5. Otherwise verified. Details shown only if the directory has them; else
   **"Credential Verified — Patient Details Unavailable Offline"**. Nothing is guessed.

A valid signature proves the dashboard issued the credential. It does not prove the credential is unrevoked
(revocation is only as fresh as the phone's directory) or that the wearer is that person.

### Legacy v1

`CASEVAC:1:<token>` (unsigned) is no longer issued and is rejected by the app. Reissue such QR codes from the
soldier's profile; the dashboard marks them "Unsigned legacy QR".

## 3. Issuer key (development)

`npm run issuer:keygen` generates an Ed25519 key into `.env.local` (git-ignored) as
`CASEVAC_QR_ISSUER_KEY_ID` and `CASEVAC_QR_ISSUER_PRIVATE_KEY` (PKCS#8 DER, base64url). The private key is used
only server-side and is never printed or sent to the browser. Without it, registration and QR issuance fail with
a clear message; an unsigned QR is never produced.

Rotation: `npm run issuer:keygen -- --key-id dev-issuer-02 --force`, restart the dashboard, reissue QR codes,
re-provision phones. Phones currently trust only the keys in their provisioned file.

**Production requires** a protected signing service (HSM/KMS or isolated signer), an approved process for
distributing trusted public keys to phones, and a key rotation/retirement policy.

## 4. Provisioning files (demo)

`npm run mobile:provision` writes two files into `CasevacMobile/src/provisioning/` (Metro bundles them):

`trusted-issuer-keys.json`: public keys only.

```json
{ "format": "casevac.trusted-issuer-keys", "formatVersion": 1,
  "keys": [{ "keyId": "dev-issuer-01", "issuer": "CASEVAC_ADMIN", "algorithm": "Ed25519", "publicKey": "<32 bytes base64url>" }] }
```

`demo-identity-directory.json`: also served by `GET /api/integration/identity-directory` (admin session).

```json
{
  "format": "casevac.identity-directory", "formatVersion": 2, "generatedAt": "…", "dataSource": "DEMO",
  "patients": [{ "patientId": "uuid", "displayId": "PAT-00012", "fullName": "…", "rank": "…", "unit": "…",
                 "bloodGroup": "B", "rhFactor": "POSITIVE" }],
  "credentials": [{ "credentialId": "uuid", "patientId": "uuid", "keyId": "dev-issuer-01", "credentialVersion": 2,
                    "status": "ACTIVE | REVOKED | REPLACED", "issuedAt": "…", "revokedAt": null }]
}
```

`patients` lists only ACTIVE soldiers with an ACTIVE signed credential. `credentials` lists every signed soldier
credential, including revoked and replaced ones, so phones can reject them offline. Each run is audit-logged.

These files are bundled, unencrypted and editable by anyone who can rebuild the app. They stand in for real
provisioning and are **not authoritative**. Use fictional records only: the files are committed with the app.

## 5. Still needed before real use

1. **Backend** (future MongoDB service) implementing `CasevacRepository` and serving the directory + trusted keys.
2. **Device enrolment & medic authentication**: approved devices download the directory while online.
3. **Encryption** of the cached directory on the phone (key handling per client policy).
4. **Refresh/expiry policy**: how often phones refresh, how revocations propagate, what to show when stale.
5. **Mobile**: replace `bundledDemoProvisioning.ts` with a backend-provisioned `TrustStore` /
   `IdentityDirectory` (interfaces in `src/services/identity/types.ts`). Screens do not change.
