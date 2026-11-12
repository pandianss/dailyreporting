# IOB Daily Performance

Private server-backed portal for 56 Dindigul-region branches. Uses authenticated visitor identity and Cloudflare D1. No performance figures are seeded into production.

## Mobile access and PIN

The existing private Sites/ChatGPT sign-in boundary is preserved. This is **not standalone mobile-only authentication**: mobile + PIN follows platform sign-in. No SMS/OTP provider is configured. Approved sign-in identity protects number enrolment; entering someone else's number cannot claim their account.

- Admin mobile: the server-side `ADMIN_MOBILE` setting, reserved for the existing Site owner. The owner sets and confirms their own four-digit PIN on first use; no default PIN exists.
- Admin lands on Publish data, branch heads directly on their assigned Branch report, reviewers on Review desk, and Senior Regional Manager (SRM) on the Regional Overview dashboard. Branch and reviewer views have no admin navigation. Branch heads cannot select another branch. The API prohibits reviewers and SRM from submitting performance.
- SRM (Senior Regional Manager) sits above reviewers with an executive dashboard, access to all branch submissions, and the authority to issue high-priority SRM Directions with distinct visual styling and WhatsApp attribution.
- PINs use random salts and PBKDF2-SHA256 (100,000 iterations). Sessions use random 256-bit tokens stored by digest, HttpOnly/Secure/SameSite=Strict cookies, eight-hour expiry and platform identity binding.
- Five failed PIN attempts in a 15-minute window block further attempts until the window ends. Role changes, revocation and admin PIN resets invalidate sessions. PIN hashes/salts are never returned to the browser or administrator.
- Touch-sized inputs, numeric phone/PIN keyboards, mobile reviewer cards, responsive viewport and focused branch forms.

## First use

1. Open the private Site as its owner, enter the admin mobile, and set a four-digit PIN.
2. Register each branch head/reviewer mobile with their approved **ChatGPT sign-in email**, role and branch under Branch directory. Site sharing must separately allow that person; the owner-private audience is unchanged. Earlier email-only grants do not bypass mobile/PIN enrolment.
3. Add campaigns, then download the daily CSV template. Complete every branch and required column. Monetary amounts are rupees, not lakhs; use zero explicitly for NIL, never for unavailable data.
4. Enter yesterday's source cutoff, growth baseline, funded definition and IST deadline, then validate and publish.
5. Branch heads submit on their own entry page. Reviewers open a submitted entry from their review queue and save feedback.
6. Admin can reset a branch/reviewer PIN in Branch directory. Their next approved login asks them to set a new PIN. Admin PIN recovery requires owner-assisted maintenance; no self-service bypass is exposed.

## WhatsApp transport

No live group or mobile number is configured. Jobs are blocked explicitly until the following server-side settings exist:

- WA_BRIDGE_URL: HTTPS URL of a trusted group-capable bridge, without trailing slash.
- WA_BRIDGE_TOKEN: bearer secret for that bridge.
- WA_GROUP_ID: actual target group identity.

Bridge contract:
- GET /participants?group=<id> returns [{phone:"91...",id:"actual-member-identity"}]. Only a verified member identity can be mentioned.
- POST /send accepts {group_id,text,mentions:[member_id]}; it must embed genuine mentions, insert their visible text consistently, and return {message_id}. Honour Idempotency-Key and persist the resulting ID to prevent duplicate sends on retry.
- The sender is the connected service account. Reviewer attribution appears in the body.
- Unknown send results are not retried automatically. Reconcile against bridge logs first.

An ordinary sharing link cannot implement this bridge. WhatsApp Web libraries can support it but are unofficial and carry account-blocking/session risks. No unofficial account connection is installed by this project.

## Current implementation boundaries

- Imports are CSV. Campaigns are count-based and apply to all loaded branches. Add campaigns before publishing the applicable day; a correction is required to include a later-added campaign in that published snapshot.
- Loan sanctions are tracked under three core sectors: Core Retail, Core Agri, and Core MSME. Each sector records historical baseline figures (Sanctions upto last month), current month till yesterday figures, and present day performance filled by branch heads (sanctioned account count and sanctioned amount in ₹).
- Reviewer role covers the regional set; per-reviewer branch partitions are not included yet.
- Submission deadline is included in requests; it is not a hard entry lock. Historical amendments remain allowed and versioned.
- Forms save on Submit; unsent form drafts are not autosaved.
- Regional overview distinguishes missing submissions from NIL openings; uploaded growth is authoritative. Same-day funding of older cohorts is not added to today's new-account funded subset.
- Two-way WhatsApp ingestion, automatic daily reminder schedules, live CBS reconciliation and overdue-plan escalation are not configured.

These boundaries are explicit; there are no simulated sent messages or invented bank figures.

## Validation

node tests/portal.mjs runs 67 checks covering mobile/PIN enrolment, sign-in, identity binding, throttling, logout, reset, revocation, Core Retail / Core Agri / Core MSME loan sanctions, SRM role permissions and executive directions, and business rules and server routes against isolated in-memory SQLite with synthetic records, including branch isolation, publication deduplication, correction history and actual blocked outbox state. npm run db:generate creates schema migrations; Sites applies them on deployment.
