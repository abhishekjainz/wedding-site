import test from 'node:test';
import assert from 'node:assert/strict';
import Rules from '../src/rules.js';
import { createService, hashPassword } from '../src/service.js';
import { createMemoryStore } from '../src/memory-store.js';

async function setup() {
  const store = createMemoryStore();
  const svc = createService(store, { sessionSecret: 'x'.repeat(40), inviteCodes: { 1: 'ROSE-1111', 2: 'SAGE-2222', 3: 'TEAL-3333', 4: 'GOLD-4444' }, adminPasswordHash: await hashPassword('correct horse', 1000) });
  const sess = async code => (await svc.access({ code }, { ip: 'a', sessions: {} })).setSession.value;
  const admin = (await svc.adminLogin({ password: 'correct horse' }, { ip: 'a', sessions: {} })).setSession.value;
  return { store, svc, g1: await sess('rose-1111'), g2: await sess('SAGE-2222'), g3: await sess('TEAL-3333'), g4: await sess('gold-4444'), admin };
}
const base = (o = {}) => ({ primaryName: 'Asha Mehta', phoneCc: '+91', phoneNumber: '98765 43210', status: 'accept', partySize: 3,
  guests: ['Asha Mehta', 'Ravi Mehta', 'Kiran Mehta'], events: ['haldi', 'reception'], arrivalDate: '2027-02-12', arrivalWindow: 'mid',
  departureDate: '2027-02-15', departureWindow: 'am', songName: 'Kala Chashma', songArtist: 'Badshah', songUrl: '', questions: '', ...o });
const ctx = (guest, ip = 'g') => ({ ip, sessions: { guest } });

test('four access codes map to four groups with the right events; wrong code rejected', async () => {
  const { svc, g1, g2, g3, g4 } = await setup();
  const ids = async g => (await svc.site({}, ctx(g))).body.events.map(e => e.id);
  assert.deepEqual(await ids(g1), ['home-days', 'mehendi', 'bride-mayara', 'haldi', 'groom-mayara', 'reception', 'baraat', 'phere', 'closing-dinner']);
  assert.deepEqual(await ids(g2), ['mehendi', 'bride-mayara', 'haldi', 'groom-mayara', 'reception', 'baraat', 'phere', 'closing-dinner']);
  assert.deepEqual(await ids(g3), ['bride-mayara', 'haldi', 'groom-mayara', 'reception', 'baraat', 'phere', 'closing-dinner']);
  assert.deepEqual(await ids(g4), ['reception']);
  assert.equal((await svc.site({}, ctx(g4))).body.settings.simple, true);
  assert.equal((await svc.site({}, ctx(g1))).body.settings.simple, false);
  assert.equal((await svc.access({ code: 'nope' }, ctx())).status, 403);
  assert.equal((await svc.site({}, ctx(undefined))).status, 401);
  assert.equal((await svc.site({}, ctx(g1.slice(0, -2) + 'xx'))).status, 401, 'tampered session');
});

test('crafted requests for events outside the group are rejected server-side', async () => {
  const { svc, g1, g2, g3 } = await setup();
  let r = await svc.submit(base({ events: ['not-an-event', 'haldi'] }), ctx(g1));
  assert.equal(r.status, 422); assert.equal(r.body.fields.events, 'eventForbidden');
  // Close Family and Family & Guests don't pick events: yes = every event their link covers, whatever is sent
  r = await svc.submit(base({ events: ['mehendi', 'home-days@2027-02-10'], songName: 'X' }), ctx(g3));
  assert.equal(r.status, 200); assert.equal(r.body.submission.group, 3);
  assert.ok(!r.body.submission.events.includes('mehendi') && !r.body.submission.events.some(e => e.startsWith('home-days')));
  assert.ok(r.body.submission.events.includes('reception') && r.body.submission.events.includes('closing-dinner'));
  assert.equal(r.body.submission.songName, '', 'no song request for family groups');
  const r2 = await svc.submit(base({ phoneNumber: '9811112222', primaryName: 'Other Person', guests: ['Other Person'], partySize: 1, events: [] }), ctx(g2));
  assert.equal(r2.status, 200, JSON.stringify(r2.body)); assert.ok(r2.body.submission.events.includes('mehendi'));
  assert.ok(!r2.body.submission.events.some(e => e.startsWith('home-days')), 'close family never get home days');
});

