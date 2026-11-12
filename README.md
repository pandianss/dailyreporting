# IOB Daily Reporting

Mobile-first daily performance portal for 56 Dindigul-region branches.

[Open the current private portal](https://iob-dindigul-daily-reporting.sspandian.chatgpt.site/)

## Hosting status

This repository contains application source. It does **not** move the live application, its database, access permissions, PIN records or WhatsApp connection to GitHub.

**GitHub Pages cannot run this application by itself.** It hosts static files; this application uses server routes, a Cloudflare Worker and a D1 database. The included Actions workflow checks tests and builds; it does not deploy.

The existing deployment also relies on Sites to verify ChatGPT identity and inject trusted identity headers. Do not expose this Worker directly on a public endpoint that accepts caller-supplied `oai-authenticated-user-*` headers. Independent hosting needs a verified identity gateway or a replacement authentication implementation, a database and deployment credentials first.

## Application

- Mobile number followed by first-use four-digit PIN setup; subsequent PIN sign-in.
- Branch heads open their own daily entry form; reviewers open the review queue; admin opens daily uploads.
- Daily SB/CD, funded-account, growth, SMA and campaign reports.
- Recovery commitments, report revisions and reviewer feedback.
- WhatsApp outbox with truthful blocked/sent states. No live WhatsApp connection is included.

## Server configuration

Set `ADMIN_MOBILE` to the administrator's number with country code `91` followed by ten digits. It is intentionally absent from public source. Missing configuration fails closed. The current private live portal retains its existing admin configuration.

Database binding: `DB`. Schema migrations are in `drizzle/`. Apply them through the selected trusted hosting environment.

Optional WhatsApp bridge configuration: `WA_BRIDGE_URL`, `WA_BRIDGE_TOKEN`, `WA_GROUP_ID`. Keep credentials in the host's secret settings, never in Git.

## Development and checks

Use Node.js 22.13 or later (Node 22 LTS recommended).

```sh
npm ci
node tests/portal.mjs
npm run build
```

The tests use isolated in-memory SQLite and synthetic accounts. They never read or update production data. The Actions workflow performs the same checks on pushes and pull requests.

For local preview, set a test-only `ADMIN_MOBILE` in an untracked `.dev.vars` file and run `npm run dev`. The development adapter provides a local test identity. Production must use a trusted identity provider.

See [implementation and operational notes](docs/IMPLEMENTATION.md) for imports, role assignment and the bridge contract.

## Moving hosting from the current private Site

Before deployment from this repository, provision a Worker-compatible host and D1 database, configure trusted identity, add server-only runtime values, apply migrations, and validate all roles. Database records and PIN hashes are not part of this source export. Keep the old portal live until migration is verified. Do not enable GitHub Pages expecting a functioning reporting portal.
