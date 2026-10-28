// Cloudflare Worker: private API + static site. Deploy with `npx wrangler deploy`.
import Rules from './rules.js';
import Defaults from './defaults.js';
import { createService } from './service.js';

function d1Store(db) {
  const rowToSub = (r, guests, events) => ({
    id: r.id, group: r.group_id, status: r.status, primaryName: r.primary_name, phone: r.phone,
    partySize: guests.length, guests, events,
    arrivalDate: r.arrival_date || '', arrivalWindow: r.arrival_window || '',
    departureDate: r.departure_date || '', departureWindow: r.departure_window || '',
    songName: r.song_name || '', songArtist: r.song_artist || '', songUrl: r.song_url || '',
    questions: r.questions || '', note: r.note || '', source: r.source, adminNotes: r.admin_notes || '',
    editTokenHash: r.edit_token_hash, createdAt: r.created_at, updatedAt: r.updated_at,
  });
  async function hydrate(rows) {
    if (!rows.length) return [];
    const [g, e] = await db.batch([
      db.prepare('SELECT submission_id, full_name FROM rsvp_guests ORDER BY submission_id, position'),
      db.prepare('SELECT submission_id, event_id FROM rsvp_event_selections'),
    ]);
    const gm = {}, em = {};
    g.results.forEach(x => (gm[x.submission_id] = gm[x.submission_id] || []).push(x.full_name));
    e.results.forEach(x => (em[x.submission_id] = em[x.submission_id] || []).push(x.event_id));
    return rows.map(r => rowToSub(r, gm[r.id] || [], em[r.id] || []));
  }
  const writeStmts = s => [
    db.prepare(`INSERT INTO rsvp_submissions (id, group_id, status, primary_name, phone, arrival_date, arrival_window, departure_date, departure_window,
      song_name, song_artist, song_url, questions, note, source, admin_notes, edit_token_hash, created_at, updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)
      ON CONFLICT(id) DO UPDATE SET group_id=?2, status=?3, primary_name=?4, phone=?5, arrival_date=?6, arrival_window=?7, departure_date=?8,
      departure_window=?9, song_name=?10, song_artist=?11, song_url=?12, questions=?13, note=?14, source=?15, admin_notes=?16, edit_token_hash=?17, updated_at=?19`)
      .bind(s.id, s.group, s.status, s.primaryName, s.phone, s.arrivalDate, s.arrivalWindow, s.departureDate, s.departureWindow,
        s.songName, s.songArtist, s.songUrl, s.questions, s.note, s.source, s.adminNotes || '', s.editTokenHash, s.createdAt, s.updatedAt),
    db.prepare('DELETE FROM rsvp_guests WHERE submission_id = ?').bind(s.id),
    db.prepare('DELETE FROM rsvp_event_selections WHERE submission_id = ?').bind(s.id),
    ...s.guests.map((g, i) => db.prepare('INSERT INTO rsvp_guests (submission_id, position, full_name) VALUES (?,?,?)').bind(s.id, i, g)),
    ...s.events.map(ev => db.prepare('INSERT INTO rsvp_event_selections (submission_id, event_id) VALUES (?,?)').bind(s.id, ev)),
  ];
  const getKV = async (key, dflt) => {
    const r = await db.prepare('SELECT value FROM website_content WHERE key = ?').bind(key).first();
    return r ? { ...dflt, ...JSON.parse(r.value) } : dflt;
  };
  const setKV = (key, value) => db.prepare('INSERT INTO website_content (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .bind(key, JSON.stringify(value), new Date().toISOString()).run();

  return {
    async listSubmissions() { return hydrate((await db.prepare('SELECT * FROM rsvp_submissions ORDER BY created_at').all()).results); },
    async getSubmission(id) { const r = await db.prepare('SELECT * FROM rsvp_submissions WHERE id = ?').bind(id).first(); return r ? (await hydrate([r])).find(x => x.id === id) : null; },
    async getSubmissionByTokenHash(h) { const r = await db.prepare('SELECT * FROM rsvp_submissions WHERE edit_token_hash = ?').bind(h).first(); return r ? (await hydrate([r])).find(x => x.id === r.id) : null; },
    async insertSubmission(s) { await db.batch(writeStmts(s)); }, // D1 batches run as a single transaction
    async updateSubmission(s) { await db.batch(writeStmts(s)); },
    async deleteSubmission(id) {
      await db.batch(['rsvp_guests', 'rsvp_event_selections'].map(t => db.prepare(`DELETE FROM ${t} WHERE submission_id = ?`).bind(id))
        .concat(db.prepare('DELETE FROM rsvp_submissions WHERE id = ?').bind(id)));
    },
    async getEvents() {
      const rows = (await db.prepare('SELECT data FROM events ORDER BY sort').all()).results;
      if (rows.length) return rows.map(r => JSON.parse(r.data));
      await this.setEvents(Defaults.DEFAULT_EVENTS); // first run: seed the source-of-truth events
      return Defaults.DEFAULT_EVENTS;
    },
    async setEvents(events) {
      const opts = Rules.eventOptions(events).map(o => o.id); // per-day ids for multi-day events
      await db.batch([db.prepare('DELETE FROM rsvp_event_selections WHERE event_id NOT IN (' + opts.map(() => '?').join(',') + ')').bind(...opts),
        db.prepare('DELETE FROM events WHERE id NOT IN (' + events.map(() => '?').join(',') + ')').bind(...events.map(e => e.id)),
        ...events.map(e => db.prepare('INSERT INTO events (id, sort, data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET sort=excluded.sort, data=excluded.data').bind(e.id, e.sort, JSON.stringify(e)))]);
    },
    getContent: () => getKV('content', Defaults.DEFAULT_CONTENT),
    setContent: c => setKV('content', c),
    getSettings: () => getKV('settings', Defaults.DEFAULT_SETTINGS),
    setSettings: s => setKV('settings', s),
    async rate(key, limit, windowSec) {
      const now = Math.floor(Date.now() / 1000);
      const r = await db.prepare(`INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
        ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start <= ?2 - ?3 THEN 1 ELSE count + 1 END,
        window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END RETURNING count`).bind(key, now, windowSec).first();
      return r.count <= limit;
    },
  };
}

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
};
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS, ...extra } });