test('friends pick individual Home Days; counted day by day', async () => {
  const { svc, g1, admin } = await setup();
  let r = await svc.submit(base({ events: ['home-days'] }), ctx(g1));
  assert.equal(r.body.fields.events, 'eventForbidden', 'must choose specific days, not the whole block');
  r = await svc.submit(base({ events: ['home-days@2027-02-12'] }), ctx(g1));
  assert.equal(r.body.fields.events, 'eventForbidden', 'a day outside the block');
  r = await svc.submit(base({ events: ['home-days@2027-02-09', 'home-days@2027-02-11', 'mehendi'], arrivalDate: '2027-02-08' }), ctx(g1));
  assert.equal(r.status, 200);
  const d = (await svc.adminData({}, { ip: 'a', sessions: { admin } })).body;
  const per = Object.fromEntries(d.summary.perEvent.map(e => [e.id, e.guests]));
  assert.equal(per['home-days@2027-02-09'], 3); assert.equal(per['home-days@2027-02-10'], 0); assert.equal(per['home-days@2027-02-11'], 3); assert.equal(per.mehendi, 3);
  const csv = (await svc.adminExport({ type: 'responses' }, { ip: 'a', sessions: { admin } })).csv;
  assert.ok(csv.includes('Pre-Wedding Home Days (2027-02-10)'));
});

test('reception-only group: just name, WhatsApp and who is coming', async () => {
  const { svc, g4, admin } = await setup();
  const r = await svc.submit({ primaryName: 'Anil Verma', phoneCc: '+91', phoneNumber: '9123456789', status: 'accept', partySize: 2,
    guests: ['Anil Verma', 'Rekha Verma'], events: ['mehendi', 'haldi'], arrivalDate: 'junk', songName: 'x' }, ctx(g4));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.submission.events, ['reception'], 'attending = the reception; anything else ignored');
  assert.equal(r.body.submission.arrivalDate, ''); assert.equal(r.body.submission.songName, '');
  const d = (await svc.adminData({}, { ip: 'a', sessions: { admin } })).body;
  assert.equal(d.summary.nights.length, 0, 'no accommodation counted');
  assert.equal(d.summary.byGroup.find(g => g.group === 4).guests, 2);
});

test('group cannot be switched by the client', async () => {
  const { svc, g2 } = await setup();
  const r = await svc.submit(base({ group: 1, events: ['haldi'] }), ctx(g2));
  assert.equal(r.body.submission.group, 2);
});

test('party of three -> three names; size reduction drops excess names', async () => {
  const { svc, g1, store } = await setup();
  const r = await svc.submit(base(), ctx(g1));
  assert.equal(r.body.submission.guests.length, 3);
  assert.equal((await store.listSubmissions())[0].guests.length, 3);
  const missing = await svc.submit(base({ phoneNumber: '9000000001', primaryName: 'Zed Khan', guests: ['Zed Khan', 'Ana Khan', ''] }), ctx(g1));
  assert.equal(missing.body.fields.guest2, 'required');
  const single = await svc.submit(base({ phoneNumber: '9000000002', primaryName: 'Om Rao', partySize: 1, guests: ['Om Rao', 'Leftover Name'] }), ctx(g1));
  assert.deepEqual(single.body.submission.guests, ['Om Rao']);
  const upd = await svc.updateByToken({ token: r.body.editToken, data: base({ partySize: 2 }) }, ctx());
  assert.deepEqual(upd.body.submission.guests, ['Asha Mehta', 'Ravi Mehta']);
});

