// Organizer dashboard: login, metrics, responses, guests, accommodation, music & messages, content, settings.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = () => $('#app');
  const GROUP = Rules.GROUPS; // 1 Friends · 2 Close Family · 3 Family & Guests · 4 Other Guests (reception only)
  const gname = g => `${g} · ${GROUP[g]}`;
  const WIN = { am: 'Before noon', mid: 'Noon–5 PM', eve: '5–9 PM', night: 'After 9 PM' };
  let D = null, tab = 'overview', q = '', filt = { status: '', group: '', dup: false };
  const fmtD = d => { if (!d) return '—'; const x = new Date(d + 'T00:00:00Z'); return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); };
  const fmtTs = ts => ts ? new Date(ts).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const evTitle = id => { const [eid, day] = id.split('@'); const t = (D.events.find(e => e.id === eid) || { title: { en: eid } }).title.en; return day ? `${t} (${fmtD(day)})` : t; };
  const isSimple = g => (D.settings.simpleGroups || []).includes(Number(g));
  const call = async (m, p, b) => { try { return await window.API.call(m, p, b); } catch { return { status: 0, body: { error: 'network' } }; } };
  // In-page dialogs: browser confirm()/prompt() are silently blocked in sandboxed viewers.
  function ask(msg, okLabel = 'Confirm', text) {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'modal'; m.style.zIndex = 400; m.setAttribute('role', 'alertdialog');
      m.innerHTML = `<div class="box paper"><p style="margin:0 0 12px">${esc(msg)}</p>${text ? `<textarea class="input" readonly rows="3" style="font:13px ui-monospace,monospace">${esc(text)}</textarea>` : ''}
        <div class="btnrow">${text ? '' : '<button type="button" class="btn ghost" data-r="0">Cancel</button>'}<button type="button" class="btn" data-r="1">${esc(okLabel)}</button></div></div>`;
      document.body.appendChild(m);
      const ta = m.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
      m.querySelectorAll('[data-r]').forEach(b => (b.onclick = () => { m.remove(); res(b.dataset.r === '1'); }));
    });
  }
  function toast(msg, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

  function login(msg) {
    root().innerHTML = `<div class="gate paper">${Art.corner('tl')}<img class="logo sm" src="${(window.ASSETS && window.ASSETS['mono.webp']) || '/assets/mono.webp'}" alt="">
      <p class="caps" style="margin-top:14px">Organizer dashboard</p>
      <form id="lf" style="max-width:300px;margin:18px auto 0;display:grid;gap:10px">
        <label class="sr" for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" placeholder="Password" style="text-align:center">
        <button class="btn block" type="button" id="lfGo">Sign in</button>${msg ? `<p class="formerr">${esc(msg)}</p>` : ''}</form>
      ${window.PREVIEW ? `<p class="muted" style="font-size:14px;margin-top:18px">Preview password: <code>preview-admin</code> · <button type="button" class="linkbtn" data-go="guest">Back to guest site</button></p>` : ''}</div>`;
    const go = async () => {
      const r = await call('POST', '/api/admin/login', { password: $('#pw').value });
      if (r.status === 200) return load();
      login(r.status === 429 ? 'Too many attempts — wait 15 minutes.' : 'Incorrect password.');
    };
    $('#lf').onsubmit = e => e.preventDefault();
    $('#lfGo').onclick = go;
    $('#pw').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    $('#pw').focus();
  }

  async function load() {
    const r = await call('GET', '/api/admin/data');
    if (r.status === 401) return login();
    if (r.status !== 200) return login('Could not reach the server.');
    D = r.body; render();
  }

  const stat = (n, label, sub) => `<div class="stat"><b>${n}</b><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  function bars(rows, max) { max = max || Math.max(1, ...rows.map(r => r.v)); return `<div class="bars">${rows.map(r => `<div class="bar"><span class="bl">${r.l}</span><span class="bt"><i style="width:${(r.v / max * 100).toFixed(1)}%"></i></span><b>${r.v}</b></div>`).join('')}</div>`; }

  function overview() {
    const s = D.summary;
    const dupCount = Object.keys(s.duplicates).length;
    const questions = D.submissions.filter(x => x.questions || x.note).length;
    return `<div class="stats">${stat(s.accepted, 'Accepted parties')}${stat(s.declined, 'Declined')}${stat(s.totalGuests, 'Attending guests', 'individual people')}${stat(dupCount, 'Possible duplicates', dupCount ? 'review in Responses' : '')}</div>
      <div class="cardx"><h3>Attendance by event</h3>${bars(s.perEvent.map(e => ({ l: `${esc(e.title)} <small>${fmtD(e.date)}</small>`, v: e.guests })))}
        <p class="hint">Guests counted per party selection; the Home Days are counted day by day. Who can choose what: Friends — everything incl. Home Days · Close Family — all events · Family & Guests — all except Mehendi · Other Guests — Reception only.</p></div>
      <div class="cardx"><h3>By invitation group</h3><table class="tbl"><tr><th>Group</th><th>Accepted</th><th>Declined</th><th>Guests</th></tr>
        ${s.byGroup.map(g => `<tr><td>${esc(g.label)}</td><td>${g.accepted}</td><td>${g.declined}</td><td>${g.guests}</td></tr>`).join('')}</table></div>
      <div class="cardx"><h3>Rooms needed per night</h3>${s.roomNights.length ? bars(s.roomNights.map(n => ({ l: fmtD(n.date), v: n.rooms }))) : '<p class="hint">No travel details yet.</p>'}<p class="hint">Hosted stay only; details on the Accommodation tab.</p></div>
      <div class="cardx"><h3>Status</h3><p>RSVPs are <b>${D.open ? 'open' : 'closed'}</b>. Deadline: ${esc(fmtTs(D.settings.deadline))} IST${D.settings.adminOverrideOpen ? ' (override: open)' : ''}.</p>
        <p>${questions} response(s) include a question or message.</p></div>`;
  }

  function matches(s) {
    if (filt.status && s.status !== filt.status) return false;
    if (filt.group && String(s.group) !== filt.group) return false;
    if (filt.dup && !D.summary.duplicates[s.id]) return false;
    if (!q) return true;
    const hay = [s.id, s.primaryName, s.phone, ...s.guests, s.questions, s.note, s.songName].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  }
  function responses() {
    const list = D.submissions.filter(matches).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return `<div class="toolbar"><input class="input" id="q" placeholder="Search names, phone, ID…" value="${esc(q)}">
      <select class="input" id="fs"><option value="">All statuses</option><option value="accept" ${filt.status === 'accept' ? 'selected' : ''}>Accepted</option><option value="decline" ${filt.status === 'decline' ? 'selected' : ''}>Declined</option></select>
      <select class="input" id="fg"><option value="">All groups</option>${Rules.GROUP_IDS.map(g => `<option value="${g}" ${filt.group === String(g) ? 'selected' : ''}>${esc(gname(g))}</option>`).join('')}</select>
      <label class="check" style="margin:0"><input type="checkbox" id="fd" ${filt.dup ? 'checked' : ''}> Duplicates only</label>
      <button class="btn" data-a="new">+ Add WhatsApp / phone reply</button></div>
      <p class="hint">${list.length} of ${D.submissions.length} responses</p>
      <div class="rlist">${list.map(s => `<button class="rcard" data-edit="${esc(s.id)}">
        <div><b>${esc(s.primaryName)}</b> <span class="tag ${s.status}">${s.status === 'accept' ? 'Accepted' : 'Declined'}</span> <span class="tag">${esc(gname(s.group))}</span>
          ${s.source !== 'web' ? `<span class="tag">${esc(s.source)}</span>` : ''}${D.summary.duplicates[s.id] ? `<span class="tag dup">Possible duplicate (${D.summary.duplicates[s.id].join(', ')})</span>` : ''}</div>
        <div class="muted">${esc(s.phone)} · ${esc(s.id)} · updated ${esc(fmtTs(s.updatedAt))}</div>
        ${s.status === 'accept' ? `<div>${s.guests.length} guest(s): ${s.guests.map(esc).join(', ')}</div><div class="muted">${s.events.map(evTitle).map(esc).join(' · ')}</div>
          <div class="muted">${s.arrivalDate ? `${fmtD(s.arrivalDate)} ${WIN[s.arrivalWindow]} → ${fmtD(s.departureDate)} ${WIN[s.departureWindow]}` : '<span class="tag dup">Travel TBD</span>'}</div>` : (s.note ? `<div class="muted">“${esc(s.note)}”</div>` : '')}
      </button>`).join('') || '<p class="hint">No responses match.</p>'}</div>`;
  }

  function guests() {
    const rows = [];
    D.submissions.filter(s => s.status === 'accept').forEach(s => s.guests.forEach(g => rows.push({ g, s })));
    const f = rows.filter(r => !q || (r.g + ' ' + r.s.primaryName).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.g.localeCompare(b.g));
    return `<div class="toolbar"><input class="input" id="q" placeholder="Search guest names…" value="${esc(q)}"><button class="btn ghost" data-dl="guests">Export guests CSV</button></div>
      <p class="hint">${f.length} attending guest(s)</p>
      <div class="scrollx"><table class="tbl"><tr><th>Guest</th><th>Party (primary contact)</th><th>Group</th><th>Events</th><th>Stay</th></tr>
      ${f.map(r => `<tr><td>${esc(r.g)}</td><td><a href="#" data-edit="${esc(r.s.id)}">${esc(r.s.primaryName)}</a><br><small class="muted">${esc(r.s.id)}</small></td><td>${esc(GROUP[r.s.group])}</td><td>${r.s.events.length}</td><td>${r.s.arrivalDate ? `${fmtD(r.s.arrivalDate)} → ${fmtD(r.s.departureDate)}` : 'TBD'}</td></tr>`).join('')}</table></div>`;
  }

  function accommodation() {
    const s = D.summary;
    const tbd = D.submissions.filter(x => x.status === 'accept' && !x.arrivalDate);
    const distTable = rows => rows.length ? `<table class="tbl"><tr><th>Date</th><th>Time window</th><th>Guests</th></tr>${rows.map(r => `<tr><td>${fmtD(r.date)}</td><td>${esc(WIN[r.window] || '—')}</td><td>${r.guests}</td></tr>`).join('')}</table>` : '<p class="hint">None yet.</p>';
    const st = D.settings, occ = st.roomOccupancy || 2;
    const sf = st.stayFrom || {};
    const ct = (st.checkoutTime || '12:00');
    const roomsTable = s.roomNights.length ? `<table class="tbl"><tr><th>Night of</th><th>Rooms needed</th><th>Guests</th><th>Parties</th></tr>${s.roomNights.map(n => `<tr><td>${fmtD(n.date)}</td><td><b>${n.rooms}</b></td><td>${n.guests}</td><td class="muted">${n.parties}</td></tr>`).join('')}
        <tr><td><b>Total room-nights</b></td><td><b>${s.roomNights.reduce((t, n) => t + n.rooms, 0)}</b></td><td>${s.roomNights.reduce((t, n) => t + n.guests, 0)}</td><td></td></tr></table>` : '<p class="hint">No travel details yet.</p>';
    const ex = s.stayExceptions || [];
    const exRow = x => `<tr><td><a href="#" data-edit="${esc(x.id)}">${esc(x.name)}</a> <span class="muted">(${x.guests}, ${esc(gname(x.group))})</span></td><td>${[
      x.before.length ? `Arrives early: ${x.before.length} night(s) before the hosted stay (${x.before.map(fmtD).join(', ')})` : '',
      x.after.length ? `Stays on: ${x.after.length} night(s) after check-out (${x.after.map(fmtD).join(', ')})` : '',
      x.lateCheckout ? `Leaves ${fmtD(x.departure)} ${esc(WIN[x.departureWindow] || '')}: after the ${esc(ct)} check-out` : ''].filter(Boolean).join('<br>')}</td></tr>`;
    return `<div class="callout"><b>Hosted stay:</b> Friends from ${fmtD(sf[1] || '')}, Close Family from ${fmtD(sf[2] || '')}, Family & Guests from ${fmtD(sf[3] || '')}, until check-out at ${esc(ct)} on ${fmtD(st.stayUntil || '')}. Each party is counted only for the nights it is actually in Indore inside that window: from its arrival date up to the night before its departure date, so someone flying out on 14 Feb isn't counted for the night of the 14th.</div>
      <div class="cardx"><h3>Rooms needed each night (hosted stay)</h3>${roomsTable}
        <p class="hint">Rooms are estimated per party at ${occ} guests per room, rounded up (a party of 3 = 2 rooms). Change the estimate under Settings.</p>
        <div class="btnrow" style="justify-content:flex-start"><button class="btn ghost" data-dl="nights">Export nights CSV</button><button class="btn ghost" data-dl="guests">Export guest list CSV</button></div></div>
      <div class="cardx"><h3>Outside the hosted stay (${ex.length})</h3>${ex.length ? `<table class="tbl">${ex.map(exRow).join('')}</table><p class="hint">Not counted in the rooms above: arrange or confirm these separately (early check-in, extra nights, late check-out).</p>` : '<p class="hint">Everyone fits inside the hosted stay so far.</p>'}</div>
      ${tbd.length ? `<div class="cardx"><h3>Travel not yet known (${tbd.reduce((t, x) => t + x.guests.length, 0)} guests)</h3><p>${tbd.map(x => `<a href="#" data-edit="${esc(x.id)}">${esc(x.primaryName)}</a> (${x.guests.length})`).join(', ')}</p><p class="hint">Not included in the nightly counts above.</p></div>` : ''}
      <div class="cardx"><h3>Everyone in Indore each night (incl. outside the hosted stay)</h3>${s.nights.length ? `<table class="tbl"><tr><th>Night of</th><th>Guests</th></tr>${s.nights.map(n => `<tr><td>${fmtD(n.date)}</td><td>${n.guests}</td></tr>`).join('')}</table>` : '<p class="hint">No travel details yet.</p>'}</div>
      <div class="cardx"><h3>Arrivals</h3>${distTable(s.arrivals.filter(r => r.date))}</div>
      <div class="cardx"><h3>Departures</h3>${distTable(s.departures.filter(r => r.date))}</div>`;
  }

  function music() {
    const songs = D.submissions.filter(s => s.songName || s.songArtist);
    const qs = D.submissions.filter(s => s.questions);
    const notes = D.submissions.filter(s => s.note);
    const safeUrl = u => /^https:\/\//i.test(u) ? u : '';
    return `<div class="cardx"><h3>Song requests (${songs.length})</h3>${songs.length ? `<table class="tbl"><tr><th>Song</th><th>Artist</th><th>From</th></tr>${songs.map(s => `<tr><td>${safeUrl(s.songUrl) ? `<a href="${esc(s.songUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.songName || 'link')}</a>` : esc(s.songName)}</td><td>${esc(s.songArtist)}</td><td>${esc(s.primaryName)}</td></tr>`).join('')}</table>` : '<p class="hint">None yet.</p>'}</div>
      <div class="cardx"><h3>Questions from guests (${qs.length})</h3>${qs.map(s => `<div class="msgq"><p>${esc(s.questions)}</p><small class="muted">${esc(s.primaryName)} · <a href="https://wa.me/${esc(s.phone.replace('+', ''))}" target="_blank" rel="noopener">WhatsApp ${esc(s.phone)}</a></small></div>`).join('') || '<p class="hint">None yet.</p>'}</div>
      <div class="cardx"><h3>Messages with declines (${notes.length})</h3>${notes.map(s => `<div class="msgq"><p>${esc(s.note)}</p><small class="muted">${esc(s.primaryName)}</small></div>`).join('') || '<p class="hint">None yet.</p>'}</div>`;
  }

  // ---------- content editing ----------
  const bi = (path, label, val, area) => `<div class="field"><label>${esc(label)}</label><div class="bi">
    ${['en', 'hi'].map(l => area ? `<textarea class="input" data-c="${path}.${l}" placeholder="${l.toUpperCase()}" rows="${area}">${esc((val || {})[l])}</textarea>` : `<input class="input" data-c="${path}.${l}" placeholder="${l.toUpperCase()}" value="${esc((val || {})[l])}">`).join('')}</div></div>`;
  function content() {
    const c = D.content;
    return `<p class="hint">Edits go live for guests as soon as you save. Left = English, right = Hindi (Hindi copy is a draft pending review).</p>
      <div class="cardx"><h3>Welcome & story</h3>${bi('welcome', 'Welcome line', c.welcome, 2)}${bi('story', 'Our Story — each line appears as its own line of the poem', c.story, 8)}
        <p class="hint">Dates are shown automatically from the events each group is invited to (Friends 9 – 14, Close Family 12 – 14, Family & Guests and Other Guests 13 – 14 February).</p></div>
      <div class="cardx"><h3>Photos</h3><p class="hint">Images are resized to 1600px before upload.</p>
        <div class="field"><label>Header photo — shown softly, like a translucent wash, behind your monogram and names (a wide or portrait photo with space around you works best)</label><div class="pslot wide">${c.heroImageUrl ? `<img src="${esc(c.heroImageUrl)}" alt="">` : '<div class="empty">Placeholder shown</div>'}
        <label class="btn ghost small">Upload<input type="file" accept="image/*" data-up="hero" hidden></label>
        <label style="font-size:13px">Photo focus <select class="input" data-c="heroFocus" style="min-height:38px;width:auto;display:inline-block">${['top', 'middle', 'lower', 'bottom'].map(v => `<option value="${v}" ${(c.heroFocus || 'lower') === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${c.heroImageUrl ? '<button class="linkbtn" data-rmphoto="hero">Remove</button>' : ''}</div></div>
        <p class="hint" style="margin:14px 0 8px">Our Story photos — choose 3 or 4 that really count. Portrait photos suit 1–3; photo 4 is optional and best as a wide landscape. Captions are optional (a few words, e.g. “Jaipur, 2025”).</p>
        ${[['photos', 'Friends link'], ['photosFamily', 'Close Family, Family & Guests and Other Guests links (if empty, they see the Friends photos)']].map(([key, who]) => `<p style="margin:16px 0 8px;font-size:14px"><b>${esc(who)}</b></p>
        <div class="photos">${[0, 1, 2, 3].map(i => { c[key] = c[key] || []; const p = c[key][i] || { url: '', caption: { en: '', hi: '' } }; c[key][i] = p; const cap = /^(Main couple photo|Supporting photo \d)$/.test(p.caption.en) ? '' : p.caption.en; return `<div class="pslot"><b style="font-size:13px">${['1 · Large, under the heading', '2 · Left of the pair', '3 · Right of the pair', '4 · Wide, optional'][i]}</b>${p.url ? `<img src="${esc(p.url)}" alt="">` : '<div class="empty">Empty</div>'}
          <input class="input" data-c="${key}.${i}.caption.en" value="${esc(cap)}" placeholder="Caption (optional)">
          <label class="btn ghost small">Upload<input type="file" accept="image/*" data-up="${key}:${i}" hidden></label>${p.url ? `<button class="linkbtn" data-rmphoto="${key}:${i}">Remove</button>` : ''}</div>`; }).join('')}</div>`).join('')}</div>
      <div class="cardx"><h3>Venue</h3>${bi('venueName', 'Venue name', c.venueName)}${bi('venueCity', 'City line', c.venueCity)}
        <div class="field"><label>Venue photo</label><div class="pslot wide">${c.venueImageUrl ? `<img src="${esc(c.venueImageUrl.startsWith('/assets/') && window.ASSETS ? window.ASSETS[c.venueImageUrl.slice(8)] || c.venueImageUrl : c.venueImageUrl)}" alt="">` : '<div class="empty">Placeholder shown</div>'}
        <label class="btn ghost small">Upload<input type="file" accept="image/*" data-up="venue" hidden></label>${c.venueImageUrl ? '<button class="linkbtn" data-rmphoto="venue">Remove</button>' : ''}</div></div></div>
      <div class="cardx"><h3>Events</h3><p class="hint">This list drives both the itinerary and which events each group may RSVP for.</p>
        ${D.events.map((e, i) => `<details class="evedit"><summary><b>${esc(e.title.en)}</b> · ${fmtD(e.date)}${e.endDate ? ' – ' + fmtD(e.endDate) : ' ' + esc(e.start) + (e.end ? '–' + esc(e.end) : '+')} · ${e.groups.map(g => 'G' + g).join(' ')}</summary>
          <div class="grid3"><div class="field"><label>Date</label><input class="input" type="date" data-e="${i}.date" value="${esc(e.date)}"></div>
          <div class="field"><label>Last day (multi-day events only)</label><input class="input" type="date" data-e="${i}.endDate" value="${esc(e.endDate || '')}"></div>
          <div class="field"><label>Start</label><input class="input" type="time" data-e="${i}.start" value="${esc(e.start)}"></div>
          <div class="field"><label>End (blank = onwards)</label><input class="input" type="time" data-e="${i}.end" value="${esc(e.end)}"></div></div>
          <div class="field"><label>Invited groups</label>${Rules.GROUP_IDS.map(g => `<label class="check"><input type="checkbox" data-eg="${i}.${g}" ${e.groups.includes(g) ? 'checked' : ''}> ${esc(gname(g))}</label>`).join('')}</div>
          ${['title', 'desc', 'timeNote', 'dress', 'location'].map(k => `<div class="field"><label>${{ title: 'Title', desc: 'Description (pending family review)', timeNote: 'Time note shown instead of a clock time (multi-day events)', dress: 'Dress code: first line = theme shown on the card, then one line each, e.g. “Ladies: saree | lehenga” (blank = “to be shared soon”)', location: 'Sub-location, e.g. lawn or ballroom' }[k]}</label><div class="bi">
            ${['en', 'hi'].map(l => k === 'desc' || k === 'dress' ? `<textarea class="input" rows="${k === 'dress' ? 3 : 4}" data-e="${i}.${k}.${l}">${esc((e[k] || {})[l])}</textarea>` : `<input class="input" data-e="${i}.${k}.${l}" value="${esc((e[k] || {})[l])}" placeholder="${l.toUpperCase()}">`).join('')}</div></div>`).join('')}
          <div class="field"><label>Dress-code colours for the outfit illustration (hex codes, comma-separated: ladies, accent, gentlemen, extra; blank = no illustration)</label><input class="input" data-epal="${i}" value="${esc((e.palette || []).join(', '))}" placeholder="#7a9a3a, #c9d96b, #a7c4a0"></div>
          <div class="field"><label>Event photo (optional, landscape works best)</label><div class="pslot wide">${e.imageUrl ? `<img src="${esc(e.imageUrl.startsWith('/assets/') && window.ASSETS ? window.ASSETS[e.imageUrl.slice(8)] || e.imageUrl : e.imageUrl)}" alt="">` : '<div class="empty">No photo — the monogram is shown</div>'}
          <label class="btn ghost small">Upload<input type="file" accept="image/*" data-up="ev:${i}" hidden></label>${e.imageUrl ? `<button class="linkbtn" data-rmphoto="ev:${i}">Remove</button>` : ''}</div></div>
          <div class="field"><label>Directions link (blank = hotel map)</label><input class="input" data-e="${i}.mapsUrl" value="${esc(e.mapsUrl)}" placeholder="https://maps.app.goo.gl/…"></div></details>`).join('')}</div>
      <div class="savebar"><button class="btn" data-a="savecontent">Save content</button></div>`;
  }

  function settings() {
    const s = D.settings;
    const dl = s.deadline.replace(/\+05:30$/, '').slice(0, 16);
    return `<div class="cardx"><h3>RSVP window</h3>
      <div class="field"><label>Deadline (IST)</label><input class="input" type="datetime-local" id="s-deadline" value="${esc(dl)}"></div>
      <label class="check"><input type="checkbox" id="s-override" ${s.adminOverrideOpen ? 'checked' : ''}> Keep RSVPs open after the deadline (override)</label>
      <label class="check"><input type="checkbox" id="s-edits" ${s.allowEditsAfterDeadline ? 'checked' : ''}> Let guests edit existing RSVPs after the deadline</label></div>
      <div class="cardx"><h3>Help contact & map</h3>
      <div class="field"><label>Help phone (with country code, digits only after +)</label><input class="input" id="s-phone" value="${esc(s.helpPhone)}"></div>
      <div class="field"><label>Help phone as displayed</label><input class="input" id="s-phoned" value="${esc(s.helpPhoneDisplay)}"></div>
      <div class="field"><label>Hotel Google Maps link</label><input class="input" id="s-maps" value="${esc(s.mapsUrl)}"></div>
      <div class="field"><label>Travel-guide contacts (name · WhatsApp number with country code · number as displayed)</label>
        ${[0, 1].map(i => { const c = (s.guideContacts || [])[i] || {}; return `<div class="grid3" style="margin-bottom:6px"><input class="input" id="s-gc${i}n" value="${esc(c.name || '')}" placeholder="Name"><input class="input" id="s-gc${i}p" value="${esc(c.phone || '')}" placeholder="+65…"><input class="input" id="s-gc${i}d" value="${esc(c.display || '')}" placeholder="+65 9383 0017"></div>`; }).join('')}</div>
      <div class="grid3"><div class="field"><label>Earliest arrival</label><input class="input" type="date" id="s-amin" value="${esc(s.arrivalMin)}"></div><div class="field"><label>Latest arrival</label><input class="input" type="date" id="s-amax" value="${esc(s.arrivalMax)}"></div><div class="field"><label>Latest departure</label><input class="input" type="date" id="s-dmax" value="${esc(s.departureMax)}"></div></div>
      <h3 style="margin-top:18px">Travel guide</h3><p class="hint">Which links show the international travel guide (and the travel-guide contacts).</p>
      <div class="btnrow" style="justify-content:flex-start;gap:16px">${Rules.GROUP_IDS.map(g => `<label class="check"><input type="checkbox" id="s-guide${g}" ${(s.guideGroups || [1]).includes(g) ? 'checked' : ''}> ${esc(Rules.GROUPS[g])}</label>`).join('')}</div>
      <h3 style="margin-top:18px">Language each link opens in</h3><p class="hint">Guests can still switch with the EN | हिंदी toggle, and their choice is remembered. Adding /hi or /en to the end of a link (e.g. …/i/CODE/hi) overrides this for that link.</p>
      <div class="grid3" style="grid-template-columns:repeat(4,1fr)">${Rules.GROUP_IDS.map(g => `<div class="field"><label>${esc(Rules.GROUPS[g])}</label><select class="input" id="s-lang${g}">${['en', 'hi'].map(l => `<option value="${l}" ${((s.defaultLang || {})[g] || 'en') === l ? 'selected' : ''}>${l === 'hi' ? 'हिंदी (Hindi)' : 'English'}</option>`).join('')}</select></div>`).join('')}</div>
      <h3 style="margin-top:18px">Hosted stay</h3><p class="hint">Shown to guests on the RSVP travel step, and used to count rooms per night on the Accommodation tab.</p>
      <div class="grid3">${[1, 2, 3].map(g => `<div class="field"><label>${esc(Rules.GROUPS[g])}: stay from</label><input class="input" type="date" id="s-sf${g}" value="${esc((s.stayFrom || {})[g] || '')}"></div>`).join('')}</div>
      <div class="grid3"><div class="field"><label>Check-out date</label><input class="input" type="date" id="s-su" value="${esc(s.stayUntil || '')}"></div><div class="field"><label>Check-out time</label><input class="input" type="time" id="s-ct" value="${esc(s.checkoutTime || '12:00')}"></div><div class="field"><label>Guests per room (estimate)</label><input class="input" type="number" min="1" max="6" id="s-occ" value="${esc(s.roomOccupancy || 2)}"></div></div>
      <button class="btn" data-a="savesettings">Save settings</button></div>
      <div class="cardx"><h3>Exports & backups</h3><p class="hint">CSV files open in Excel / Google Sheets. Take a JSON backup weekly and before any big edit.</p>
        <div class="btnrow" style="flex-wrap:wrap;justify-content:flex-start"><button class="btn ghost" data-dl="responses">All responses CSV</button><button class="btn ghost" data-dl="guests">Guest list CSV</button><button class="btn ghost" data-dl="nights">Nights CSV</button><button class="btn ghost" data-a="backup">Full JSON backup</button></div></div>
      ${window.PREVIEW ? `<div class="cardx"><h3>Preview tools</h3><button class="btn coral" data-a="seed">Add sample responses</button> <button class="btn coral" data-a="reset">Erase all preview data</button></div>` : ''}`;
  }

  function render() {
    const tabs = { overview: 'Overview', responses: 'Responses', guests: 'Guests', accommodation: 'Accommodation', music: 'Music & messages', content: 'Content', settings: 'Settings & export' };
    root().innerHTML = `<div class="admin">${window.PREVIEW ? `<div class="preview-banner">Preview dashboard — sample data only · <button type="button" class="linkbtn" style="color:#fff;padding:2px 4px" data-go="guest">Guest site</button></div>` : ''}
      <header class="ahead"><div><img src="${(window.ASSETS && window.ASSETS['mono.webp']) || '/assets/mono.webp'}" alt="" style="height:34px"><b>RSVP dashboard</b></div><div><button class="linkbtn" data-a="refresh">Refresh</button><button class="linkbtn" data-a="logout">Sign out</button></div></header>
      <nav class="atabs">${Object.entries(tabs).map(([k, v]) => `<button data-tab="${k}" aria-selected="${tab === k}">${v}</button>`).join('')}</nav>
      <main class="abody">${{ overview, responses, guests, accommodation, music, content, settings }[tab]()}</main></div>`;
    wire();
  }

  function wire() {
    const r = root();
    r.querySelectorAll('[data-tab]').forEach(b => (b.onclick = () => { tab = b.dataset.tab; q = ''; render(); }));
    const qi = $('#q'); if (qi) qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    [['fs', 'status'], ['fg', 'group']].forEach(([id, k]) => { const el = $('#' + id); if (el) el.onchange = () => { filt[k] = el.value; render(); }; });
    const fd = $('#fd'); if (fd) fd.onchange = () => { filt.dup = fd.checked; render(); };
    r.querySelectorAll('[data-edit]').forEach(b => (b.onclick = e => { e.preventDefault(); editModal(D.submissions.find(s => s.id === b.dataset.edit)); }));
    r.querySelectorAll('[data-dl]').forEach(b => (b.onclick = () => download(b.dataset.dl)));
    r.querySelectorAll('[data-a]').forEach(b => (b.onclick = () => action(b.dataset.a)));
    r.querySelectorAll('[data-up]').forEach(inp => (inp.onchange = () => uploadPhoto(inp)));
    r.querySelectorAll('[data-rmphoto]').forEach(b => (b.onclick = () => { collectContent(); if (b.dataset.rmphoto.startsWith('ev:')) D.events[+b.dataset.rmphoto.slice(3)].imageUrl = ''; else if (b.dataset.rmphoto === 'venue') D.content.venueImageUrl = ''; else if (b.dataset.rmphoto === 'hero') D.content.heroImageUrl = ''; else { const [k, n] = b.dataset.rmphoto.split(':'); D.content[k][+n].url = ''; } render(); toast('Removed — click Save content to publish.'); }));
  }

  async function action(a) {
    if (a === 'refresh') return load();
    if (a === 'logout') { await call('POST', '/api/admin/logout', {}); return login(); }
    if (a === 'new') return editModal(null);
    if (a === 'addphoto' && false) { collectContent(); D.content.photos.push({ slot: 's' + D.content.photos.length, url: '', caption: { en: 'Photo', hi: 'फ़ोटो' } }); return render(); }
    if (a === 'savecontent') {
      collectContent();
      const res = await call('POST', '/api/admin/content', { content: D.content, events: D.events });
      return res.status === 200 ? (toast('Saved. Guests now see the new content.'), load()) : toast('Save failed: ' + (res.body.error || res.status), true);
    }
    if (a === 'savesettings') {
      const s = { deadline: $('#s-deadline').value + ':59+05:30', adminOverrideOpen: $('#s-override').checked, allowEditsAfterDeadline: $('#s-edits').checked,
        helpPhone: '+' + $('#s-phone').value.replace(/\D/g, ''), helpPhoneDisplay: $('#s-phoned').value.trim(), mapsUrl: $('#s-maps').value.trim(),
        guideContacts: [0, 1].map(i => ({ name: $('#s-gc' + i + 'n').value.trim(), phone: '+' + $('#s-gc' + i + 'p').value.replace(/\D/g, ''), display: $('#s-gc' + i + 'd').value.trim() })).filter(c => c.name && c.phone.length > 6),
        arrivalMin: $('#s-amin').value, arrivalMax: $('#s-amax').value, departureMax: $('#s-dmax').value,
        stayFrom: Object.fromEntries([1, 2, 3].map(g => [g, $('#s-sf' + g).value]).filter(x => x[1])), stayUntil: $('#s-su').value, checkoutTime: $('#s-ct').value || '12:00',
        guideGroups: Rules.GROUP_IDS.filter(g => $('#s-guide' + g).checked),
        defaultLang: Object.fromEntries(Rules.GROUP_IDS.map(g => [g, $('#s-lang' + g).value])),
        roomOccupancy: Math.min(6, Math.max(1, parseInt($('#s-occ').value, 10) || 2)) };
      if (!/^https:\/\//.test(s.mapsUrl)) return toast('Maps link must start with https://', true);
      const res = await call('POST', '/api/admin/content', { settings: s });
      return res.status === 200 ? (toast('Settings saved.'), load()) : toast('Save failed: ' + (res.body.error || res.status), true);
    }
    if (a === 'backup') {
      const res = await call('GET', '/api/admin/backup');
      if (res.status !== 200) return toast('Backup failed', true);
      return save(new Blob([JSON.stringify(res.body, null, 2)], { type: 'application/json' }), `wedding-backup-${new Date().toISOString().slice(0, 10)}.json`);
    }
    if (a === 'reset' && await ask('Erase all preview responses and content edits?', 'Erase')) { window.PREVIEW.reset(); window.PREVIEW.go('guest'); }
    if (a === 'seed') return seed();
  }

  function collectContent() {
    const set = (obj, path, val) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach(k => (o = o[k] = o[k] ?? {})); o[ks[ks.length - 1]] = val; };
    root().querySelectorAll('[data-c]').forEach(i => set(D.content, i.dataset.c, i.value));
    root().querySelectorAll('[data-e]').forEach(i => set(D.events, i.dataset.e, i.value));
    root().querySelectorAll('[data-epal]').forEach(i => { D.events[+i.dataset.epal].palette = i.value.split(/[\s,]+/).filter(x => /^#[0-9a-f]{3,8}$/i.test(x)); });
    root().querySelectorAll('[data-eg]').forEach(i => { const [idx, g] = i.dataset.eg.split('.').map(Number); const e = D.events[idx]; e.groups = e.groups.filter(x => x !== g); if (i.checked) e.groups.push(g); e.groups.sort(); });
  }

  async function uploadPhoto(inp) {
    const file = inp.files[0]; if (!file) return;
    collectContent();
    const blob = await resize(file, 1600);
    const res = await window.API.upload(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    if (res.status !== 200) return toast('Upload failed', true);
    if (inp.dataset.up.startsWith('ev:')) D.events[+inp.dataset.up.slice(3)].imageUrl = res.body.url; else if (inp.dataset.up === 'venue') D.content.venueImageUrl = res.body.url; else if (inp.dataset.up === 'hero') D.content.heroImageUrl = res.body.url; else { const [k, n] = inp.dataset.up.split(':'); D.content[k][+n].url = res.body.url; }
    render(); toast('Uploaded — click Save content to publish.');
  }
  function resize(file, max) {
    return new Promise((ok, bad) => {
      const img = new Image();
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(ok, 'image/jpeg', .84); URL.revokeObjectURL(img.src); };
      img.onerror = bad; img.src = URL.createObjectURL(file);
    });
  }

  async function download(type) {
    try { const { blob, filename } = await window.API.download('/api/admin/export?type=' + type); save(blob, filename); }
    catch { toast('Export failed — are you still signed in?', true); }
  }
  function save(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    let framed = false; try { framed = window.top !== window.self; } catch { framed = true; }
    if (window.PREVIEW && framed) blob.text().then(t => ask(`If ${name} didn’t download (some viewers block downloads), copy the contents below into a file:`, 'Done', t));
  }

  // ---------- edit / add response ----------
  function editModal(s) {
    const isNew = !s;
    const st = s || { status: 'accept', group: 1, primaryName: '', phone: '', guests: [''], events: [], arrivalDate: '', arrivalWindow: '', departureDate: '', departureWindow: '', songName: '', songArtist: '', songUrl: '', questions: '', note: '', source: 'whatsapp', adminNotes: '' };
    const cc = (st.phone.match(/^\+(971|974|966|968|973|965|852|353|91|44|65|61|49|33|81|86|64|27|60|66|39|31|41|46|1|7)/) || ['', '91'])[1];
    let size = Math.max(1, st.guests.length);
    const m = document.createElement('div'); m.className = 'modal';
    const draw = () => {
      const evs = Rules.eventOptions(Rules.eligibleEvents(D.events, st.group));
      const winSel = (id, v) => `<select class="input" id="${id}"><option value="">—</option>${Object.entries(WIN).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      m.innerHTML = `<div class="box paper wide"><div class="mhead"><b>${isNew ? 'Add a reply received by WhatsApp / phone' : 'Edit response ' + esc(st.id)}</b><button class="iconbtn" data-x>${Art.icon.close}</button></div>
        <div class="grid3"><div class="field"><label>Status</label><select class="input" id="m-status"><option value="accept" ${st.status === 'accept' ? 'selected' : ''}>Accepted</option><option value="decline" ${st.status === 'decline' ? 'selected' : ''}>Declined</option></select></div>
          <div class="field"><label>Invitation group</label><select class="input" id="m-group">${Rules.GROUP_IDS.map(g => `<option value="${g}" ${st.group == g ? 'selected' : ''}>${esc(gname(g))}</option>`).join('')}</select></div>
          <div class="field"><label>Source</label><select class="input" id="m-source">${['web', 'whatsapp', 'phone', 'admin'].map(x => `<option ${st.source === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
        <div class="field" data-k="primaryName"><label>Primary contact full name</label><input class="input" id="m-name" value="${esc(st.primaryName)}"><p class="msg"></p></div>
        <div class="field" data-k="phone"><label>WhatsApp (country code + number)</label><div class="phone"><input class="input" id="m-cc" value="+${esc(cc)}"><input class="input" id="m-num" value="${esc(st.phone.replace('+' + cc, ''))}"></div><p class="msg"></p></div>
        ${st.status === 'accept' ? `
        <div class="field"><label>Party size</label><select class="input" id="m-size">${Array.from({ length: D.settings.maxParty }, (_, i) => `<option ${i + 1 === size ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
        ${Array.from({ length: size }, (_, i) => `<div class="field" data-k="guest${i}"><label>Guest ${i + 1} full name</label><input class="input" data-g="${i}" value="${esc(st.guests[i] || '')}"><p class="msg"></p></div>`).join('')}
        ${isSimple(st.group) ? `<p class="hint">This group is invited to the Reception only — no event choice or travel details.</p>` : `<div class="field" data-k="events"><label>Events (eligible for this group)</label>${evs.map(o => `<label class="check" style="margin:0 0 4px"><input type="checkbox" data-mev="${o.id}" ${st.events.includes(o.id) ? 'checked' : ''}> ${esc(o.title.en)} <small class="muted">${fmtD(o.date)}</small></label>`).join('')}<p class="msg"></p></div>
        <label class="check"><input type="checkbox" id="m-tbd" ${!isNew && !st.arrivalDate ? 'checked' : ''}> Travel dates not known yet</label>
        <div class="grid4"><div class="field" data-k="arrivalDate"><label>Arrival</label><input class="input" type="date" id="m-ad" value="${esc(st.arrivalDate)}"><p class="msg"></p></div><div class="field" data-k="arrivalWindow"><label>Window</label>${winSel('m-aw', st.arrivalWindow)}<p class="msg"></p></div>
          <div class="field" data-k="departureDate"><label>Departure</label><input class="input" type="date" id="m-dd" value="${esc(st.departureDate)}"><p class="msg"></p></div><div class="field" data-k="departureWindow"><label>Window</label>${winSel('m-dw', st.departureWindow)}<p class="msg"></p></div></div>
        <div class="grid3"><div class="field"><label>Song</label><input class="input" id="m-sn" value="${esc(st.songName)}"></div><div class="field"><label>Artist</label><input class="input" id="m-sa" value="${esc(st.songArtist)}"></div><div class="field" data-k="songUrl"><label>Link</label><input class="input" id="m-su" value="${esc(st.songUrl)}"><p class="msg"></p></div></div>
        <div class="field"><label>Guest’s questions</label><textarea class="input" id="m-q">${esc(st.questions)}</textarea></div>`}` : `
        <div class="field"><label>Message</label><textarea class="input" id="m-note">${esc(st.note)}</textarea></div>`}
        <div class="field"><label>Organizer notes (never shown to guests)</label><textarea class="input" id="m-an">${esc(st.adminNotes)}</textarea></div>
        <p class="formerr" id="m-err" hidden></p>
        <div class="btnrow">${!isNew ? `<button class="btn coral" data-del>Delete</button><button class="btn ghost" data-link>New edit link</button>` : ''}<button class="btn" data-save>Save</button></div></div>`;
      m.querySelector('[data-x]').onclick = () => m.remove();
      const grab = () => {
        st.status = $('#m-status', m).value; st.group = +$('#m-group', m).value; st.source = $('#m-source', m).value;
        st.primaryName = $('#m-name', m).value; st.adminNotes = $('#m-an', m).value; st._cc = $('#m-cc', m).value; st._num = $('#m-num', m).value;
        if ($('#m-size', m)) {
          st.guests = [...m.querySelectorAll('[data-g]')].map(i => i.value);
          if ($('#m-ad', m)) {
            st.events = [...m.querySelectorAll('[data-mev]:checked')].map(i => i.dataset.mev);
            st.arrivalDate = $('#m-ad', m).value; st.arrivalWindow = $('#m-aw', m).value; st.departureDate = $('#m-dd', m).value; st.departureWindow = $('#m-dw', m).value;
            st.songName = $('#m-sn', m).value; st.songArtist = $('#m-sa', m).value; st.songUrl = $('#m-su', m).value; st.questions = $('#m-q', m).value; st._tbd = $('#m-tbd', m).checked;
          }
        } else st.note = $('#m-note', m).value;
      };
      ['#m-status', '#m-group'].forEach(id => ($(id, m).onchange = () => { grab(); st.phone = (st._cc || '') + (st._num || ''); draw(); }));
      if ($('#m-size', m)) $('#m-size', m).onchange = () => { grab(); size = +$('#m-size', m).value; st.guests = st.guests.slice(0, size); st.phone = (st._cc || '') + (st._num || ''); draw(); };
      m.querySelector('[data-save]').onclick = async () => {
        grab();
        const data = { ...st, phoneCc: st._cc, phoneNumber: st._num, partySize: st.status === 'accept' ? size : 0, guests: st.guests.slice(0, size), travelTbd: st._tbd };
        const res = await call('POST', '/api/admin/submission', { id: isNew ? null : st.id, data });
        if (res.status === 200) { m.remove(); toast('Saved.'); return load(); }
        m.querySelectorAll('.field').forEach(f => f.classList.remove('bad'));
        const fields = res.body.fields || {};
        Object.entries(fields).forEach(([k, v]) => { const f = m.querySelector(`[data-k="${k}"]`); if (f) { f.classList.add('bad'); f.querySelector('.msg').textContent = I18N.en.err[v] || v; } });
        const e = $('#m-err', m); e.hidden = false; e.textContent = Object.keys(fields).length ? 'Please fix: ' + Object.keys(fields).join(', ') : 'Save failed: ' + (res.body.error || res.status);
      };
      const del = m.querySelector('[data-del]');
      if (del) del.onclick = async () => { if (!(await ask(`Delete the response from ${st.primaryName}? This cannot be undone (take a backup first if unsure).`, 'Delete'))) return; await call('POST', '/api/admin/delete', { id: st.id }); m.remove(); toast('Deleted.'); load(); };
      const lk = m.querySelector('[data-link]');
      if (lk) lk.onclick = async () => {
        if (!(await ask('Create a new edit link? The guest’s old link will stop working.', 'Create link'))) return;
        const res = await call('POST', '/api/admin/reset-link', { id: st.id });
        const base = location.origin + (window.PREVIEW ? location.pathname : '/');
        if (res.status === 200) { const u = `${base}#edit=${res.body.editToken}`; try { await navigator.clipboard.writeText(u); } catch {} await ask('New edit link (copied if your browser allows) — send it to the guest:', 'Done', u); }
      };
    };
    draw();
    document.body.appendChild(m);
  }

  async function seed() {
    const opts = g => Rules.eventOptions(Rules.eligibleEvents(D.events, g)).map(o => o.id);
    const people = [
      { group: 1, names: ['Priya Sharma', 'Rohan Sharma'], pick: o => o.filter(x => x !== 'home-days@2027-02-09'), arr: ['2027-02-09', 'eve'], dep: ['2027-02-15', 'mid'], song: ['Gallan Goodiyaan', 'Shankar Ehsaan Loy'] },
      { group: 1, names: ['Lena Fischer'], pick: o => o, arr: ['2027-02-08', 'night'], dep: ['2027-02-16', 'am'], song: ['Uptown Funk', 'Mark Ronson ft. Bruno Mars'], q: 'Is there airport pickup from Indore airport?' },
      { group: 2, names: ['Sneha Kapoor', 'Vikram Kapoor', 'Anaya Kapoor'], pick: o => o.filter(x => x !== 'closing-dinner'), arr: ['2027-02-12', 'am'], dep: ['2027-02-15', 'mid'], song: ['London Thumakda', 'Labh Janjua'] },
      { group: 3, names: ['Kavya Iyer', 'Rahul Iyer'], pick: o => o, arr: ['2027-02-13', 'am'], dep: ['2027-02-15', 'am'], song: ['', ''] },
      { group: 3, names: ['Meera Joshi'], pick: o => o.slice(2), arr: ['2027-02-13', 'mid'], dep: ['2027-02-14', 'night'], song: ['Kala Chashma', 'Badshah'] },
      { group: 4, names: ['Anil Verma', 'Rekha Verma'] },
      { group: 4, names: ['Deepak Chouhan'] },
    ];
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      await call('POST', '/api/admin/submission', { data: { group: p.group, status: 'accept', source: 'admin', primaryName: p.names[0], phoneCc: '+91', phoneNumber: '98' + String(10000000 + i * 1111111).slice(0, 8),
        partySize: p.names.length, guests: p.names, events: p.pick ? p.pick(opts(p.group)) : opts(p.group),
        arrivalDate: p.arr ? p.arr[0] : '', arrivalWindow: p.arr ? p.arr[1] : '', departureDate: p.dep ? p.dep[0] : '', departureWindow: p.dep ? p.dep[1] : '',
        songName: p.song ? p.song[0] : '', songArtist: p.song ? p.song[1] : '', songUrl: '', questions: p.q || '', adminNotes: 'Sample data' } });
    }
    await call('POST', '/api/admin/submission', { data: { group: 2, status: 'decline', source: 'admin', primaryName: 'Sunita Rao', phoneCc: '+1', phoneNumber: '4155550142', note: 'So sorry to miss it — sending all our love!', adminNotes: 'Sample data' } });
    toast('Sample responses added.'); load();
  }

  window.AdminApp = { boot() { if (!document.getElementById('art-defs')) { const d = document.createElement('div'); d.id = 'art-defs'; d.innerHTML = Art.defs; document.body.prepend(d); } load(); } };
})();
