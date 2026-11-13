# IOB Daily Reporting & SMA Follow-up Portals

Mobile-first regional performance and Special Mention Accounts (SMA) follow-up workspace for 56 Dindigul-region branches.

- **Daily Reporting Portal**: [https://dailyreport-9265a.web.app](https://dailyreport-9265a.web.app)
- **Dedicated SMA Follow-up Portal**: [https://dailyreport-sma-9265a.web.app](https://dailyreport-sma-9265a.web.app)

Both portals share the **exact same login** (registered 10-digit mobile number + 4-digit PIN) and **live bi-directional synchronization**: any elimination, note, or recovery update made in the SMA portal immediately reflects in the Daily Reporting portal, and vice versa.

## Hosting & Architecture

- **Frontends**: Multi-site **Firebase Hosting**:
  - `main` target: [https://dailyreport-9265a.web.app](https://dailyreport-9265a.web.app) (Daily reporting workspace)
  - `sma` target: [https://dailyreport-sma-9265a.web.app](https://dailyreport-sma-9265a.web.app) (SMA follow-up portal)
- **Seamless SSO Handoff**: 1-click token handoff button in the header allows users logged into one portal to switch to the sister portal without retyping their PIN.
- **Backend API**: **Firebase Cloud Functions v2** (`api` in `asia-south1`) handling `/api/auth` and `/api/portal` for both domains.
- **Database**: **Cloud Firestore** (`records` and `auth_limits` collections, locked down with `firestore.rules` so all access goes through the Cloud Functions Admin SDK).
- **Source & CI/CD**: Hosted on [GitHub (`pandianss/dailyreporting`)](https://github.com/pandianss/dailyreporting) with GitHub Actions validating tests/builds and deploying automatically to Firebase on pushes to `main`.

> **Note:** GitHub Pages alone only serves static files and cannot run server-side PIN verification, rate limiting, or Firestore Admin SDK calls. Firebase Hosting serves the UI and rewrites `/api/**` to Cloud Functions on the same origin.

## Application

- Mobile number followed by first-use four-digit PIN setup; subsequent PIN sign-in.
- Roles: **Branch head**, **Regional reviewer**, **Senior Regional Manager (SRM)**, and **Administrator**.
- Daily SB/CD account openings, funded accounts, growth, SMA eliminations, **Core Retail / Core Agri / Core MSME loan sanctions** (upto last month, current month till yesterday, and present-day performance), and campaign additions.
- Recovery commitments, report revisions, reviewer feedback, and priority SRM directions.
- WhatsApp outbox with truthful blocked/sent states. No live WhatsApp connection is included.

## Server configuration

Set `ADMIN_MOBILE` to the administrator's number with country code `91` followed by ten digits in `functions/.env` (for local/manual deploys) and in GitHub Repository Secrets (for CI/CD auto-deploy). Never commit `functions/.env`.

Optional WhatsApp bridge configuration: `WA_BRIDGE_URL`, `WA_BRIDGE_TOKEN`, `WA_GROUP_ID`.

## Development and checks

Use Node.js 22 or later.

```sh
npm ci
npm --prefix functions ci
node tests/firebase-portal.mjs
node tests/portal.mjs
npm run build:firebase
```

See [Firebase deployment guide](docs/FIREBASE.md) and [implementation notes](docs/IMPLEMENTATION.md) for details.