test('full name, phone, events, travel validation', async () => {
  const { svc, g1 } = await setup();
  const r = await svc.submit(base({ primaryName: 'Asha', phoneNumber: '123', events: [], departureDate: '2027-02-08' }), ctx(g1));
  assert.equal(r.body.fields.primaryName, 'fullName');
  assert.equal(r.body.fields.phone, 'phone');
  assert.equal(r.body.fields.events, 'eventsMin');
  assert.equal(r.body.fields.departureDate, 'dateRange');
  const sameDay = await svc.submit(base({ arrivalDate: '2027-02-13', arrivalWindow: 'eve', departureDate: '2027-02-13', departureWindow: 'am' }), ctx(g1));
  assert.equal(sameDay.body.fields.departureDate, 'depBeforeArr');
  const before = await svc.submit(base({ arrivalDate: '2027-02-14', departureDate: '2027-02-13' }), ctx(g1));
  assert.equal(before.body.fields.departureDate, 'depBeforeArr');
});

test('decline needs no travel; stored without party', async () => {
  const { svc, g1 } = await setup();
  const r = await svc.submit({ primaryName: 'Neha Shah', phoneCc: '+1', phoneNumber: '415 555 0100', status: 'decline', note: 'Sending love', arrivalDate: 'x' }, ctx(g1));
  assert.equal(r.status, 200); assert.equal(r.body.submission.guests.length, 0); assert.equal(r.body.submission.phone, '+14155550100');
});

test('edits keep one record, recalculate totals and guest-nights', async () => {
  const { svc, g1, admin } = await setup();
  const r = await svc.submit(base(), ctx(g1));
  let d = (await svc.adminData({}, { ip: 'a', sessions: { admin } })).body;
  assert.equal(d.summary.totalGuests, 3);
  assert.deepEqual(d.summary.nights, [{ date: '2027-02-12', guests: 3 }, { date: '2027-02-13', guests: 3 }, { date: '2027-02-14', guests: 3 }]);
  await svc.updateByToken({ token: r.body.editToken, data: base({ partySize: 2, departureDate: '2027-02-14' }) }, ctx());
  d = (await svc.adminData({}, { ip: 'a', sessions: { admin } })).body;
  assert.equal(d.submissions.length, 1);
  assert.equal(d.summary.totalGuests, 2);
  assert.deepEqual(d.summary.nights, [{ date: '2027-02-12', guests: 2 }, { date: '2027-02-13', guests: 2 }]);
  assert.equal(d.summary.perEvent.find(e => e.id === 'haldi').guests, 2);
  assert.ok(!('editTokenHash' in d.submissions[0]));
});

test('edit token is unguessable and only its hash is stored', async () => {
  const { svc, g1, store } = await setup();
  const r = await svc.submit(base(), ctx(g1));
  assert.ok(r.body.editToken.length >= 40);
  const raw = JSON.stringify(await store.listSubmissions());
  assert.ok(!raw.includes(r.body.editToken));
  assert.equal((await svc.getByToken({ token: 'A'.repeat(43) }, ctx())).status, 404);
});

test('duplicates warn, can be confirmed, and are flagged', async () => {
  const { svc, g1, admin } = await setup();
  await svc.submit(base(), ctx(g1));
  const dup = await svc.submit(base({ primaryName: 'Other Person', guests: ['Other Person', 'B Person', 'C Person'] }), ctx(g1));
  assert.equal(dup.status, 409);
  const forced = await svc.submit(base({ confirmDuplicate: true }), ctx(g1));
  assert.equal(forced.status, 200);
  const d = (await svc.adminData({}, { ip: 'a', sessions: { admin } })).body;
  assert.equal(Object.keys(d.summary.duplicates).length, 2);
});

test('deadline locks submissions; admin override reopens', async () => {
  const { svc, g1, admin, store } = await setup();
  await store.setSettings({ ...(await store.getSettings()), deadline: '2020-01-01T00:00:00+05:30' });
  assert.equal((await svc.submit(base(), ctx(g1))).body.error, 'deadline');
  await svc.adminSaveContent({ settings: { adminOverrideOpen: true } }, { ip: 'a', sessions: { admin } });
  assert.equal((await svc.submit(base(), ctx(g1))).status, 200);
});

