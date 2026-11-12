# Firebase Deployment Guide (`dailyreport-9265a`)

This portal is configured for **Firebase Hosting + Cloud Functions (2nd Gen, `asia-south1`) + Cloud Firestore** using Mobile + 4-digit PIN authentication.

## Architecture

- **Frontend (`out/`)**: Static Next.js export served via Firebase Hosting (`https://dailyreport-9265a.web.app`).
- **Backend API (`functions/src/index.ts`)**: Express app on Cloud Functions v2 handling `/api/auth` and `/api/portal`, routed through Firebase Hosting rewrites (`firebase.json`).
- **Session Cookie**: Uses `__session` (the cookie name preserved by Firebase Hosting CDN) with `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS.
- **Database (`firestore.rules`)**: Cloud Firestore (`records` and `auth_limits` collections). Client-side direct access is denied (`allow read, write: if false`); all reads and writes go through the authenticated Cloud Functions Admin SDK.

## Prerequisites in Firebase Console

1. **Upgrade to Blaze (Pay-as-you-go) Plan** (required for Cloud Functions):
   - Open https://console.firebase.google.com/project/dailyreport-9265a/usage/details and upgrade the project.
2. **Create a Cloud Firestore Database**:
   - In the Firebase Console (`dailyreport-9265a`), go to **Firestore Database** → **Create database** (choose `asia-south1` / Mumbai for lowest latency) in Production mode.

## Server Configuration (`functions/.env`)

Create `functions/.env` from `functions/.env.example`:

```sh
cp functions/.env.example functions/.env
```

Set your administrator mobile number (`91` + 10 digits) and optional WhatsApp bridge credentials:

```env
ADMIN_MOBILE=919XXXXXXXXX
ADMIN_EMAIL=admin@iob.local
```

## Build & Deploy

```sh
# 1. Install root and functions dependencies
npm install
npm --prefix functions install

# 2. Run test suites
node tests/firebase-portal.mjs
node tests/portal.mjs

# 3. Build static frontend (out/) and Cloud Functions (functions/lib/)
npm run build:firebase

# 4. Deploy Firestore rules, Cloud Functions, and Hosting
firebase deploy --project dailyreport-9265a
```

## First Login

1. Open `https://dailyreport-9265a.web.app`.
2. Enter the `ADMIN_MOBILE` number, set and confirm a 4-digit PIN.
3. Open **Branch directory** → **Portal access assignments** to register branch heads, reviewers, and the SRM (`srm`).
4. Each registered officer sets their own 4-digit PIN on their first login.
