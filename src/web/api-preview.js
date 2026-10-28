// Preview transport: runs the real backend logic (service.js + rules.js) inside the browser
// against an in-memory store mirrored to localStorage. Nothing leaves this browser.
(() => {
  const codes = { 1: 'FRIENDS-PREVIEW', 2: 'FAMILY-PREVIEW', 3: 'GUESTS-PREVIEW', 4: 'RECEPTION-PREVIEW' };
  const store = createMemoryStore('wd_preview_db6');
  // Show the couple's header photo in the preview once (it can still be removed or replaced in the dashboard).
  (async () => { const c = await store.getContent(); if (!c.headerSeeded && window.ASSETS && window.ASSETS['header-photo.jpg']) await store.setContent({ ...c, heroImageUrl: c.heroImageUrl || window.ASSETS['header-photo.jpg'], heroFocus: c.heroFocus || 'lower', headerSeeded: true });
    // …and the couple's four Our Story photos: 1 kiss (large), 2 walking & 3 carry (pair), 4 bench (wide).
    const c2 = await store.getContent();
    if (!c2.storySeeded && window.ASSETS && window.ASSETS['story-1.jpg']) {
      const photos = [0, 1, 2, 3].map(i => { const p = (c2.photos || [])[i] || { caption: { en: '', hi: '' } }; return { ...p, url: p.url || window.ASSETS[`story-${i + 1}.jpg`] }; });
      await store.setContent({ ...c2, photos, storySeeded: true });
    }
    const c3 = await store.getContent();
    if (!c3.venueSeeded) await store.setContent({ ...c3, venueImageUrl: c3.venueImageUrl || '/assets/venue-photo.jpg', venueSeeded: true }); })();
  const sessKey = 'wd_preview_sessions';
  let sessions = {};
  try { sessions = JSON.parse(sessionStorage.getItem(sessKey) || '{}'); } catch {}
  const keep = () => { try { sessionStorage.setItem(sessKey, JSON.stringify(sessions)); } catch {} };
  let svc;
  const ready = (async () => {
    svc = createService(store, { sessionSecret: 'preview-only-secret-not-used-in-production-0001', inviteCodes: codes, adminPasswordHash: await hashPassword('preview-admin', 2000) });
  })();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const routes = {
    'POST /api/access': 'access', 'GET /api/site': 'site', 'POST /api/rsvp': 'submit', 'POST /api/rsvp/lookup': 'getByToken', 'PUT /api/rsvp': 'updateByToken',
    'POST /api/admin/login': 'adminLogin', 'GET /api/admin/data': 'adminData', 'POST /api/admin/submission': 'adminSaveSubmission',
    'POST /api/admin/delete': 'adminDeleteSubmission', 'POST /api/admin/reset-link': 'adminResetLink', 'POST /api/admin/content': 'adminSaveContent',
    'GET /api/admin/backup': 'adminBackup',
  };
  window.API = {
    async call(method, path, body) {
      await ready; await sleep(180);
      if (path === '/api/admin/logout') { delete sessions.admin; keep(); return { status: 200, body: { ok: true } }; }
      const fn = routes[method + ' ' + path];
      if (!fn) return { status: 404, body: { error: 'notFound' } };
      const r = await svc[fn](JSON.parse(JSON.stringify(body || {})), { ip: 'preview', sessions });
      if (r.setSession) { sessions[r.setSession.name] = r.setSession.value; keep(); }
      return { status: r.status, body: r.body };
    },
    async download(path) {
      await ready;
      const type = new URL(path, 'https://x').searchParams.get('type');
      const r = await svc.adminExport({ type }, { ip: 'preview', sessions });
      if (r.status !== 200) throw new Error('denied');
      return { blob: new Blob([r.csv], { type: 'text/csv' }), filename: r.filename };
    },
    async upload(file) { // preview keeps images as data URLs
      const url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
      return { status: 200, body: { ok: true, url } };
    },
  };
  window.PREVIEW = {
    codes,
    logout() { delete sessions.guest; keep(); },
    reset() { store.reset(); sessions = {}; keep(); },
  };
})();