test('admin isolation: guest session cannot read admin data; bad password rejected', async () => {
  const { svc, g1 } = await setup();
  assert.equal((await svc.adminData({}, { ip: 'a', sessions: { admin: g1 } })).status, 401);
  assert.equal((await svc.adminLogin({ password: 'wrong' }, { ip: 'b', sessions: {} })).status, 403);
  assert.equal((await svc.adminExport({ type: 'guests' }, { ip: 'a', sessions: {} })).status, 401);
});

test('rate limiting on submissions', async () => {
  const { svc, g1 } = await setup();
  let last;
  for (let i = 0; i < 62; i++) last = await svc.submit(base({ primaryName: 'x' }), ctx(g1, 'spam'));
  assert.equal(last.status, 429);
});

test('CSV export: one row per guest, formula injection neutralised', async () => {
  const { svc, g1, admin } = await setup();
  await svc.submit(base({ questions: '=HYPERLINK("x")' }), ctx(g1));
  const g = await svc.adminExport({ type: 'guests' }, { ip: 'a', sessions: { admin } });
  assert.equal(g.csv.trim().split('\r\n').length, 4);
  const all = await svc.adminExport({ type: 'responses' }, { ip: 'a', sessions: { admin } });
  assert.ok(all.csv.includes(`"'=HYPERLINK(""x"")"`));
});

test('admin manual WhatsApp entry with travel TBD', async () => {
  const { svc, admin } = await setup();
  const r = await svc.adminSaveSubmission({ data: { ...base({ events: ['home-days@2027-02-10'] }), group: 1, source: 'whatsapp', travelTbd: true } }, { ip: 'a', sessions: { admin } });
  assert.equal(r.status, 200);
  const d = (await svc.adminData({}, { ip: 'a', sessions: { admin } })).body;
  assert.equal(d.submissions[0].arrivalDate, ''); assert.equal(d.summary.nights.length, 0); assert.equal(d.summary.totalGuests, 3);
});

test('rooms per night follow each party’s own dates inside the hosted stay', async () => {
  const { svc, g1, g3, admin } = await setup();
  // Friends party of 3 arriving 10 Feb (Home Days), flying out 14 Feb evening: hosted nights 12 & 13 only, 2 rooms each
  await svc.submit(base({ arrivalDate: '2027-02-10', departureDate: '2027-02-14', departureWindow: 'eve' }), ctx(g1, 'a'));
  // Family & Guests couple 13 → 15 Feb afternoon: hosted 13 & 14, late check-out
  await svc.submit(base({ primaryName: 'Neha Shah', phoneNumber: '9811100000', partySize: 2, guests: ['Neha Shah', 'Raj Shah'], arrivalDate: '2027-02-13', arrivalWindow: 'am', departureDate: '2027-02-15', departureWindow: 'mid', events: [] }), ctx(g3, 'b'));
  const d = (await svc.adminData({}, { ip: 'x', sessions: { admin } })).body.summary;
  assert.deepEqual(d.roomNights.map(n => [n.date, n.rooms, n.guests]), [['2027-02-12', 2, 3], ['2027-02-13', 3, 5], ['2027-02-14', 1, 2]]);
  const early = d.stayExceptions.find(x => x.name === 'Asha Mehta'); assert.deepEqual(early.before, ['2027-02-10', '2027-02-11']);
  assert.ok(d.stayExceptions.find(x => x.name === 'Neha Shah').lateCheckout);
  const site = (await svc.site({}, ctx(g3))).body.settings; assert.equal(site.stayFrom, '2027-02-13'); assert.equal(site.stayUntil, '2027-02-15');
});

test('each group link carries its default language', async () => {
  const { svc, g1, g2, g3, g4 } = await setup();
  const lang = async g => (await svc.site({}, ctx(g))).body.settings.defaultLang;
  assert.deepEqual([await lang(g1), await lang(g2), await lang(g3), await lang(g4)], ['en', 'hi', 'hi', 'en']);
});
