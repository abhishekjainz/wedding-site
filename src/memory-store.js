// In-memory storage adapter with the same interface as the D1 store.
// Used by the browser preview (optionally mirrored to localStorage) and by the tests.
import Defaults from './defaults.js'; // @@strip-for-browser
import Rules from './rules.js'; // @@strip-for-browser

function createMemoryStore(persistKey) {
  const clone = x => JSON.parse(JSON.stringify(x));
  let db = { submissions: [], events: clone(Defaults.DEFAULT_EVENTS), content: clone(Defaults.DEFAULT_CONTENT), settings: clone(Defaults.DEFAULT_SETTINGS), rate: {} };
  if (persistKey) {
    try { const saved = JSON.parse(localStorage.getItem(persistKey) || 'null'); if (saved && saved.v === 2) db = { ...db, ...saved.db, settings: { ...db.settings, ...saved.db.settings }, content: { ...db.content, ...saved.db.content }, rate: {} }; } catch {}
  }
  const save = () => { if (persistKey) { try { localStorage.setItem(persistKey, JSON.stringify({ v: 2, db: { ...db, rate: {} } })); } catch {} } };
  return {
    reset() { db = { submissions: [], events: clone(Defaults.DEFAULT_EVENTS), content: clone(Defaults.DEFAULT_CONTENT), settings: clone(Defaults.DEFAULT_SETTINGS), rate: {} }; save(); },
    async listSubmissions() { return clone(db.submissions); },
    async getSubmission(id) { const s = db.submissions.find(x => x.id === id); return s ? clone(s) : null; },
    async getSubmissionByTokenHash(h) { const s = db.submissions.find(x => x.editTokenHash === h); return s ? clone(s) : null; },
    async insertSubmission(s) { if (db.submissions.some(x => x.id === s.id)) throw new Error('exists'); db.submissions.push(clone(s)); save(); },
    async updateSubmission(s) { const i = db.submissions.findIndex(x => x.id === s.id); if (i < 0) throw new Error('missing'); db.submissions[i] = clone(s); save(); },
    async deleteSubmission(id) { db.submissions = db.submissions.filter(x => x.id !== id); save(); },
    async getEvents() { return clone(db.events).sort((a, b) => a.sort - b.sort); },
    async setEvents(e) { db.events = clone(e); const ids = new Set(Rules.eventOptions(e).map(x => x.id)); db.submissions.forEach(s => (s.events = s.events.filter(x => ids.has(x)))); save(); },
    async getContent() { return clone(db.content); },
    async setContent(c) { db.content = clone(c); save(); },
    async getSettings() { return clone(db.settings); },
    async setSettings(s) { db.settings = clone(s); save(); },
    async rate(key, limit, windowSec) {
      const now = Date.now() / 1000; const r = db.rate[key];
      if (!r || r.start <= now - windowSec) { db.rate[key] = { start: now, count: 1 }; return true; }
      return ++r.count <= limit;
    },
  };
}
export { createMemoryStore }; // @@strip-for-browser
