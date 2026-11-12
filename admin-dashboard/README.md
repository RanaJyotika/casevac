# CASEVAC — Web Admin Dashboard (MVP, demo mode)

Administrative web app for the CASEVAC Digital Evacuation Program: register soldiers (patient identities),
medics, doctors and other personnel, issue opaque QR wristband identifiers, and manage medical teams.

> **Demo build.** Authentication is mocked, data lives in a local JSON file, and only fictional records may be
> used. Nothing here is approved for real personnel or medical data. Clinical care, incidents and handover live
> in the mobile app (`../CasevacMobile`), not here.

## Quick start (Windows / PowerShell)

```powershell
cd "E:\vedic vaibhav\casevac\admin-dashboard"
npm install
# .env.local already exists on the development machine; elsewhere:
copy .env.example .env.local   # then set CASEVAC_SESSION_SECRET and DEMO_ADMIN_PASSWORD
npm run dev                     # http://localhost:3000
```

Sign in with `DEMO_ADMIN_ID` / `DEMO_ADMIN_PASSWORD` from `.env.local`.
Settings → **Load fictional sample records** fills an empty store with demo data.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint |
| `npm test` | Service-layer tests (Vitest, temp data files) |

## Pages

| ID | Route | Purpose |
| --- | --- | --- |
| D01 | `/login` | Demo administrator sign-in |
| D02 | `/dashboard` | Live counts, recent registrations, pending actions, activity |
| D03 | `/personnel` | Search & filter (type, role, unit, status) |
| D04 | `/register/soldier` | Register soldier → Patient ID + QR |
| D05 | `/personnel/[id]` | Profile, QR card, print/download, reissue, revoke, history |
| — | `/personnel/[id]/edit` | Edit permitted fields (service number locked) |
| D06 | `/register/staff` | Medic / doctor / other personnel with role & team |
| D07 | `/teams`, `/teams/[id]` | Create teams, leader, members, activate/deactivate |
| D08 | `/qr` | All QR records, awaiting wristband, revoked, soldiers without QR |
| D09 | `/roles` | Role definitions and permission matrix |
| D10 | `/settings` | System status, mobile integration, demo data, sign out |
| — | `/print/qr/[credentialId]` | Printable wristband label (display ID + QR only) |
| — | `/api/qr/[credentialId]/png` | QR PNG download (session required) |
| — | `/api/integration/identity-directory` | Demo directory export (session required) |

## Architecture

```text
src/
  app/                 Next.js App Router pages, server actions, route handlers
    (dashboard)/       Session-protected pages (layout calls requireAdmin)
    actions/           Server actions — thin: auth check → service → redirect/state
  components/          UI primitives, forms, app shell, QR image
  lib/
    domain/            Types, roles/permissions, validation, ID + QR payload format
    data/              Repository interface + demo JSON-file implementation
    services/          Business rules (personnel, identity/QR, teams, stats, directory)
    auth/              Demo session (HMAC-signed HTTP-only cookie)
tests/                 Vitest service tests
```

* **Identity model.** `Person.id` is a random UUID; `displayId` (PAT-/MED-/DOC-/STF-00001) is for humans.
  QR credentials are separate records with their own 128-bit random token, version and status, so wristbands can
  be reprinted, replaced or revoked without changing the person. Only one ACTIVE credential per soldier.
* **QR payload:** `CASEVAC:1:<token>` — no name, service number, contact or medical data. See `INTEGRATION.md`.
* **Persistence:** `CASEVAC_DATA_SOURCE=demo-file` → `.data/casevac-demo-db.json` (server-side, git-ignored,
  atomic writes, in-process lock). A PostgreSQL/API implementation plugs in behind `lib/data/repository.ts`.
* **Audit:** every change appends an `AuditEvent` (IDs only); `setAuditSink()` is the hook for a central service.
* **Next.js 16 note:** `cacheComponents` is disabled on purpose (fully dynamic, session-gated app).

## Known limitations

* Demo authentication: one configured admin account; no per-user accounts, MFA, lockout or role-based sign-in.
* JSON file store: unencrypted, single-process, no backups — fictional data only.
* No backend, PostgreSQL or mobile synchronisation. Registered identities are **not** available on phones.
* Professional registration details are recorded but not verified. No sign-in credentials are issued to staff.
* RFID/NFC is modelled (`IdentityMethod = "NFC"`) but not implemented.
* Role changes between medic / doctor / other categories require a new registration (display IDs are permanent).
