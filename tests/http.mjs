// End-to-end HTTP checks against a running Worker (wrangler dev). Usage: node tests/http.mjs http://127.0.0.1:8787 <g1> <g2> <g3> <g4> <adminpass>
const [base, c1, c2, c3, c4, pass] = process.argv.slice(2);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const jar = () => { const c = {}; return { c, h() { return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; '); }, take(res) { (res.headers.getSetCookie?.() || []).forEach(s => { const [kv] = s.split(';'); const [k, v] = kv.split('='); c[k] = v; }); } }; };
async function req(j, method, path, body, extra = {}) {
  const res = await fetch(base + path, { method, redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: j.h(), ...extra }, body: body ? JSON.stringify(body) : undefined });
  j.take(res);
  let data = null; const t = await res.text(); try { data = JSON.parse(t); } catch { data = t; }
  return { status: res.status, data, res };
}
const rsvp = o => ({ primaryName: 'Asha Mehta', phoneCc: '+91', phoneNumber: '98765 43210', status: 'accept', partySize: 3, guests: ['Asha Mehta', 'Ravi Mehta', 'Kiran Mehta'],
  events: ['haldi', 'reception'], arrivalDate: '2027-02-12', arrivalWindow: 'mid', departureDate: '2027-02-15', departureWindow: 'am', ...o });

const anon = jar(), g1 = jar(), g2 = jar(), g3 = jar(), g4 = jar(), adm = jar();
ok((await req(anon, 'GET', '/api/site')).status === 401, 'no session -> site data refused');
ok(!(await (await fetch(base + '/app.js')).text()).includes('Mukesh'), 'public JS bundle contains no family/event content');
ok((await req(anon, 'GET', '/api/admin/data')).status === 401, 'admin API refused without login');
const bad = await req(anon, 'GET', '/i/WRONG-CODE'); ok(bad.status === 302 && bad.res.headers.get('location').includes('invite=WRONG-CODE'), 'invite link hands the code to the page');
const lk = await req(anon, 'GET', '/i/' + c1 + '/hi'); ok(lk.status === 302 && /invite=.+&lang=hi/.test(lk.res.headers.get('location')), 'invite link keeps the /hi language choice');
const l1 = await req(g1, 'POST', '/api/access', { code: c1 }); ok(l1.status === 200 && g1.c.wg_guest, 'group 1 code sets HttpOnly session');
ok((l1.res.headers.getSetCookie()[0] || '').includes('HttpOnly'), 'session cookie is HttpOnly');
await req(g2, 'POST', '/api/access', { code: c2.toLowerCase() });
await req(g3, 'POST', '/api/access', { code: c3 }); await req(g4, 'POST', '/api/access', { code: c4 });
const n = [];
for (const j of [g1, g2, g3, g4]) n.push((await req(j, 'GET', '/api/site')).data.events.length);
ok(n.join() === '10,8,7,1', `groups see 10 / 8 / 7 / 1 events (${n.join(' / ')})`);
const forged = await req(g1, 'POST', '/api/rsvp', rsvp({ events: ['not-an-event'], primaryName: 'Hack Er', guests: ['Hack Er'], partySize: 1, phoneNumber: '9000000009' }));
ok(forged.status === 422 && forged.data.fields.events === 'eventForbidden', 'crafted request for an event outside the group rejected');
ok((await req(g2, 'POST', '/api/rsvp', rsvp(), { Origin: 'https://evil.example' })).status === 403, 'cross-origin POST refused');
const hd = await req(g1, 'POST', '/api/rsvp', rsvp({ primaryName: 'Lena Fischer', guests: ['Lena Fischer'], partySize: 1, phoneCc: '+49', phoneNumber: '15123456789', events: ['home-days@2027-02-10', 'mehendi'] }));
ok(hd.status === 200 && hd.data.submission.events.includes('home-days@2027-02-10'), 'friends RSVP with a chosen Home Day stored in D1');
const g4r = await req(g4, 'POST', '/api/rsvp', { primaryName: 'Anil Verma', phoneCc: '+91', phoneNumber: '9123456789', status: 'accept', partySize: 1, guests: ['Anil Verma'] });
ok(g4r.status === 200 && g4r.data.submission.events.join() === 'reception', 'reception-only RSVP needs no events or travel');
const sub = await req(g1, 'POST', '/api/rsvp', rsvp());
ok(sub.status === 200 && sub.data.submission.guests.length === 3, 'party of three saved with three names');
const token = sub.data.editToken;
const dup = await req(g1, 'POST', '/api/rsvp', rsvp());
ok(dup.status === 409, 'duplicate submission warned');
const edit = jar();
const look = await req(edit, 'POST', '/api/rsvp/lookup', { token });
ok(look.status === 200 && look.data.submission.id === sub.data.submission.id, 'edit link retrieves the saved response (survives reload)');
const upd = await req(edit, 'PUT', '/api/rsvp', { token, data: rsvp({ partySize: 2, guests: ['Asha Mehta', 'Ravi Mehta', 'Kiran Mehta'], departureDate: '2027-02-14' }) });
ok(upd.status === 200 && upd.data.submission.guests.length === 2, 'reducing party size drops the extra guest');
const login = await req(adm, 'POST', '/api/admin/login', { password: pass });
ok(login.status === 200 && (login.res.headers.getSetCookie()[0] || '').includes('Path=/api/admin'), 'admin login works, cookie scoped to /api/admin');
ok((await req(g1, 'GET', '/api/admin/data')).status === 401, 'guest session cannot read admin data');
const d = (await req(adm, 'GET', '/api/admin/data')).data;
ok(d.submissions.length === 3 && d.summary.totalGuests === 4, 'edit did not double-count (3 records, 2 + 1 + 1 guests)');
ok(d.summary.perEvent.find(e => e.id === 'home-days@2027-02-10').guests === 1, 'Home Days counted per day');
ok(JSON.stringify(d.summary.nights) === JSON.stringify([{ date: '2027-02-12', guests: 3 }, { date: '2027-02-13', guests: 3 }, { date: '2027-02-14', guests: 1 }]), 'guest-nights recalculated (reception-only guests not counted)');
ok(!JSON.stringify(d).includes('editTokenHash'), 'edit token hashes never leave the server');
const csv = await req(adm, 'GET', '/api/admin/export?type=guests');
ok(csv.status === 200 && csv.data.split('\r\n').length === 5, 'guest CSV: header + one row per guest');
const backup = await req(adm, 'GET', '/api/admin/backup'); ok(backup.status === 200 && backup.data.submissions.length === 3, 'JSON backup export');
await req(adm, 'POST', '/api/admin/content', { settings: { deadline: '2020-01-01T00:00:00+05:30' } });
ok((await req(g1, 'POST', '/api/rsvp', rsvp({ phoneNumber: '9111111111', primaryName: 'Late Guest', guests: ['Late Guest'], partySize: 1 }))).data.error === 'deadline', 'submissions locked after deadline');
await req(adm, 'POST', '/api/admin/content', { settings: { deadline: '2026-11-30T23:59:59+05:30' } });
let last; for (let i = 0; i < 9; i++) last = await req(jar(), 'POST', '/api/admin/login', { password: 'wrong' });
ok(last.status === 429, 'admin login rate-limited');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
