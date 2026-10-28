# Dreamy & Abhishek — wedding invitation & RSVP site

Private, mobile-first, English/Hindi invitation with a real RSVP database and an organizer dashboard. Built to the v1.3 brief.

## 1. Look at the preview (no setup)

Open `dist/preview.html` in any browser. It runs the **same backend code** as the live site, but inside the browser — responses are stored only on that device and nothing is sent anywhere.

- Guest view: tap one of the four groups. Live codes are private and different.

| Group | Sees | Dates |
|---|---|---|
| 1 Friends | Pre-Wedding Home Days (pick days) + all 8 events | 9 – 14 Feb |
| 2 Close Family | all 8 events | 12 – 14 Feb |
| 3 Family & Guests | all except Mehendi | 13 – 14 Feb |
| 4 Other Guests | Reception only — short RSVP: name, WhatsApp, who's coming | 13 Feb |
- Dashboard: `#admin` at the end of the address, password `preview-admin`. *Settings & export → Add sample responses* fills it with demo data.

## 2. Go live (Cloudflare Workers + D1)

Chosen because it is low-cost, serverless and keeps all security checks on the server. **Before relying on the free plan, confirm current Workers and D1 free-plan limits and D1 backup ("Time Travel") retention in Cloudflare's docs** — ~200 guests is a very small load, but the brief requires verification.

```bash
npm install
npx wrangler login
npx wrangler d1 create wedding-rsvp            # copy the database_id into wrangler.toml
npx wrangler d1 execute wedding-rsvp --remote --file schema.sql
node scripts/make-secrets.mjs "a-long-admin-password"   # prints 4 secrets + both invitation links
npx wrangler secret put SESSION_SECRET          # repeat for each printed secret (session secret, 4 group codes, admin hash)
npm run build && npx wrangler deploy
```

Optionally attach a custom domain in the Cloudflare dashboard.

- **Invitation links** (send by WhatsApp): `https://<site>/i/<GROUP-CODE>` — opening it identifies the group automatically. Guests can also type the code at the gate.
- **Dashboard**: `https://<site>/admin`.
- Links can be forwarded; they control which events are shown, not who the person is (as the brief notes). Rotate a code by changing its secret and redeploying; existing guest sessions keep working.

## 2b. After testing, before real invitations

1. Take a backup (Dashboard → Settings & export → Full JSON backup).
2. Clear test responses:
   `npx wrangler d1 execute wedding-rsvp --remote --command "DELETE FROM rsvp_event_selections; DELETE FROM rsvp_guests; DELETE FROM rsvp_submissions; DELETE FROM rate_limits;"`
3. Issue fresh invitation codes (testers have seen the old ones): run `node scripts/make-secrets.mjs` again and re-set the four `INVITE_CODE_GROUP*` secrets. Keep `SESSION_SECRET` unless you also want to sign everyone out.

## 3. Images

`python3 scripts/make_assets.py assets/monogram-source.png assets/agency-source.png` regenerates the trimmed monogram, the wax seal (pressed with the A/D letterforms), the envelope paper texture and the transparent agency logo. If you have a seal-stamp artwork you prefer, replace `assets/seal.webp` with a transparent image of the same size.

## 4. Travel guide

A separate page for international guests (`src/web/guide.js`), opened from the “Our India Travel Guide” card and the menu, or directly at `https://<site>/#travel-guide` after a guest has opened their invitation link. It covers visas (e-Tourist Visa, e-Arrival Card), getting to Indore, trip routes, day trips around Indore and practical tips. Visa facts were checked in October 2026 against the official portal and fee table — re-check them in January before guests apply. The text lives in `guide.js` (English only); edit it there and rebuild.

## 4b. Everyday editing

All guest-facing text, photos, events (times, dress codes, rooms/lawns, directions, which groups are invited), translations, deadline and help number are edited in **Dashboard → Content / Settings**. Saved changes appear to guests immediately. The event list drives both the itinerary and RSVP eligibility.

Defaults that are seeded on first run live in `src/defaults.js`.

## 5. Backups & exports

- Dashboard → Settings & export: responses CSV, one-row-per-guest CSV, guest-nights CSV, full JSON backup.
- Command-line snapshot: `npx wrangler d1 export wedding-rsvp --remote --output backup.sql`.
- Take a JSON backup weekly during RSVP season and before bulk edits.

## 6. How the rules are enforced

All on the server (`src/service.js`, `src/rules.js`):

- Group comes from a signed, HttpOnly session cookie — never from the form. Ineligible events are rejected (`eventForbidden`).
- Exactly one full name (first + surname) per attending guest; names beyond the party size are dropped.
- Accept/decline only; ≥1 event when accepting; travel dates in range; departure not before arrival.
- Deadline 30 Nov 2026 23:59 IST locks new RSVPs (dashboard override available).
- Edit links use 256-bit random tokens; only SHA-256 hashes are stored. Edits update the same record.
- Duplicate phone/name → guest warning + dashboard flag. Rate limits on access, submissions, edits and admin login.
- Admin: PBKDF2 password hash, 8-hour session scoped to `/api/admin`. CSV export neutralises spreadsheet formulas.
- Guest content (families, story, events) is served only after the access check; the public JS contains none of it.

## 7. Tests

```bash
npm test                                   # 16 backend rule tests
npx wrangler dev                           # then, with .dev.vars set:
node tests/http.mjs http://127.0.0.1:8787 <G1> <G2> <G3> <G4> <admin password>   # 25 end-to-end HTTP checks
```

## 8. Still needed before invitations go out

- Real couple photos (main + 3–5) and a verified Essentia Luxury Hotel photo — upload in Dashboard → Content.
- Dress codes and hotel sub-locations per event.
- Family approval of the ceremony explanations (written generally, without assuming specific Jain customs).
- Native-speaker review of all Hindi copy (story, event descriptions, interface).
- Your welcome photo (shown under the countdown) — upload in Dashboard → Content → Photos.
- Phase 4 on real devices: WhatsApp in-app browser on iPhone and Android, all four groups, and a test edit link.
