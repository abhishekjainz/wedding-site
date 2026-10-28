// Generates the production secrets for Cloudflare.
//   node scripts/make-secrets.mjs            → also generates a strong admin password
//   node scripts/make-secrets.mjs "<pass>"   → uses your own (at least 16 characters)
//
// Why only 2,000 PBKDF2 rounds: Cloudflare's free plan allows ~10 ms of CPU per request, and
// 100,000 rounds take ~60 ms, so sign-in would fail. Security comes instead from a long random
// password (~100 bits), the hash living only in a Worker secret (never in the database or the
// browser), and login rate-limiting (8 tries per 15 minutes per address).
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/service.js';
const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = n => [...randomBytes(n)].map(b => A[b % A.length]).join('');
let pw = process.argv[2];
if (pw && pw.length < 16) { console.error('Use at least 16 characters, or leave it out and one will be generated.'); process.exit(1); }
if (!pw) pw = rand(20).match(/.{4}/g).join('-'); // e.g. K7QM-2XRA-…  (~100 bits)
const code = p => p + '-' + rand(8).replace(/(.{4})/, '$1-');
const v = { SESSION_SECRET: randomBytes(32).toString('base64url'), INVITE_CODE_GROUP1: code('ROSE'), INVITE_CODE_GROUP2: code('SAGE'), INVITE_CODE_GROUP3: code('TEAL'), INVITE_CODE_GROUP4: code('GOLD'), ADMIN_PASSWORD_HASH: await hashPassword(pw, 2000) };
console.log(`Admin password (keep it private, e.g. in a password manager): ${pw}\n`);
console.log('Cloudflare → your Worker → Settings → Variables and Secrets → add each as type "Secret":\n');
for (const [k, val] of Object.entries(v)) console.log(`${k}\n  ${val}\n`);
['Friends', 'Close Family', 'Family & Guests', 'Other Guests'].forEach((n, i) => console.log(`Group ${i + 1} (${n}) link:  https://<your-site>/i/${v['INVITE_CODE_GROUP' + (i + 1)]}`));
