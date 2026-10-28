// Storage-agnostic backend logic. The Cloudflare Worker runs this against D1;
// the browser preview runs the very same code against an in-memory store.
import Rules from './rules.js'; // @@strip-for-browser

const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randomToken = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const randomId = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return 'R-' + [...crypto.getRandomValues(new Uint8Array(7))].map(b => a[b % a.length]).join(''); };

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function sign(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return body + '.' + sig;
}
async function verify(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const good = b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  if (!safeEqual(sig, good)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body)));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// "pbkdf2$<iterations>$<salt b64u>$<hash b64u>"
async function checkPassword(password, stored) {
  if (!stored || typeof password !== 'string') return false;
  const [kind, iter, salt, hash] = stored.split('$');
  if (kind !== 'pbkdf2') return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64u(salt), iterations: Number(iter) }, key, 256);
  return safeEqual(b64u(bits), hash);
}
async function hashPassword(password, iterations = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${b64u(salt)}$${b64u(bits)}`;
}

const ok = body => ({ status: 200, body });
const err = (status, code, extra = {}) => ({ status, body: { error: code, ...extra } });

function publicSubmission(s) {
  const { editTokenHash, adminNotes, source, ...rest } = s;
  return rest;
}

/**
 * config: { sessionSecret, inviteCodes: {1: code, 2: code}, adminPasswordHash }
 * store: async storage adapter (see worker.js / preview-store.js)
 */
function createService(store, config) {
  const GUEST_TTL = 1000 * 60 * 60 * 24 * 120; // 120 days
  const ADMIN_TTL = 1000 * 60 * 60 * 8;

  async function guestFrom(session) {
    const p = await verify(session, config.sessionSecret);
    return p && p.t === 'g' && Rules.GROUP_IDS.includes(p.g) ? p.g : null;
  }
  async function isAdmin(session) {
    const p = await verify(session, config.sessionSecret);
    return !!(p && p.t === 'a');
  }

  async function siteFor(group) {
    const [content, events, settings] = await Promise.all([store.getContent(), store.getEvents(), store.getSettings()]);
    return {
      group,
      content,
      events: Rules.eligibleEvents(events, group),
      settings: { deadline: settings.deadline, open: Rules.isOpen(settings), helpPhone: settings.helpPhone,
        helpPhoneDisplay: settings.helpPhoneDisplay, mapsUrl: settings.mapsUrl, maxParty: settings.maxParty,
        arrivalMin: settings.arrivalMin, arrivalMax: settings.arrivalMax, departureMin: settings.departureMin, departureMax: settings.departureMax,
        editsOpen: Rules.isOpen(settings) || settings.allowEditsAfterDeadline, simple: Rules.isSimpleGroup(settings, group),
        simpleGroups: Rules.isSimpleGroup(settings, group) ? [group] : [],
        guideContacts: (settings.guideContacts || []).filter(c => c && c.name && c.phone) },
    };
  }

  return {
    hashPassword,

    // Exchange an invitation code for a signed group session.
    async access({ code }, ctx) {
      // Limits are per IP address. Indian mobile networks share one address across many phones,
      // so guest limits are generous; invitation codes are random enough that guessing is not a risk.
      if (!(await store.rate('access:' + ctx.ip, 150, 900))) return err(429, 'rateLimited');
      const c = String(code || '').trim().toUpperCase();
      const h = await sha256(c);
      let group = null;
      for (const g of Rules.GROUP_IDS) if (config.inviteCodes[g] && safeEqual(h, await sha256(String(config.inviteCodes[g]).toUpperCase()))) group = g;
      if (!group) return err(403, 'badCode');
      const session = await sign({ t: 'g', g: group, exp: Date.now() + GUEST_TTL }, config.sessionSecret);
      return { ...ok({ ok: true }), setSession: { name: 'guest', value: session, maxAge: GUEST_TTL / 1000 } };
    },

    async site(_, ctx) {
      const group = await guestFrom(ctx.sessions.guest);
      if (!group) return err(401, 'noAccess');
      return ok(await siteFor(group));
    },

    async submit(input, ctx) {
      const group = await guestFrom(ctx.sessions.guest);
      if (!group) return err(401, 'noAccess');
      if (!(await store.rate('submit:' + ctx.ip, 60, 3600))) return err(429, 'rateLimited');
      const [events, settings] = await Promise.all([store.getEvents(), store.getSettings()]);
      if (!Rules.isOpen(settings)) return err(403, 'deadline');
      const res = Rules.validateRsvp(input, { group, events, settings });
      if (!res.ok) return err(422, 'invalid', { fields: res.errors });
      const all = await store.listSubmissions();
      if (Rules.findDuplicate(all, res.value) && !input.confirmDuplicate) return err(409, 'duplicate');
      const token = randomToken();
      const now = new Date().toISOString();
      const s = { id: randomId(), group, ...res.value, source: 'web', createdAt: now, updatedAt: now, editTokenHash: await sha256(token), adminNotes: '' };
      await store.insertSubmission(s);
      const saved = await store.getSubmission(s.id); // confirm it is really persisted
      if (!saved) return err(500, 'notSaved');
      return ok({ ok: true, submission: publicSubmission(saved), editToken: token });
    },

    async getByToken({ token }, ctx) {
      if (!(await store.rate('edit:' + ctx.ip, 200, 600))) return err(429, 'rateLimited');
      if (typeof token !== 'string' || token.length < 30) return err(404, 'notFound');
      const s = await store.getSubmissionByTokenHash(await sha256(token));
      if (!s) return err(404, 'notFound');
      const site = await siteFor(s.group); // the edit link itself grants access to that party's group view
      const session = await sign({ t: 'g', g: s.group, exp: Date.now() + GUEST_TTL }, config.sessionSecret);
      return { ...ok({ submission: publicSubmission(s), site }), setSession: { name: 'guest', value: session, maxAge: GUEST_TTL / 1000 } };
    },

    async updateByToken({ token, data }, ctx) {
      if (!(await store.rate('edit:' + ctx.ip, 200, 600))) return err(429, 'rateLimited');
      const s = typeof token === 'string' && token.length >= 30 ? await store.getSubmissionByTokenHash(await sha256(token)) : null;
      if (!s) return err(404, 'notFound');
      const [events, settings] = await Promise.all([store.getEvents(), store.getSettings()]);
      if (!Rules.isOpen(settings) && !settings.allowEditsAfterDeadline) return err(403, 'deadline');
      const res = Rules.validateRsvp(data, { group: s.group, events, settings });
      if (!res.ok) return err(422, 'invalid', { fields: res.errors });
      const updated = { ...s, ...res.value, id: s.id, group: s.group, updatedAt: new Date().toISOString() };
      await store.updateSubmission(updated); // same record: edits never double-count
      return ok({ ok: true, submission: publicSubmission(await store.getSubmission(s.id)) });
    },

    // ---------- admin ----------
    async adminLogin({ password }, ctx) {
      if (!(await store.rate('login:' + ctx.ip, 8, 900))) return err(429, 'rateLimited');
      if (!(await checkPassword(password, config.adminPasswordHash))) return err(403, 'badPassword');
      const session = await sign({ t: 'a', exp: Date.now() + ADMIN_TTL }, config.sessionSecret);
      return { ...ok({ ok: true }), setSession: { name: 'admin', value: session, maxAge: ADMIN_TTL / 1000 } };
    },

    async adminData(_, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      const [subs, events, content, settings] = await Promise.all([store.listSubmissions(), store.getEvents(), store.getContent(), store.getSettings()]);
      return ok({ submissions: subs.map(({ editTokenHash, ...s }) => s), events, content, settings, summary: Rules.summarize(subs, events), open: Rules.isOpen(settings) });
    },

    async adminSaveSubmission({ id, data }, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      const [events, settings] = await Promise.all([store.getEvents(), store.getSettings()]);
      const group = Rules.GROUP_IDS.includes(Number(data.group)) ? Number(data.group) : null;
      if (!group) return err(422, 'invalid', { fields: { group: 'required' } });
      const travelTbd = !!data.travelTbd && data.status === 'accept';
      const input = travelTbd ? { ...data, arrivalDate: settings.arrivalMax, arrivalWindow: 'am', departureDate: settings.arrivalMax, departureWindow: 'night' } : data;
      const res = Rules.validateRsvp(input, { group, events, settings });
      if (!res.ok) return err(422, 'invalid', { fields: res.errors });
      if (travelTbd) Object.assign(res.value, { arrivalDate: '', arrivalWindow: '', departureDate: '', departureWindow: '' });
      const now = new Date().toISOString();
      const source = ['web', 'whatsapp', 'phone', 'admin'].includes(data.source) ? data.source : 'admin';
      const adminNotes = Rules.clean(data.adminNotes, 1000);
      if (id) {
        const s = await store.getSubmission(id);
        if (!s) return err(404, 'notFound');
        await store.updateSubmission({ ...s, ...res.value, group, source, adminNotes, updatedAt: now });
        return ok({ ok: true, id });
      }
      const s = { id: randomId(), group, ...res.value, source, adminNotes, createdAt: now, updatedAt: now, editTokenHash: await sha256(randomToken()) };
      await store.insertSubmission(s);
      return ok({ ok: true, id: s.id });
    },

    async adminDeleteSubmission({ id }, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      await store.deleteSubmission(id);
      return ok({ ok: true });
    },

    // Issue a fresh edit link for a party (e.g. a guest lost theirs). Invalidates the old one.
    async adminResetLink({ id }, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      const s = await store.getSubmission(id);
      if (!s) return err(404, 'notFound');
      const token = randomToken();
      await store.updateSubmission({ ...s, editTokenHash: await sha256(token) });
      return ok({ ok: true, editToken: token });
    },

    async adminSaveContent({ content, events, settings }, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      if (content) await store.setContent(content);
      if (events) {
        if (!Array.isArray(events) || !events.length || events.some(e => !e.id || !e.date || !e.start || !Array.isArray(e.groups))) return err(422, 'invalidEvents');
        await store.setEvents(events.map(e => ({ ...e, groups: e.groups.map(Number).filter(g => Rules.GROUP_IDS.includes(g)) })));
      }
      if (settings) {
        if (settings.deadline && isNaN(Date.parse(settings.deadline))) return err(422, 'invalidDeadline');
        await store.setSettings({ ...(await store.getSettings()), ...settings });
      }
      return ok({ ok: true });
    },

    async adminExport({ type }, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      const [subs, events] = await Promise.all([store.listSubmissions(), store.getEvents()]);
      return { status: 200, csv: Rules.exportCsv(type, subs, events), filename: `rsvp-${type || 'responses'}-${new Date().toISOString().slice(0, 10)}.csv` };
    },

    async adminBackup(_, ctx) {
      if (!(await isAdmin(ctx.sessions.admin))) return err(401, 'noAdmin');
      const [submissions, events, content, settings] = await Promise.all([store.listSubmissions(), store.getEvents(), store.getContent(), store.getSettings()]);
      return ok({ exportedAt: new Date().toISOString(), version: 1, submissions, events, content, settings });
    },
  };
}

export { createService, hashPassword, sha256 }; // @@strip-for-browser