function cookies(req) {
  const out = {};
  (req.headers.get('Cookie') || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
const COOKIE = { guest: { name: 'wg_guest', path: '/', same: 'Lax' }, admin: { name: 'wg_admin', path: '/api/admin', same: 'Strict' } };
const setCookie = s => { const c = COOKIE[s.name]; return `${c.name}=${encodeURIComponent(s.value)}; Path=${c.path}; Max-Age=${Math.floor(s.maxAge)}; HttpOnly; Secure; SameSite=${c.same}`; };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return new Response('Server not configured: set SESSION_SECRET', { status: 500 });
    const svc = createService(d1Store(env.DB), {
      sessionSecret: env.SESSION_SECRET,
      inviteCodes: { 1: env.INVITE_CODE_GROUP1, 2: env.INVITE_CODE_GROUP2, 3: env.INVITE_CODE_GROUP3, 4: env.INVITE_CODE_GROUP4 },
      adminPasswordHash: env.ADMIN_PASSWORD_HASH,
    });
    const ck = cookies(req);
    const ctx = { ip: req.headers.get('CF-Connecting-IP') || 'unknown', sessions: { guest: ck.wg_guest, admin: ck.wg_admin } };

    // Short, forwardable invitation links: https://<site>/i/<CODE>
    if (p.startsWith('/i/')) {
      const r = await svc.access({ code: decodeURIComponent(p.slice(3)) }, ctx);
      if (r.status !== 200) return Response.redirect(url.origin + '/?invalid=1', 302);
      return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': setCookie(r.setSession), ...SEC_HEADERS } });
    }
    if (p.startsWith('/media/')) {
      if (!(await svc.site({}, ctx)).body.group && !(await svc.adminData({}, ctx)).body.submissions) return new Response('Not found', { status: 404 });
      const m = await env.DB.prepare('SELECT mime, data FROM media WHERE id = ?').bind(p.slice(7)).first();
      return m ? new Response(new Uint8Array(m.data), { headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } }) : new Response('Not found', { status: 404 });
    }
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);

    // CSRF: state-changing calls must be same-origin JSON.
    if (req.method !== 'GET') {
      const origin = req.headers.get('Origin');
      if (origin && origin !== url.origin) return json(403, { error: 'badOrigin' });
      if (!p.startsWith('/api/admin/media') && !(req.headers.get('Content-Type') || '').includes('application/json')) return json(415, { error: 'json' });
    }
    let body = {};
    if (req.method !== 'GET' && !p.startsWith('/api/admin/media')) {
      const text = await req.text();
      if (text.length > 200000) return json(413, { error: 'tooLarge' });
      try { body = text ? JSON.parse(text) : {}; } catch { return json(400, { error: 'badJson' }); }
    }

    const routes = {
      'POST /api/access': () => svc.access(body, ctx),
      'GET /api/site': () => svc.site(body, ctx),
      'POST /api/rsvp': () => svc.submit(body, ctx),
      'POST /api/rsvp/lookup': () => svc.getByToken(body, ctx),
      'PUT /api/rsvp': () => svc.updateByToken(body, ctx),
      'POST /api/admin/login': () => svc.adminLogin(body, ctx),
      'GET /api/admin/data': () => svc.adminData(body, ctx),
      'POST /api/admin/submission': () => svc.adminSaveSubmission(body, ctx),
      'POST /api/admin/delete': () => svc.adminDeleteSubmission(body, ctx),
      'POST /api/admin/reset-link': () => svc.adminResetLink(body, ctx),
      'POST /api/admin/content': () => svc.adminSaveContent(body, ctx),
      'GET /api/admin/export': () => svc.adminExport({ type: url.searchParams.get('type') }, ctx),
      'GET /api/admin/backup': () => svc.adminBackup(body, ctx),
    };
    if (p === '/api/admin/logout') return json(200, { ok: true }, { 'Set-Cookie': 'wg_admin=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict' });
    if (p === '/api/admin/media' && req.method === 'POST') {
      if (!(await svc.adminData({}, ctx)).body.submissions) return json(401, { error: 'noAdmin' });
      const mime = req.headers.get('Content-Type') || '';
      if (!/^image\/(jpeg|png|webp)$/.test(mime)) return json(415, { error: 'imageOnly' });
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 1800000) return json(413, { error: 'tooLarge' });
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO media (id, mime, data, created_at) VALUES (?,?,?,?)').bind(id, mime, buf, new Date().toISOString()).run();
      return json(200, { ok: true, url: '/media/' + id });
    }
    const h = routes[req.method + ' ' + p];
    if (!h) return json(404, { error: 'notFound' });
    try {
      const r = await h();
      if (r.csv) return new Response(r.csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.filename}"`, ...SEC_HEADERS } });
      return json(r.status, r.body, r.setSession ? { 'Set-Cookie': setCookie(r.setSession) } : {});
    } catch (e) {
      console.error(e);
      return json(500, { error: 'server' });
    }
  },
};
