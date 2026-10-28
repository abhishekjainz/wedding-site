// Shared rules: default content, validation and reporting maths.
// Used by the production Worker (server-side enforcement) and by the
// browser preview's simulated backend, so both behave identically.

const WINDOWS = ['am', 'mid', 'eve', 'night']; // before noon | noon–5 PM | 5–9 PM | after 9 PM

const GROUPS = { 1: 'Friends', 2: 'Close Family', 3: 'Family & Guests', 4: 'Other Guests' };
const GROUP_IDS = [1, 2, 3, 4];

// ---------- helpers ----------
const clean = (s, max = 200) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’.\-]*(?: [\p{L}\p{M}][\p{L}\p{M}'’.\-]*)+$/u;
const isFullName = s => s.length >= 3 && s.length <= 80 && NAME_RE.test(s);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const normKey = s => clean(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '');

function normalizePhone(cc, num) {
  const c = String(cc || '').replace(/[^\d]/g, '');
  let n = String(num || '').replace(/[^\d]/g, '');
  if (c === '91' && n.length === 11 && n.startsWith('0')) n = n.slice(1);
  const e164 = '+' + c + n;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  if (c === '91' && !/^[6-9]\d{9}$/.test(n)) return null;
  return e164;
}

function isOpen(settings, now = new Date()) {
  return settings.adminOverrideOpen || now.getTime() <= Date.parse(settings.deadline);
}

function eligibleEvents(events, group) {
  return events.filter(e => e.groups.includes(Number(group))).sort((a, b) => a.sort - b.sort);
}

// Every date an event covers (one for normal events, several for e.g. the Home Days).
function eventDays(e) {
  if (!e.endDate || e.endDate <= e.date) return [e.date];
  const out = [];
  for (let d = new Date(e.date + 'T00:00:00Z'); d <= new Date(e.endDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

// What a guest can tick: one option per normal event, one per day of a multi-day event ("home-days@2027-02-09").
function eventOptions(events) {
  const out = [];
  for (const e of [...events].sort((a, b) => a.sort - b.sort)) {
    const days = eventDays(e);
    if (days.length === 1) out.push({ id: e.id, eventId: e.id, date: e.date, title: e.title });
    else days.forEach(d => out.push({ id: `${e.id}@${d}`, eventId: e.id, date: d, title: e.title, multi: true }));
  }
  return out;
}

const isSimpleGroup = (settings, group) => (settings.simpleGroups || []).includes(Number(group));
const isFullGroup = (settings, group) => (settings.fullGroups || []).includes(Number(group));

/**
 * Validate a guest RSVP payload. Never trusts the client: group comes from the
 * signed access session, eligibility from the events source of truth.
 * Returns { ok, errors: {field: code}, value }.
 */
function validateRsvp(input, { group, events, settings }) {
  const errors = {};
  const v = {};
  input = input && typeof input === 'object' ? input : {};

  v.primaryName = clean(input.primaryName, 80);
  if (!v.primaryName) errors.primaryName = 'required';
  else if (!isFullName(v.primaryName)) errors.primaryName = 'fullName';

  v.phone = normalizePhone(input.phoneCc, input.phoneNumber);
  if (!clean(input.phoneNumber)) errors.phone = 'required';
  else if (!v.phone) errors.phone = 'phone';

  v.status = input.status === 'accept' ? 'accept' : input.status === 'decline' ? 'decline' : null;
  if (!v.status) errors.status = 'required';

  v.note = clean(input.note, 1000);

  if (v.status === 'accept') {
    const size = Number(input.partySize);
    v.partySize = Number.isInteger(size) && size >= 1 && size <= settings.maxParty ? size : null;
    if (!v.partySize) errors.partySize = 'partySize';
    const guests = Array.isArray(input.guests) ? input.guests.slice(0, v.partySize || 0) : [];
    v.guests = guests.map(g => clean(typeof g === 'string' ? g : g && g.name, 80));
    if (v.partySize) {
      for (let i = 0; i < v.partySize; i++) {
        const g = v.guests[i] || '';
        if (!g) errors['guest' + i] = 'required';
        else if (!isFullName(g)) errors['guest' + i] = 'fullName';
      }
      const seen = new Set();
      v.guests.forEach((g, i) => { const k = normKey(g); if (k && seen.has(k)) errors['guest' + i] = 'dupGuest'; seen.add(k); });
    }

    const options = eventOptions(eligibleEvents(events, group)).map(o => o.id);
    const allowed = new Set(options);
    const simple = isSimpleGroup(settings, group);
    const picked = Array.isArray(input.events) ? [...new Set(input.events.map(String))] : [];
    const full = !simple && isFullGroup(settings, group);
    if (simple || full) v.events = options; // attending means every event the group is invited to
    else {
      if (picked.some(id => !allowed.has(id))) errors.events = 'eventForbidden';
      else if (picked.length === 0) errors.events = 'eventsMin';
      v.events = picked.filter(id => allowed.has(id));
    }
    if (simple) {
      Object.assign(v, { arrivalDate: '', arrivalWindow: '', departureDate: '', departureWindow: '', songName: '', songArtist: '', songUrl: '', questions: '' });
      return { ok: Object.keys(errors).length === 0, errors, value: v };
    }

    v.arrivalDate = clean(input.arrivalDate, 10);
    v.arrivalWindow = WINDOWS.includes(input.arrivalWindow) ? input.arrivalWindow : '';
    v.departureDate = clean(input.departureDate, 10);
    v.departureWindow = WINDOWS.includes(input.departureWindow) ? input.departureWindow : '';
    if (!isDate(v.arrivalDate)) errors.arrivalDate = 'required';
    else if (v.arrivalDate < settings.arrivalMin || v.arrivalDate > settings.arrivalMax) errors.arrivalDate = 'dateRange';
    if (!v.arrivalWindow) errors.arrivalWindow = 'required';
    if (!isDate(v.departureDate)) errors.departureDate = 'required';
    else if (v.departureDate < settings.departureMin || v.departureDate > settings.departureMax) errors.departureDate = 'dateRange';
    if (!v.departureWindow) errors.departureWindow = 'required';
    if (!errors.arrivalDate && !errors.departureDate && v.arrivalWindow && v.departureWindow) {
      if (v.departureDate < v.arrivalDate ||
          (v.departureDate === v.arrivalDate && WINDOWS.indexOf(v.departureWindow) < WINDOWS.indexOf(v.arrivalWindow))) {
        errors.departureDate = 'depBeforeArr';
      }
    }

    v.songName = full ? '' : clean(input.songName, 120);
    v.songArtist = full ? '' : clean(input.songArtist, 120);
    v.songUrl = full ? '' : clean(input.songUrl, 300);
    if (v.songUrl && !/^https:\/\/[^\s<>"']+\.[^\s<>"']+$/i.test(v.songUrl)) errors.songUrl = 'url';
    v.questions = clean(input.questions, 1500);
  } else {
    // A decline carries no party, events, or travel details.
    Object.assign(v, { partySize: 0, guests: [], events: [], arrivalDate: '', arrivalWindow: '', departureDate: '', departureWindow: '', songName: '', songArtist: '', songUrl: '', questions: '' });
  }
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

// Guests sleeping in Indore each night: arrival date inclusive, departure date exclusive.
// This is guest-nights, NOT a hotel room count.
function guestNights(submissions) {
  const nights = {};
  for (const s of submissions) {
    if (s.status !== 'accept' || !isDate(s.arrivalDate) || !isDate(s.departureDate)) continue;
    const n = (s.guests || []).length;
    for (let d = new Date(s.arrivalDate + 'T00:00:00Z'); d < new Date(s.departureDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      nights[k] = (nights[k] || 0) + n;
    }
  }
  return Object.keys(nights).sort().map(date => ({ date, guests: nights[date] }));
}

// Flags submissions that share a phone number, primary name or any guest name.
function duplicateFlags(submissions) {
  const by = {};
  const add = (k, id) => { if (k) (by[k] = by[k] || new Set()).add(id); };
  for (const s of submissions) {
    add('p:' + s.phone, s.id);
    add('n:' + normKey(s.primaryName), s.id);
    (s.guests || []).forEach(g => add('n:' + normKey(g), s.id));
  }
  const flags = {};
  for (const [k, ids] of Object.entries(by)) {
    if (ids.size < 2) continue;
    for (const id of ids) (flags[id] = flags[id] || new Set()).add(k.startsWith('p:') ? 'phone' : 'name');
  }
  return Object.fromEntries(Object.entries(flags).map(([id, set]) => [id, [...set]]));
}

function findDuplicate(submissions, v, excludeId) {
  const names = new Set([v.primaryName, ...(v.guests || [])].map(normKey).filter(Boolean));
  return submissions.find(s => s.id !== excludeId &&
    (s.phone === v.phone || [s.primaryName, ...(s.guests || [])].some(n => names.has(normKey(n))))) || null;
}

// Hotel stay for one party: which nights fall inside the hosted window for their group, which are outside it
// (they arrive earlier or leave later), and whether they leave after check-out time on the last day.
const addDay = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function stayFor(s, settings) {
  const from = ((settings && settings.stayFrom) || {})[s.group], until = settings && settings.stayUntil;
  const out = { hosted: [], before: [], after: [], lateCheckout: false, hostedGroup: !!(from && until) };
  if (s.status !== 'accept' || !isDate(s.arrivalDate) || !isDate(s.departureDate) || !out.hostedGroup) return out;
  for (let d = s.arrivalDate; d < s.departureDate; d = addDay(d, 1)) (d < from ? out.before : d >= until ? out.after : out.hosted).push(d);
  out.lateCheckout = s.departureDate === until && !!s.departureWindow && s.departureWindow !== 'am';
  return out;
}
const roomsFor = (s, settings) => Math.max(1, Math.ceil((s.guests || []).length / ((settings && settings.roomOccupancy) || 2)));
// Rooms needed per hosted night, from each party's own arrival and departure (nobody is counted after they've left).
function roomNights(submissions, settings) {
  const nights = {};
  for (const s of submissions) {
    const st = stayFor(s, settings);
    for (const d of st.hosted) {
      const n = nights[d] = nights[d] || { date: d, rooms: 0, guests: 0, parties: 0 };
      n.rooms += roomsFor(s, settings); n.guests += s.guests.length; n.parties += 1;
    }
  }
  return Object.values(nights).sort((a, b) => a.date.localeCompare(b.date));
}

function summarize(submissions, events, settings) {
  const acc = submissions.filter(s => s.status === 'accept');
  const perEvent = eventOptions(events).map(o => ({
    id: o.id, title: o.title.en, date: o.date, multi: !!o.multi,
    guests: acc.filter(s => s.events.includes(o.id)).reduce((t, s) => t + s.guests.length, 0),
    parties: acc.filter(s => s.events.includes(o.id)).length,
  }));
  const byGroup = GROUP_IDS.map(g => {
    const sub = submissions.filter(s => s.group === g);
    return { group: g, label: GROUPS[g], accepted: sub.filter(s => s.status === 'accept').length,
      declined: sub.filter(s => s.status === 'decline').length,
      guests: sub.filter(s => s.status === 'accept').reduce((t, s) => t + s.guests.length, 0) };
  });
  const dist = key => {
    const out = {};
    acc.forEach(s => { const k = s[key + 'Date'] + '|' + s[key + 'Window']; out[k] = (out[k] || 0) + s.guests.length; });
    return Object.keys(out).sort().map(k => ({ date: k.split('|')[0], window: k.split('|')[1], guests: out[k] }));
  };
  return {
    accepted: acc.length,
    declined: submissions.filter(s => s.status === 'decline').length,
    totalGuests: acc.reduce((t, s) => t + s.guests.length, 0),
    perEvent, byGroup,
    arrivals: dist('arrival'), departures: dist('departure'),
    nights: guestNights(submissions),
    roomNights: roomNights(submissions, settings),
    stayExceptions: submissions.filter(s => s.status === 'accept').map(s => ({ s, st: stayFor(s, settings) }))
      .filter(x => x.st.before.length || x.st.after.length || x.st.lateCheckout)
      .map(({ s, st }) => ({ id: s.id, name: s.primaryName, group: s.group, guests: s.guests.length, before: st.before, after: st.after, lateCheckout: st.lateCheckout,
        departure: s.departureDate, departureWindow: s.departureWindow })),
    duplicates: duplicateFlags(submissions),
  };
}

function toCsv(rows) {
  const esc = v => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
}

const WINDOW_LABEL = { am: 'Before noon', mid: 'Noon–5 PM', eve: '5–9 PM', night: 'After 9 PM' };

function exportCsv(type, submissions, events, settings) {
  if (type === 'guests') {
    const rows = [['Guest full name', 'Party ID', 'Primary contact', 'WhatsApp', 'Group', 'Events', 'Arrival date', 'Arrival window', 'Departure date', 'Departure window']];
    submissions.filter(s => s.status === 'accept').forEach(s => s.guests.forEach(g => rows.push([
      g, s.id, s.primaryName, s.phone, GROUPS[s.group], s.events.join('; '),
      s.arrivalDate, WINDOW_LABEL[s.arrivalWindow], s.departureDate, WINDOW_LABEL[s.departureWindow]])));
    return toCsv(rows);
  }
  if (type === 'nights') {
    const rn = Object.fromEntries(roomNights(submissions, settings).map(n => [n.date, n]));
    return toCsv([['Night of', 'Guests in Indore (all)', 'Hosted guests', 'Hosted parties', `Rooms needed (≈${(settings && settings.roomOccupancy) || 2} per room)`],
      ...guestNights(submissions).map(n => [n.date, n.guests, (rn[n.date] || {}).guests || 0, (rn[n.date] || {}).parties || 0, (rn[n.date] || {}).rooms || 0])]);
  }
  const rows = [['Party ID', 'Submitted', 'Updated', 'Source', 'Group', 'Status', 'Primary contact', 'WhatsApp', 'Party size', 'Guest names',
    ...eventOptions(events).map(o => o.multi ? `${o.title.en} (${o.date})` : o.title.en), 'Arrival date', 'Arrival window', 'Departure date', 'Departure window',
    'Song', 'Artist', 'Song link', 'Questions', 'Note']];
  submissions.forEach(s => rows.push([s.id, s.createdAt, s.updatedAt, s.source, GROUPS[s.group], s.status, s.primaryName, s.phone,
    s.guests.length, s.guests.join('; '), ...eventOptions(events).map(o => (s.events.includes(o.id) ? 'Yes' : '')),
    s.arrivalDate, WINDOW_LABEL[s.arrivalWindow] || '', s.departureDate, WINDOW_LABEL[s.departureWindow] || '',
    s.songName, s.songArtist, s.songUrl, s.questions, s.note]));
  return toCsv(rows);
}

const Rules = { WINDOWS, WINDOW_LABEL, GROUPS, GROUP_IDS, eventDays, eventOptions, isSimpleGroup, isFullGroup, stayFor, roomNights,
  clean, isFullName, normalizePhone, isOpen, eligibleEvents, validateRsvp, guestNights,
  duplicateFlags, findDuplicate, summarize, exportCsv, toCsv };
export default Rules; // @@strip-for-browser
