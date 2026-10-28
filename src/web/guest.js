// Guest-facing app: access gate, envelope intro, invitation pages and RSVP flow.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const asset = n => (window.ASSETS && window.ASSETS[n]) || '/assets/' + n;
  const media = u => (u && u.startsWith('/assets/') ? asset(u.slice(8)) : u);
  const LOGO = asset('mono.webp'), SEAL = asset('seal.webp'), AGENCY = asset('agency.webp');
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Language: a /hi or /en link wins, then the guest's own choice on this phone, then the group's default (set once the site loads).
  const urlLang = (() => { try { const l = new URLSearchParams(location.search).get('lang'); return l === 'hi' || l === 'en' ? l : ''; } catch { return ''; } })();
  if (urlLang) ls.set('wd_lang', urlLang);
  let lang = (urlLang || ls.get('wd_lang')) === 'hi' ? 'hi' : 'en';
  const applyLang = l => { lang = l; document.documentElement.lang = l; document.body.classList.toggle('lang-hi', l === 'hi'); };
  const T = () => I18N[lang];
  const L = o => (o && typeof o === 'object' ? (o[lang] || o.en || '') : (o || ''));
  let site = null;
  let day = null;
  let timer = null;
  const root = $('#app');

  // ---------- formatting ----------
  const dObj = d => new Date(d + 'T00:00:00Z');
  const fmtDate = (d, long) => { const x = dObj(d); const t = T(); return long ? `${t.weekdayLong[x.getUTCDay()]}, ${x.getUTCDate()} ${t.month[x.getUTCMonth()]} ${x.getUTCFullYear()}` : `${t.weekday[x.getUTCDay()]}, ${x.getUTCDate()} ${t.monthShort[x.getUTCMonth()]}`; };
  function fmtTime(hm) {
    if (!hm) return '';
    let [h, m] = hm.split(':').map(Number);
    const h12 = ((h + 11) % 12) + 1, mm = String(m).padStart(2, '0');
    if (lang === 'hi') { const p = h < 12 ? 'सुबह' : h < 16 ? 'दोपहर' : h < 20 ? 'शाम' : 'रात'; return `${p} ${h12}:${mm}`; }
    return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  }
  // "Tue 9 – Thu 11 Feb" / "Tuesday 9 – Thursday 11 February 2027" for multi-day events
  // Hosted hotel stay for this guest's group (groups 1–3), e.g. "from Fri, 12 Feb until check-out at 12 noon on Mon, 15 Feb".
  function stayText() {
    const s = site && site.settings; if (!s || !s.stayFrom || !s.stayUntil || s.simple) return '';
    const time = s.checkoutTime === '12:00' ? (lang === 'hi' ? 'दोपहर 12 बजे' : '12 noon') : fmtTime(s.checkoutTime);
    return T().stayLine(fmtDate(s.stayFrom), fmtDate(s.stayUntil), time);
  }
  // Friends' Home Days fall before the hosted stay: say we'll help them find a hotel nearby.
  function stayEarlyText() {
    const s = site && site.settings; if (!s || !s.stayFrom) return '';
    const early = site.events.filter(e => e.date < s.stayFrom);
    if (!early.length) return '';
    const last = early[early.length - 1];
    return T().stayEarly(early.map(e => L(e.title)).join(', ') + ' (' + fmtSpan({ date: early[0].date, endDate: last.endDate || last.date }) + ')');
  }
  function fmtGroupSpan() {
    const ds = site.events.flatMap(e => Rules.eventDays(e)).sort();
    return ds.length ? fmtSpan({ date: ds[0], endDate: ds[ds.length - 1] }) : '';
  }
  function fmtSpan(e, long) {
    if (!e.endDate || e.endDate <= e.date) return fmtDate(e.date, long);
    const a = dObj(e.date), b = dObj(e.endDate), t = T();
    return long ? `${t.weekdayLong[a.getUTCDay()]} ${a.getUTCDate()} – ${t.weekdayLong[b.getUTCDay()]} ${b.getUTCDate()} ${t.month[b.getUTCMonth()]} ${b.getUTCFullYear()}`
      : `${t.weekday[a.getUTCDay()]} ${a.getUTCDate()} – ${t.weekday[b.getUTCDay()]} ${b.getUTCDate()} ${t.monthShort[b.getUTCMonth()]}`;
  }
  const fmtWhen = e => (e.endDate && L(e.timeNote)) ? L(e.timeNote) : fmtRange(e);
  const tabKey = e => e.endDate && e.endDate > e.date ? `${e.date}~${e.endDate}` : e.date;
  const fmtRange = e => e.end ? `${fmtTime(e.start)} – ${fmtTime(e.end)}` : (lang === 'hi' ? `${fmtTime(e.start)} बजे से` : `${fmtTime(e.start)} ${T().onwards}`);
  function datesLabel() {
    const ds = site.events.flatMap(e => Rules.eventDays(e)).sort();
    if (!ds.length) return L(site.content.dates);
    const a = dObj(ds[0]), b = dObj(ds[ds.length - 1]), t = T();
    if (ds[0] === ds[ds.length - 1]) return `${a.getUTCDate()} ${t.month[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
    if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()} – ${b.getUTCDate()} ${t.month[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
    return `${a.getUTCDate()} ${t.month[a.getUTCMonth()]} – ${b.getUTCDate()} ${t.month[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  const waLink = (num, text) => `https://wa.me/${String(num).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  // ---------- API ----------
  async function call(method, path, body) {
    try { return await window.API.call(method, path, body); }
    catch { return { status: 0, body: { error: 'network' } }; }
  }

  // ---------- language ----------
  function setLang(l) {
    lang = l; ls.set('wd_lang', l);
    document.documentElement.lang = l === 'hi' ? 'hi' : 'en';
    document.body.classList.toggle('lang-hi', l === 'hi');
    rerender();
  }
  function langToggle() {
    return `<div class="lang" role="group" aria-label="Language / भाषा"><button data-lang="en" aria-pressed="${lang === 'en'}">English</button><span>|</span><button data-lang="hi" aria-pressed="${lang === 'hi'}" lang="hi">हिंदी</button></div>`;
  }
  let view = 'loading';
  function rerender() {
    if (view === 'gate') renderGate();
    else if (view === 'guide') renderGuide();
    else if (view === 'main') { renderMain(); if (rsvp.open) renderRsvp(); if (detailId) openDetail(detailId); }
  }

  // ---------- gate ----------
  function renderGate(msg) {
    view = 'gate';
    const t = T();
    root.innerHTML = `<div class="gate paper">${Art.corner('tl')}${Art.corner('br', 1)}
      <div class="toplang">${langToggle()}</div>
      <img class="logo" src="${LOGO}" alt="Dreamy & Abhishek monogram">
      <p class="names">${lang === 'hi' ? 'ड्रीमी और अभिषेक' : 'Dreamy &amp; Abhishek'}</p>
      ${Art.divider()}
      <p class="caps">${esc(t.privateTitle)}</p>
      <p class="muted" style="max-width:340px;margin:8px auto 0">${esc(t.privateBody)}</p>
      <form id="gateForm" novalidate>
        <label class="sr" for="code">${esc(t.codeLabel)}</label>
        <input class="input" id="code" name="code" autocomplete="off" autocapitalize="characters" placeholder="${esc(t.codeLabel)}" maxlength="40" required>
        <button class="btn block" type="button" id="gateGo">${esc(t.enter)} ${Art.icon.arrow}</button>
        ${msg ? `<p class="formerr" role="alert">${esc(msg)}</p>` : ''}
      </form>
      ${window.PREVIEW ? `<div class="demo"><b>Preview only</b> — try each invitation group:<div class="demo-groups">${[['1', 'Friends'], ['2', 'Close Family'], ['3', 'Family & Guests'], ['4', 'Reception only']].map(([g, n]) => `<button class="btn ghost" data-demo="${g}"><b>${g}</b> ${n}</button>`).join('')}</div><p style="margin:10px 0 0"><button type="button" class="linkbtn" data-go="admin">Open organizer dashboard →</button></p></div>` : ''}
    </div>`;
    // Click/Enter handlers rather than form submission, which sandboxed viewers block.
    const go = async () => { const code = $('#code').value.trim(); if (code) await tryAccess(code); };
    $('#gateForm').onsubmit = e => e.preventDefault();
    $('#gateGo').onclick = go;
    $('#code').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    root.querySelectorAll('[data-demo]').forEach(b => (b.onclick = () => tryAccess(window.PREVIEW.codes[b.dataset.demo])));
    root.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => setLang(b.dataset.lang)));
  }
  async function tryAccess(code) {
    const r = await call('POST', '/api/access', { code });
    if (r.status === 200) return boot();
    renderGate(r.status === 429 ? T().rateLimited : r.status === 0 ? T().network : T().badCode);
  }

  // ---------- intro ----------
  function showIntro() {
    const t = T();
    const el = document.createElement('div');
    el.className = 'intro paper';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', t.youreInvited);
    const petals = [[12, 22, 20], [82, 16, -30], [70, 78, 40], [20, 84, 10], [90, 52, 60]].map(([x, y, r]) => `<span class="petal" style="left:${x}%;top:${y}%;transform:rotate(${r}deg)"></span>`).join('');
    el.innerHTML = `<div class="stage">${Art.corner('tl')}${Art.corner('br', 1)}${petals}
      <button class="linkbtn skip" data-act="skip">${esc(t.skip)}</button>
      <div class="lead"><p class="caps">${esc(t.youreInvited)}</p></div>
      <div class="envelope" data-act="open">
        <div class="env-back tex"><div class="env-liner"></div></div>
        <div class="env-card tex"><img src="${LOGO}" alt=""><p class="names">${esc(L(site.content.coupleShort))}</p><p class="caps" style="margin:6px 0 0">${esc(datesLabel())}</p></div>
        <div class="env-pocket" aria-hidden="true"><div class="pk pk-l tex"></div><div class="pk pk-r tex"></div><div class="pk pk-b tex"></div></div>
        <div class="env-flap" aria-hidden="true"><div class="face out"><div class="shape tex"></div></div><div class="face in"><div class="shape env-liner"></div></div></div>
        <svg class="env-tassel" viewBox="0 0 30 96" aria-hidden="true"><defs><linearGradient id="tsl" x1="0" x2="1"><stop offset="0" stop-color="#b9675a"/><stop offset=".45" stop-color="#e3a497"/><stop offset="1" stop-color="#a95a4e"/></linearGradient><linearGradient id="tsh" x1="0" x2="1"><stop offset="0" stop-color="#9c5247"/><stop offset=".5" stop-color="#d8907f"/><stop offset="1" stop-color="#8e4a40"/></linearGradient></defs>
          <path d="M15 0 C 13 8, 17 14, 15 26" stroke="#b46a5c" stroke-width="1.6" fill="none"/>
          ${Array.from({ length: 15 }, (_, i) => { const x = 9.5 + i * 0.8, dx = (i - 7) * 0.75; return `<path d="M${x} 34 Q ${x + dx * .4} 62 ${x + dx} ${90 + (i % 3)}" stroke="${i % 2 ? '#c97e70' : '#dfa193'}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`; }).join('')}
          <path d="M9 34 Q15 30 21 34 L20 40 Q15 37 10 40Z" fill="url(#tsl)"/><rect x="9.5" y="24" width="11" height="10" rx="4" fill="url(#tsh)"/><path d="M10 28.5h10" stroke="#f0c2b6" stroke-width=".7" opacity=".7"/></svg>
        <button type="button" class="env-seal" data-act="open" aria-label="${esc(t.openInvitation)}"><img src="${SEAL}" alt=""></button>
      </div>
      <div class="lead" style="margin:30px 0 0"><p class="caps" style="font-size:11px">${esc(t.specialAwaits)}</p></div>
      <button class="btn coral open-btn" data-act="open">${esc(t.openInvitation)} ${Art.icon.arrow}</button>
    </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    const done = () => { ls.set('wd_seen_intro', '1'); el.remove(); document.body.style.overflow = ''; };
    el.querySelector('[data-act="skip"]').onclick = done;
    let opened = false;
    const open = () => {
      if (opened) return; opened = true;
      if (reduceMotion()) return done();
      el.classList.add('opening');
      setTimeout(() => el.classList.add('opened'), 850);
      setTimeout(() => el.classList.add('revealing'), 2700);
      setTimeout(done, 3800);
    };
    // the button, the wax seal and the envelope itself all open the invitation
    el.querySelectorAll('[data-act="open"]').forEach(b => (b.onclick = e => { e.stopPropagation(); open(); }));
    el.querySelector('.open-btn').focus({ preventScroll: true });
  }

  // ---------- main page ----------
  // Same moment for every group: the wedding itself (Phere), 14 Feb 2027, 1 PM IST.
  const countdownTarget = () => Date.parse(site.settings.countdownTo || '2027-02-14T13:00:00+05:30');
  function tick() {
    const el = $('#countdown'); if (!el) return;
    let s = Math.max(0, Math.floor((countdownTarget() - Date.now()) / 1000));
    const v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    el.querySelectorAll('b').forEach((b, i) => (b.textContent = v[i]));
  }

  function photo(p, cls) {
    const t = T();
    return `<div class="ph ${cls} ${p && p.url ? 'has' : ''}">${p && p.url ? `<img src="${esc(p.url)}" alt="${esc(L(p.caption))}" loading="lazy">` : `<div class="lbl">${Art.icon.photo}${esc(L(p && p.caption))}<br><small>${esc(t.photoPlaceholder)}</small></div>`}</div>`;
  }

  // Our Story photos: up to four, each with its own place (hero · pair · optional wide).
  const OLD_CAPTION = /^(Main couple photo|Supporting photo \d|मुख्य युगल फ़ोटो|फ़ोटो \d)$/;
  function storyPhoto(p, i, cls) {
    const t = T();
    const cap = p && p.url ? L(p.caption) : '';
    const caption = cap && !OLD_CAPTION.test(cap) ? `<figcaption>${esc(cap)}</figcaption>` : '';
    const inner = p && p.url ? `<img src="${esc(p.url)}" alt="${esc(cap || L(site.content.coupleShort))}" loading="lazy">`
      : `<span class="sp-empty">${Art.icon.photo}<small>${esc(t.photoSlots[i])}</small></span>`;
    return `<figure class="sp ${cls} rv"><span class="sp-frame">${inner}</span>${caption}</figure>`;
  }
  const dressLines = e => (L(e.dress) || '').split('\n').map(x => x.trim()).filter(Boolean);
  const dressTheme = e => dressLines(e)[0] || T().dressSoon;
  function eventCard(e) {
    const t = T();
    if (e.endDate && e.endDate > e.date) {
      const a = dObj(e.date), b = dObj(e.endDate);
      return `<button class="ecard" data-event="${esc(e.id)}">
      <div class="time"><b>${a.getUTCDate()}–${b.getUTCDate()}</b><small>${esc(t.monthShort[b.getUTCMonth()])}</small></div>
      <div><h3>${esc(L(e.title))}</h3><p>${esc(L(e.desc))}</p>
      <div class="chips">${L(e.timeNote) ? `<span class="chip">${Art.icon.clock}${esc(L(e.timeNote))}</span>` : ''}<span class="chip">${Art.icon.pin}${esc(L(e.location) || L(site.content.venueName))}</span></div></div></button>`;
    }
    const time = fmtTime(e.start).split(' ');
    const timeHtml = lang === 'hi' ? `<b>${esc(time[1])}</b><small>${esc(time[0])}</small>` : `<b>${esc(time[0])}</b><small>${esc(time[1])}</small>`;
    return `<button class="ecard" data-event="${esc(e.id)}">
      <div class="time">${timeHtml}<span class="until">${e.end ? '– ' + esc(fmtTime(e.end)) : esc(t.onwards)}</span></div>
      <div><h3>${esc(L(e.title))}</h3><p>${esc(L(e.desc))}</p>
      <div class="chips"><span class="chip">${Art.icon.dress}${esc(dressTheme(e))}</span><span class="chip">${Art.icon.pin}${esc(L(e.location) || L(site.content.venueName))}</span></div></div></button>`;
  }

  function renderMain() {
    view = 'main';
    try { if (location.hash === '#travel-guide') history.replaceState(null, '', location.pathname + location.search); } catch {}
    const t = T(), c = site.content, s = site.settings;
    const days = [...new Set(site.events.map(tabKey))].sort();
    if (!day || !days.includes(day)) day = days[0];
    const photos = c.photos || [];
    const storedToken = ls.get('wd_edit');
    root.innerHTML = `
      ${window.PREVIEW ? `<div class="preview-banner">${esc(t.previewBanner)} <button type="button" class="linkbtn" style="color:#fff;padding:2px 4px" data-go="admin">Dashboard</button> · <button type="button" class="linkbtn" style="color:#fff;padding:2px 4px" data-act="logout">Switch group</button></div>` : ''}
      <header class="topbar paper" id="top">
        <button class="iconbtn" data-act="menu" aria-label="Menu">${Art.icon.menu}</button>
        <img class="mini" src="${LOGO}" alt="">
        ${langToggle()}
      </header>
      <div class="drawer" id="drawer"><div class="scrim" data-act="menu"></div><nav class="paper" aria-label="Sections">
        ${Object.entries(t.nav).filter(([k]) => k !== 'travel' || site.settings.guide).map(([k, v]) => `<a href="#${k}" data-act="${k === 'travel' ? 'guide' : 'nav'}">${esc(v)}${k === 'travel' ? ' ✈️' : ''}</a>`).join('')}</nav></div>
      <main>
      <section id="welcome" class="welcome ${c.heroImageUrl ? 'with-photo' : ''}">
        ${c.heroImageUrl ? `
        <div class="hh-photo" aria-hidden="true"><img src="${esc(c.heroImageUrl)}" alt="" style="object-position:center ${({ top: '15%', middle: '45%', lower: '62%', bottom: '85%' })[c.heroFocus] || '62%'}"><span class="fade"></span></div>
        <div class="medallion"><img src="${LOGO}" alt="Dreamy & Abhishek monogram"></div>` : `
        <div class="hh-bg" aria-hidden="true"><span class="w a"></span><span class="w b"></span><span class="w c"></span><span class="veil"></span></div>
        ${window.PREVIEW ? `<span class="hh-hint">${Art.icon.photo} ${esc(t.heroPlaceholder)}</span>` : ''}
        ${Art.corner('tl')}${Art.corner('tr', 1)}
        <img class="logo" src="${LOGO}" alt="Dreamy & Abhishek monogram" width="190" height="126">`}
        <h1 class="names">${esc(L(c.coupleShort))}</h1>
        ${Art.divider()}
        <p class="invite">${esc(L(c.welcome))}</p>
        ${Art.divider()}
        <p class="date-big">${esc(datesLabel()).toUpperCase()}</p>
        <p class="venue-line">${esc(L(c.venueName))}<br>${lang === 'hi' ? 'इंदौर' : 'Indore'}</p>
        <div class="countdown" id="countdown" aria-label="${esc(t.untilFirst)}">
          ${['days', 'hours', 'minutes', 'seconds'].map(k => `<div><b>0</b><small>${esc(t[k])}</small></div>`).join('')}</div>
      </section>

      <section id="story" class="story">${Art.corner('tr sm', 1)}
        <h2 class="script rv">${esc(t.story)}</h2><p class="caps rv" style="margin:6px 0 0">${esc(t.storySub)}</p>
        ${storyPhoto(photos[0], 0, 'sp-hero')}
        ${L(c.story).includes('\n') ? `<p class="copy poem rv">${L(c.story).split('\n').map(l => `<span>${esc(l.trim())}</span>`).join('')}</p>` : `<p class="copy rv">${esc(L(c.story))}</p>`}
        <div class="sp-pair">${storyPhoto(photos[1], 1, 'sp-a')}${storyPhoto(photos[2], 2, 'sp-b')}</div>
        ${photos[3] && photos[3].url || window.PREVIEW ? storyPhoto(photos[3], 3, 'sp-wide') : ''}
      </section>

      <section id="celebrations">${Art.corner('tl sm')}
        <h2 class="script">${esc(t.celebrations)}</h2><p class="caps" style="margin:6px 0 0">${esc(t.celebrationsSub(new Set(site.events.flatMap(e => Rules.eventDays(e))).size))}</p>
        <div class="daytabs ${days.length > 3 ? 'many' : ''}" role="tablist">${days.map(d => {
          const [a, b] = d.split('~').map(dObj);
          const top = b ? `${a.getUTCDate()}–${b.getUTCDate()} ${t.monthShort[b.getUTCMonth()]}` : `${a.getUTCDate()} ${t.monthShort[a.getUTCMonth()]}`;
          const sub = b ? `${t.weekday[a.getUTCDay()]} – ${t.weekday[b.getUTCDay()]}` : t[days.length > 3 ? 'weekday' : 'weekdayLong'][a.getUTCDay()];
          return `<button role="tab" aria-selected="${d === day}" data-day="${d}"><b>${esc(top).toUpperCase()}</b><small>${esc(sub)}</small></button>`; }).join('')}</div>
        <div class="events" role="tabpanel">${site.events.filter(e => tabKey(e) === day).map(eventCard).join('')}</div>
        <p class="ist">${esc(t.allTimesIst)}</p>
      </section>

      <section id="rsvp" class="rsvp-intro">${Art.corner('tr sm', 1)}${Art.corner('bl sm')}
        <h2 class="script">${esc(t.rsvpTitle)}</h2><p class="caps" style="margin:6px 0 0">${esc(t.rsvpSub)}</p>
        ${Art.divider()}
        <p style="margin:0;font:500 18px var(--serif)">${esc(t.rsvpBy)}</p>
        ${s.open ? `<p class="note">${esc(t.rsvpWhenSure)}</p><button class="btn" data-act="rsvp">${esc(t.rsvpCta)} ${Art.icon.arrow}</button>` : `<p class="note">${esc(t.rsvpClosed)}</p>`}
        ${storedToken ? `<p style="margin:14px 0 0"><span class="muted" style="font-size:15px">${esc(t.alreadyResponded)}</span><br><button class="linkbtn" data-act="myrsvp">${esc(t.viewEdit)}</button></p>` : ''}
      </section>

      ${site.settings.guide ? `<section id="travel" class="travel-teaser">
        <button class="guide-card" data-act="guide">
          <span class="gc-icon" aria-hidden="true">✈️</span>
          <span class="gc-text"><span class="caps">${esc(t.guideKicker)}</span><b>${esc(t.guideTitle)}</b><small>${esc(t.guideBlurb)}</small></span>
          <span class="gc-go">${esc(t.guideOpen)} ${Art.icon.arrow}</span>
        </button>
      </section>` : ''}

      <section id="venue">${Art.corner('tl sm')}${Art.corner('tr sm', 1)}
        <h2 class="script">${esc(t.venue)}</h2>
        <p style="margin:8px 0 0;font:500 19px var(--serif)">${esc(L(c.venueName))}</p><p class="muted" style="margin:0">${esc(L(c.venueCity))}</p>
        <div class="venue-img" style="${c.venueImageUrl ? 'border:0' : ''}">${c.venueImageUrl ? `<img src="${esc(media(c.venueImageUrl))}" alt="${esc(L(c.venueName))}" loading="lazy">` : `<span style="margin-top:-30px">${esc(t.venuePhoto)}</span>`}
          <a class="maps" href="${esc(s.mapsUrl)}" target="_blank" rel="noopener">${Art.icon.pin} ${esc(t.openMaps)}</a></div>
        ${stayText() ? `<div class="stay-note">${Art.icon.bed}<div><b>${esc(t.stayTitle)}</b>${esc(stayText())}${stayEarlyText() ? `<span class="stay-early">${esc(stayEarlyText())}</span>` : ''}</div></div>` : ''}
        <img class="agency" src="${AGENCY}" alt="Phoenix Event Media Group" loading="lazy">
        <p class="muted" style="max-width:340px;margin:6px auto 0;font-size:16px">${esc(t.helpBody)}</p>
        <a class="help-phone" href="tel:${esc(s.helpPhone)}">${Art.icon.phone} ${esc(s.helpPhoneDisplay)}</a>
        <div class="helpbtns"><a class="btn" href="${esc(waLink(s.helpPhone, t.waHello))}" target="_blank" rel="noopener">${Art.icon.whatsapp} WhatsApp</a>
          <a class="btn ghost" href="tel:${esc(s.helpPhone)}">${Art.icon.phone} ${esc(t.call)}</a></div>
      </section>
      </main>
      <footer>
        <img class="logo sm" src="${LOGO}" alt="" loading="lazy">
        <p class="names" style="font-size:32px">${esc(L(c.coupleShort))}</p>
        <p class="caps">${esc(datesLabel())} · ${lang === 'hi' ? 'इंदौर' : 'Indore'}</p>
        <button class="linkbtn" data-act="replay">${Art.icon.replay} ${esc(t.replay)}</button>
        <p class="muted" style="font-size:14px">${esc(t.footer)}</p>
      </footer>`;
    wireMain();
    revealOnScroll();
    tick(); clearInterval(timer); timer = setInterval(tick, 1000);
  }

  // ---------- travel guide (its own page) ----------
  let mainScroll = 0;
  function renderGuide() {
    if (!site.settings.guide) return goHome();
    if (view === 'main') mainScroll = scrollY;
    view = 'guide';
    clearInterval(timer);
    root.innerHTML = (window.PREVIEW ? `<div class="preview-banner">${esc(T().previewBanner)}</div>` : '') + Guide.render({
      helpPhone: site.settings.helpPhone, helpPhoneDisplay: site.settings.helpPhoneDisplay, contacts: site.settings.guideContacts, waLink, lang, langToggle, art: Art });
    try { if (location.hash !== '#travel-guide') history.pushState(null, '', '#travel-guide'); } catch {}
    scrollTo(0, 0);
    root.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => setLang(b.dataset.lang)));
    root.onclick = e => {
      const j = e.target.closest('[data-gjump]');
      if (j) { e.preventDefault(); const el = document.querySelector(j.getAttribute('href')); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
      if (e.target.closest('[data-act="home"]')) { e.preventDefault(); goHome(); }
    };
  }
  function goHome() { renderMain(); scrollTo(0, 0); const tr = $('#travel'); if (tr && mainScroll) scrollTo(0, tr.offsetTop - 80); }
  addEventListener('popstate', () => { if (view === 'guide' && location.hash !== '#travel-guide') goHome(); else if (view === 'main' && location.hash === '#travel-guide') renderGuide(); });

  function revealOnScroll() {
    if (!('IntersectionObserver' in window) || reduceMotion()) return;
    document.body.classList.add('reveal-on');
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll('.rv, section:not(#welcome) h2.script, .ecard, .guide-card, .venue-img, .agency').forEach(el => { el.classList.add('rv'); io.observe(el); });
  }

  function wireMain() {
    root.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => setLang(b.dataset.lang)));
    root.onclick = e => {
      const a = e.target.closest('[data-act],[data-event],[data-day]');
      if (!a) return;
      if (a.dataset.day) { day = a.dataset.day; const y = scrollY; renderMain(); scrollTo(0, y); return; }
      if (a.dataset.event) return openDetail(a.dataset.event);
      const act = a.dataset.act;
      if (act === 'menu') $('#drawer').classList.toggle('open');
      if (act === 'nav') $('#drawer').classList.remove('open');
      if (act === 'rsvp') openRsvp();
      if (act === 'myrsvp') { e.preventDefault(); loadEdit(ls.get('wd_edit')); }
      if (act === 'replay') showIntro();
      if (act === 'guide') { e.preventDefault(); $('#drawer') && $('#drawer').classList.remove('open'); renderGuide(); }
      if (act === 'logout') { e.preventDefault(); window.PREVIEW.logout(); ls.del('wd_seen_intro'); boot(); }
    };
    const bar = $('#top');
    window.onscroll = () => bar && bar.classList.toggle('scrolled', scrollY > 120);
  }

  // ---------- event detail ----------
  let detailId = null;
  function openDetail(id) {
    const e = site.events.find(x => x.id === id); if (!e) return;
    detailId = id;
    const t = T();
    closeSheet('detail');
    const el = document.createElement('div');
    el.className = 'sheet'; el.id = 'sheet-detail';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L(e.title));
    el.innerHTML = `<div class="scrim" data-close></div><div class="panel paper">
      <header><button class="iconbtn" data-close aria-label="${esc(t.back)}">${Art.icon.back}</button>${langToggle()}</header>
      <div class="center"><h2 class="script" style="font-size:${lang === 'hi' ? 32 : 40}px">${esc(L(e.title))}</h2>
      <p class="caps" style="margin:6px 0 0">${esc(fmtSpan(e, true))}<br>${esc(fmtWhen(e))}</p></div>
      ${e.imageUrl ? `<div class="detail-hero photo"><img src="${esc(media(e.imageUrl))}" alt="${esc(L(e.title))}"></div>` : `<div class="detail-hero">${Art.corner('tl sm')}${Art.corner('br sm', 1)}<img src="${LOGO}" alt="" style="width:110px;opacity:.9"></div>`}
      <p style="margin:0 0 6px">${esc(L(e.desc))}</p>
      <div class="infobox">${Art.icon.clock}<div><b>${esc(t.date)}</b>${esc(fmtSpan(e, true))}<br>${esc(fmtWhen(e))}${e.endDate ? `<br><span class="muted">${esc(t.comeAnyDays)}</span>` : ' IST'}</div></div>
      <div class="infobox">${Art.icon.dress}<div><b>${esc(t.dressCode)}</b>${dressLines(e).length ? dressLines(e).map((l, i) => i === 0 ? `<span class="dress-theme">${esc(l)}</span>` : `<span class="dress-line">${l.includes(':') ? `<em>${esc(l.slice(0, l.indexOf(':') + 1))}</em>${esc(l.slice(l.indexOf(':') + 1))}` : esc(l)}</span>`).join('') : esc(t.dressSoonLong)}${(e.palette || []).length ? `<div class="dress-visual">${Art.outfits(e.palette, e.id.replace(/[^a-z0-9]/gi, ''))}</div>` : ''}</div></div>
      <div class="infobox">${Art.icon.pin}<div style="flex:1"><b>${esc(t.venueLabel)}</b>${e.endDate ? esc(L(e.location) || t.toBeShared) : esc(L(site.content.venueName)) + (L(e.location) ? ' — ' + esc(L(e.location)) : `<br><span class="muted">${esc(t.toBeShared)}</span>`)}
        ${e.mapsUrl || !e.endDate ? `<br><a class="linkbtn" style="padding:8px 0 0" href="${esc(e.mapsUrl || site.settings.mapsUrl)}" target="_blank" rel="noopener">${esc(t.directions)} ${Art.icon.arrow}</a>` : ''}</div></div>
      ${site.settings.open ? `<button class="btn block" style="margin-top:22px" data-act="rsvp2">${esc(t.rsvpCta)}</button>` : ''}
    </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    el.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => { detailId = null; closeSheet('detail'); }));
    el.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => setLang(b.dataset.lang)));
    const r2 = el.querySelector('[data-act="rsvp2"]'); if (r2) r2.onclick = () => { detailId = null; closeSheet('detail'); openRsvp(); };
    el.querySelector('[data-close]').focus({ preventScroll: true });
  }
  function closeSheet(name) {
    const el = $('#sheet-' + name); if (el) el.remove();
    if (!document.querySelector('.sheet')) document.body.style.overflow = '';
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('.modal')) return $('.modal').remove();
    if ($('#sheet-detail')) { detailId = null; return closeSheet('detail'); }
    if ($('#sheet-rsvp') && rsvp.step !== 'done') { rsvp.open = false; closeSheet('rsvp'); }
  });

  // ---------- RSVP ----------
  // Who's coming: the person replying is attendee 1 by default ("I'll be there"), and adds
  // anyone else by name. The head-count is simply the length of that list.
  const blankForm = () => ({ status: '', primaryName: '', phoneCc: '+91', phoneNumber: '', note: '', meAttending: true, others: [], events: [],
    arrivalDate: '', arrivalWindow: '', departureDate: '', departureWindow: '', songName: '', songArtist: '', songUrl: '', questions: '' });
  const rsvp = { open: false, step: 0, form: blankForm(), errors: {}, mode: 'new', token: null, formErr: '', busy: false, saved: null };
  const STEP_FIELDS = {
    details: ['status', 'primaryName', 'phone', 'note'],
    party: ['partySize', 'guest', 'events'],
    travel: ['arrivalDate', 'arrivalWindow', 'departureDate', 'departureWindow', 'songUrl', 'songName', 'songArtist', 'questions'],
    review: [],
  };
  const isSimple = () => !!(site && site.settings.simple);
  const isFull = () => !!(site && site.settings.full); // RSVP covers every event the group is invited to
  const stepsFor = f => f.status === 'decline' ? ['details', 'review'] : isSimple() ? ['details', 'party', 'review'] : ['details', 'party', 'travel', 'review'];
  const stepKey = () => rsvp.step === 'done' ? 'done' : stepsFor(rsvp.form)[Math.min(rsvp.step, stepsFor(rsvp.form).length - 1)];
  const guestsOf = f => (f.others ? [...(f.meAttending ? [f.primaryName] : []), ...f.others] : (f.guests || []));
  const offset = f => (f.meAttending ? 1 : 0); // index of others[0] inside the guests list
  const CCS = ['+971', '+974', '+966', '+968', '+973', '+965', '+852', '+353', '+91', '+44', '+65', '+61', '+49', '+33', '+81', '+86', '+64', '+27', '+60', '+66', '+39', '+31', '+41', '+46', '+1', '+7'];
  function splitPhone(e164) { const cc = CCS.find(c => e164.startsWith(c)) || e164.slice(0, 3); return { phoneCc: cc, phoneNumber: e164.slice(cc.length) }; }
  const sameName = (a, b) => Rules.clean(a).toLowerCase() === Rules.clean(b).toLowerCase();

  function openRsvp(edit) {
    rsvp.open = true;
    if (!edit) { if (rsvp.mode === 'edit' || rsvp.step === 'done') rsvp.form = blankForm(); rsvp.mode = 'new'; rsvp.token = null; rsvp.step = 0; rsvp.errors = {}; rsvp.formErr = ''; rsvp.saved = null; }
    renderRsvp();
  }

  function dateOptions(min, max, sel) {
    const out = [`<option value="">—</option>`];
    for (let d = dObj(min); d <= dObj(max); d.setUTCDate(d.getUTCDate() + 1)) { const k = d.toISOString().slice(0, 10); out.push(`<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(fmtDate(k, true))}</option>`); }
    return out.join('');
  }
  const errMsg = (f) => { const code = rsvp.errors[f]; return code ? esc(T().err[code] || T().err.required) : ''; };
  const fieldCls = f => 'field' + (rsvp.errors[f] ? ' bad' : '');
  const pills = (name, val) => `<div class="pills" role="radiogroup">${Rules.WINDOWS.map(w => `<button type="button" role="radio" data-pill="${name}" data-val="${w}" aria-pressed="${val === w}" aria-checked="${val === w}">${esc(T().windows[w])}</button>`).join('')}</div>`;
  const dayLabel = d => { const x = dObj(d), t = T(); return `${t.weekday[x.getUTCDay()]} ${x.getUTCDate()} ${t.monthShort[x.getUTCMonth()]}`; };

  function partyHtml() {
    const t = T(), f = rsvp.form, s = site.settings;
    const total = guestsOf(f).length, off = offset(f);
    return `
      <p class="q">${esc(t.whosComing)}</p>
      <div class="${fieldCls('partySize')}"><div class="party">
        <label class="me ${f.meAttending ? 'on' : ''}"><input type="checkbox" data-me ${f.meAttending ? 'checked' : ''}><span class="box">${Art.icon.check}</span>
          <span><b>${esc(f.primaryName)}</b> <small class="muted">(${esc(t.you)})</small><small class="sub">${esc(f.meAttending ? t.imComing : t.notMe)}</small></span></label>
        ${f.others.map((g, i) => `<div class="${fieldCls('guest' + (i + off))} other"><label class="sr" for="f-o${i}">${esc(t.guestN(i + off + 1))}</label>
          <div class="orow"><input class="input" id="f-o${i}" data-other="${i}" value="${esc(g)}" maxlength="80" autocomplete="off" placeholder="${esc(t.guestPlaceholder)}">
          <button type="button" class="iconbtn rm" data-rm="${i}" aria-label="${esc(t.remove)}">${Art.icon.close}</button></div><p class="msg">${errMsg('guest' + (i + off))}</p></div>`).join('')}
        ${total < s.maxParty ? `<button type="button" class="addguest" data-add>+ ${esc(f.others.length ? t.addAnother : t.addGuest)}</button>` : ''}
      </div>
      <p class="count">${esc(t.peopleCount(total))}</p><p class="msg">${esc(rsvp.errors.partySize ? t.err.atLeastOne : '')}</p></div>`;
  }

  function eventsHtml() {
    const t = T(), f = rsvp.form;
    if (isSimple()) {
      const e = site.events[0];
      return e ? `<div class="callout" style="margin-top:22px">${esc(t.simpleInvite)} <b>${esc(L(e.title))}</b> · ${esc(fmtSpan(e))} · ${esc(fmtWhen(e))}</div>` : '';
    }
    if (isFull()) return '';
    const items = site.events.map(e => {
      const days = Rules.eventDays(e);
      if (days.length > 1) {
        return `<div class="evitem multi"><span><b>${esc(L(e.title))}</b><small>${esc(fmtSpan(e))}${L(e.timeNote) ? ' · ' + esc(L(e.timeNote)) : ''}</small>
          <small class="sub">${esc(t.whichDays)}</small>
          <span class="pills">${days.map(d => { const id = `${e.id}@${d}`, on = f.events.includes(id); return `<button type="button" data-evday="${esc(id)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(dayLabel(d))}</button>`; }).join('')}</span></span></div>`;
      }
      return `<label class="evitem"><input type="checkbox" data-ev="${esc(e.id)}" ${f.events.includes(e.id) ? 'checked' : ''}><span class="box">${Art.icon.check}</span>
          <span><b>${esc(L(e.title))}</b><small>${esc(fmtDate(e.date))} · ${esc(fmtRange(e))}</small></span></label>`;
    }).join('');
    return `<div class="${fieldCls('events')}" style="margin-top:30px"><p class="q" style="margin:0">${esc(t.whichEvents)}</p><p class="hint" style="margin:2px 0 10px">${esc(t.whichEventsSub)}</p>
        <div style="text-align:right"><button type="button" class="linkbtn" data-allevents>${esc(t.selectAll)}</button></div>
        <div class="evlist choices">${items}</div><p class="msg">${errMsg('events')}</p></div>`;
  }

  function stepBody() {
    const t = T(), f = rsvp.form, s = site.settings, key = stepKey();
    if (key === 'details') return `
      <div class="${fieldCls('status')}"><p class="q">${esc(t.willAttend)}</p>
        <div class="choice2 choices"><button type="button" data-status="accept" aria-pressed="${f.status === 'accept'}">${Art.icon.sprig}${esc(t.accept)}</button>
        <button type="button" data-status="decline" aria-pressed="${f.status === 'decline'}">${Art.icon.flower}${esc(t.decline)}</button></div><p class="msg">${errMsg('status')}</p></div>
      <div class="${fieldCls('primaryName')}"><label for="f-primaryName">${esc(t.primaryName)}</label>
        <input class="input" id="f-primaryName" data-f="primaryName" value="${esc(f.primaryName)}" autocomplete="name" maxlength="80" placeholder="${esc(t.fullNameHint)}"><p class="msg">${errMsg('primaryName')}</p></div>
      <div class="${fieldCls('phone')}"><label for="f-phone">${esc(t.whatsapp)}</label>
        <div class="phone"><input class="input" aria-label="${esc(t.countryCode)}" data-f="phoneCc" value="${esc(f.phoneCc)}" inputmode="tel" maxlength="5" autocomplete="tel-country-code">
        <input class="input" id="f-phone" data-f="phoneNumber" value="${esc(f.phoneNumber)}" inputmode="tel" maxlength="20" autocomplete="tel-national" placeholder="98765 43210"></div>
        <p class="hint">${esc(t.whatsappHint)}</p><p class="msg">${errMsg('phone')}</p></div>
      ${f.status === 'decline' ? `<div class="field"><label for="f-note">${esc(t.declineNote)}</label><textarea class="input" id="f-note" data-f="note" maxlength="1000">${esc(f.note)}</textarea></div>` : ''}`;
    if (key === 'party') return partyHtml() + eventsHtml();
    if (key === 'travel') return `
      <p class="callout">${stayText() ? esc(stayText() + ' ' + t.stayPlan) : esc(t.accommodation)}</p>
      <p class="q">${esc(t.arrival)}</p>
      <div class="${fieldCls('arrivalDate')}"><label for="f-ad">${esc(t.date)}</label><select class="input" id="f-ad" data-f="arrivalDate">${dateOptions(s.arrivalMin, s.arrivalMax, f.arrivalDate)}</select><p class="msg">${errMsg('arrivalDate')}</p></div>
      <div class="${fieldCls('arrivalWindow')}"><span class="label">${esc(t.timeOfDay)}</span>${pills('arrivalWindow', f.arrivalWindow)}<p class="msg">${errMsg('arrivalWindow')}</p></div>
      <p class="q" style="margin-top:26px">${esc(t.departure)}</p>
      <div class="${fieldCls('departureDate')}"><label for="f-dd">${esc(t.date)}</label><select class="input" id="f-dd" data-f="departureDate">${dateOptions(s.departureMin, s.departureMax, f.departureDate)}</select><p class="msg">${errMsg('departureDate')}</p></div>
      <div class="${fieldCls('departureWindow')}"><span class="label">${esc(t.timeOfDay)}</span>${pills('departureWindow', f.departureWindow)}<p class="msg">${errMsg('departureWindow')}</p></div>
      ${isFull() ? '' : `<p class="q" style="margin-top:30px">${esc(t.song)}</p>
      <div class="field"><label for="f-sn">${esc(t.songName)} <span class="muted">(${esc(t.optional)})</span></label><input class="input" id="f-sn" data-f="songName" value="${esc(f.songName)}" maxlength="120"></div>
      <div class="field"><label for="f-sa">${esc(t.artist)} <span class="muted">(${esc(t.optional)})</span></label><input class="input" id="f-sa" data-f="songArtist" value="${esc(f.songArtist)}" maxlength="120"></div>
      <div class="${fieldCls('songUrl')}"><label for="f-su">${esc(t.songUrl)}</label><input class="input" id="f-su" data-f="songUrl" value="${esc(f.songUrl)}" inputmode="url" maxlength="300" placeholder="https://"><p class="msg">${errMsg('songUrl')}</p></div>`}
      <div class="field" style="margin-top:26px"><label for="f-q" class="q" style="font:500 20px/1.35 var(--serif);color:var(--ink)">${esc(t.questions)}</label><textarea class="input" id="f-q" data-f="questions" maxlength="1500">${esc(f.questions)}</textarea></div>`;
    return reviewHtml();
  }

  // Selected events, with the days of a multi-day event folded into one line.
  function eventsSummary(ids) {
    return site.events.map(e => {
      const days = Rules.eventDays(e);
      if (days.length > 1) {
        const picked = days.filter(d => ids.includes(`${e.id}@${d}`));
        return picked.length ? `${esc(L(e.title))}<br><small class="muted">${picked.map(d => esc(dayLabel(d))).join(', ')}</small>` : '';
      }
      return ids.includes(e.id) ? esc(L(e.title)) : '';
    }).filter(Boolean).join('<br>') || '—';
  }

  function summaryRows(f, editable) {
    const t = T(), steps = stepsFor(f);
    const at = k => steps.indexOf(k);
    const row = (label, val, step) => `<div class="row"><dt>${esc(label)}</dt><dd>${val}</dd>${editable && step >= 0 ? `<button type="button" class="linkbtn" data-goto="${step}">${esc(t.edit)}</button>` : '<span></span>'}</div>`;
    const travel = f.arrivalDate ? `${esc(fmtDate(f.arrivalDate))}, ${esc(t.windows[f.arrivalWindow] || '')} → ${esc(fmtDate(f.departureDate))}, ${esc(t.windows[f.departureWindow] || '')}` : '—';
    const phone = Rules.normalizePhone(f.phoneCc, f.phoneNumber) || (f.phoneCc + ' ' + f.phoneNumber);
    const guests = guestsOf(f);
    let rows = row(t.rsvpTitle, `<b>${esc(f.status === 'accept' ? t.attending : t.notAttending)}</b>`, at('details')) + row(t.primaryName, esc(f.primaryName), at('details')) + row(t.whatsapp, esc(phone), at('details'));
    if (f.status === 'accept') {
      rows += row(`${t.guests} (${guests.length})`, guests.map(esc).join('<br>'), at('party'))
        + (isFull() ? '' : row(t.events, isSimple() ? site.events.map(e => esc(L(e.title))).join('<br>') : eventsSummary(f.events), isSimple() ? -1 : at('party')));
      if (!isSimple()) rows += row(t.travel, travel, at('travel'))
        + (f.songName || f.songArtist ? row('♪', esc([f.songName, f.songArtist].filter(Boolean).join(' — ')) + (f.songUrl ? `<br><small class="muted">${esc(f.songUrl)}</small>` : ''), at('travel')) : '')
        + (f.questions ? row(t.message, esc(f.questions), at('travel')) : '');
    } else if (f.note) rows += row(t.message, esc(f.note), at('details'));
    return `<div class="summary"><dl>${rows}</dl></div>`;
  }
  function reviewHtml() {
    const t = T();
    return `<p class="q center">${esc(t.reviewTitle)}</p><p class="hint center muted" style="margin-top:-6px;font-size:15px">${esc(t.reviewHint)}</p>${summaryRows(rsvp.form, true)}
      <p class="muted center" style="font-size:15px">${esc(t.rsvpWhenSure)}</p>`;
  }

  function renderRsvp() {
    const t = T();
    let el = $('#sheet-rsvp');
    const prevScroll = el ? el.querySelector('.panel').scrollTop : 0;
    if (!el) {
      el = document.createElement('div'); el.className = 'sheet'; el.id = 'sheet-rsvp';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t.rsvpTitle);
      document.body.appendChild(el); document.body.style.overflow = 'hidden';
    }
    if (rsvp.step === 'done') { el.innerHTML = doneHtml(); wireDone(el); return; }
    const steps = stepsFor(rsvp.form), cur = Math.min(rsvp.step, steps.length - 1), last = steps.length - 1;
    rsvp.step = cur;
    el.innerHTML = `<div class="scrim"></div><div class="panel paper">
      <header><button class="iconbtn" data-rsvp="close" aria-label="${esc(t.cancel)}">${Art.icon.close}</button>${langToggle()}</header>
      <div class="center"><h2 class="script" style="font-size:${lang === 'hi' ? 32 : 40}px">${esc(t.rsvpTitle)}</h2>
        <p class="caps" style="margin:4px 0 0">${esc(rsvp.mode === 'edit' ? t.editing : t.rsvpSub)}</p></div>
      <div class="stepper" aria-hidden="true">${steps.map((k, i) => `<div class="${i === cur ? 'on' : i < cur ? 'done' : ''}"><i>${i < cur ? '✓' : i + 1}</i>${esc(t.stepNames[k === 'travel' && isFull() ? 'travelOnly' : k])}</div>`).join('')}</div>
      <form class="form" novalidate>${stepBody()}
        ${rsvp.formErr ? `<p class="formerr" role="alert">${esc(rsvp.formErr)}</p>` : ''}
        <div class="btnrow">${cur > 0 ? `<button type="button" class="btn ghost" data-rsvp="back">${Art.icon.back} ${esc(t.back)}</button>` : ''}
          ${cur < last ? `<button type="button" class="btn" data-rsvp="next">${esc(t.next)} ${Art.icon.arrow}</button>` : `<button type="button" class="btn" data-rsvp="submit" ${rsvp.busy ? 'disabled' : ''}>${esc(rsvp.busy ? t.sending : rsvp.mode === 'edit' ? t.saveChanges : t.submit)}</button>`}</div>
      </form></div>`;
    el.querySelector('.panel').scrollTop = prevScroll;
    el.querySelector('form').onsubmit = e => e.preventDefault();
    wireRsvp(el);
  }

  function wireRsvp(el) {
    const f = rsvp.form;
    const optionIds = Rules.eventOptions(site.events).map(o => o.id);
    const setEvents = ids => { f.events = optionIds.filter(id => ids.includes(id)); delete rsvp.errors.events; };
    const clearGuestErrs = () => { Object.keys(rsvp.errors).filter(k => k.startsWith('guest') || k === 'partySize').forEach(k => delete rsvp.errors[k]); };
    el.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => setLang(b.dataset.lang)));
    el.querySelectorAll('[data-f]').forEach(i => (i.oninput = i.onchange = () => { f[i.dataset.f] = i.value; clearErr(i.dataset.f === 'phoneCc' || i.dataset.f === 'phoneNumber' ? 'phone' : i.dataset.f, i); }));
    el.querySelectorAll('[data-other]').forEach(i => (i.oninput = () => { f.others[+i.dataset.other] = i.value; clearErr('guest' + (+i.dataset.other + offset(f)), i); }));
    el.querySelectorAll('[data-status]').forEach(b => (b.onclick = () => { f.status = b.dataset.status; delete rsvp.errors.status; renderRsvp(); }));
    const me = el.querySelector('[data-me]');
    if (me) me.onchange = () => { f.meAttending = me.checked; clearGuestErrs(); renderRsvp(); };
    const add = el.querySelector('[data-add]');
    if (add) add.onclick = () => { f.others.push(''); clearGuestErrs(); renderRsvp(); const ins = el.querySelectorAll('[data-other]'); if (ins.length) ins[ins.length - 1].focus(); };
    el.querySelectorAll('[data-rm]').forEach(b => (b.onclick = () => { f.others.splice(+b.dataset.rm, 1); clearGuestErrs(); renderRsvp(); }));
    el.querySelectorAll('[data-ev]').forEach(c => (c.onchange = () => { setEvents(c.checked ? [...f.events, c.dataset.ev] : f.events.filter(x => x !== c.dataset.ev)); const fl = c.closest('.field'); if (fl) fl.classList.remove('bad'); }));
    el.querySelectorAll('[data-evday]').forEach(b => (b.onclick = () => { const id = b.dataset.evday; setEvents(f.events.includes(id) ? f.events.filter(x => x !== id) : [...f.events, id]); renderRsvp(); }));
    const all = el.querySelector('[data-allevents]');
    if (all) all.onclick = () => { setEvents(f.events.length === optionIds.length ? [] : optionIds); renderRsvp(); };
    el.querySelectorAll('[data-pill]').forEach(b => (b.onclick = () => { f[b.dataset.pill] = b.dataset.val; delete rsvp.errors[b.dataset.pill]; delete rsvp.errors.departureDate; renderRsvp(); }));
    el.querySelectorAll('[data-goto]').forEach(b => (b.onclick = () => { rsvp.step = +b.dataset.goto; rsvp.formErr = ''; renderRsvp(); el.querySelector('.panel').scrollTop = 0; }));
    el.querySelectorAll('[data-rsvp]').forEach(b => (b.onclick = () => {
      const a = b.dataset.rsvp;
      if (a === 'close') { rsvp.open = false; closeSheet('rsvp'); }
      if (a === 'back') { rsvp.step = Math.max(0, rsvp.step - 1); rsvp.formErr = ''; renderRsvp(); el.querySelector('.panel').scrollTop = 0; }
      if (a === 'next') next();
      if (a === 'submit') submit();
    }));
  }
  function clearErr(k, input) {
    if (!rsvp.errors[k]) return;
    delete rsvp.errors[k];
    const fld = input.closest('.field'); if (fld) fld.classList.remove('bad');
  }

  const inStep = (k, key) => STEP_FIELDS[key].some(p => k === p || (p === 'guest' && k.startsWith('guest')));
  function validateStep(key) {
    const res = Rules.validateRsvp(payload(), { group: site.group, events: site.events, settings: site.settings });
    const errs = {};
    Object.entries(res.errors).forEach(([k, v]) => { if (inStep(k, key)) errs[k] = v; });
    // the replier's own name is checked on the details step, not again as "guest 1"
    if (key === 'party' && rsvp.form.meAttending) delete errs.guest0;
    return errs;
  }
  function next() {
    // drop blank "add a guest" rows rather than flagging them
    if (stepKey() === 'party') rsvp.form.others = rsvp.form.others.filter((g, i, a) => g.trim() || a.length === 1 && !rsvp.form.meAttending);
    const errs = validateStep(stepKey());
    rsvp.errors = errs;
    if (Object.keys(errs).length) { rsvp.formErr = T().fixErrors; renderRsvp(); focusFirstError(); return; }
    rsvp.formErr = '';
    rsvp.step += 1;
    renderRsvp(); $('#sheet-rsvp .panel').scrollTop = 0;
  }
  function focusFirstError() { const bad = $('#sheet-rsvp .field.bad'); if (bad) { bad.scrollIntoView({ block: 'center' }); const i = bad.querySelector('input,select,button'); if (i) i.focus({ preventScroll: true }); } }
  function payload() {
    const f = rsvp.form, guests = guestsOf(f).map(g => g.trim());
    const { others, meAttending, ...rest } = f;
    return { ...rest, partySize: guests.length, guests, events: isSimple() ? Rules.eventOptions(site.events).map(o => o.id) : f.events };
  }

  async function submit(confirmDuplicate) {
    const t = T();
    const res = Rules.validateRsvp(payload(), { group: site.group, events: site.events, settings: site.settings });
    if (!res.ok) { rsvp.errors = res.errors; rsvp.step = firstStepWithError(res.errors); rsvp.formErr = t.fixErrors; renderRsvp(); focusFirstError(); return; }
    rsvp.busy = true; rsvp.formErr = ''; renderRsvp();
    const r = rsvp.mode === 'edit'
      ? await call('PUT', '/api/rsvp', { token: rsvp.token, data: payload() })
      : await call('POST', '/api/rsvp', { ...payload(), confirmDuplicate: !!confirmDuplicate });
    rsvp.busy = false;
    if (r.status === 200 && r.body && r.body.ok) {
      if (r.body.editToken) { rsvp.token = r.body.editToken; ls.set('wd_edit', rsvp.token); }
      rsvp.saved = r.body.submission; rsvp.step = 'done'; renderRsvp(); return;
    }
    if (r.status === 409) { renderRsvp(); return dupModal(); }
    if (r.status === 422 && r.body.fields) { rsvp.errors = r.body.fields; rsvp.step = firstStepWithError(r.body.fields); rsvp.formErr = t.fixErrors; renderRsvp(); focusFirstError(); return; }
    if (r.status === 401) { rsvp.open = false; closeSheet('rsvp'); return renderGate(); }
    rsvp.formErr = r.status === 0 ? t.network : r.status === 403 ? t.deadline : r.status === 429 ? t.rateLimited : t.serverError;
    renderRsvp();
  }
  function firstStepWithError(errs) {
    const steps = stepsFor(rsvp.form);
    const keys = Object.keys(errs).map(k => (k === 'guest0' && rsvp.form.meAttending ? 'primaryName' : k));
    const i = steps.findIndex(st => keys.some(k => inStep(k, st)));
    return i < 0 ? steps.length - 1 : i;
  }
  function dupModal() {
    const t = T();
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'alertdialog');
    m.innerHTML = `<div class="box paper"><p class="q">${esc(t.dupTitle)}</p><p class="muted" style="font-size:16px">${esc(t.dupBody)}</p>
      <div class="btnrow"><button class="btn ghost" data-m="cancel">${esc(t.cancel)}</button><button class="btn" data-m="send">${esc(t.sendAnyway)}</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('[data-m="cancel"]').onclick = () => m.remove();
    m.querySelector('[data-m="send"]').onclick = () => { m.remove(); submit(true); };
  }

  function editUrl(token) { return `${location.origin}${location.pathname}#edit=${token}`; }
  function doneHtml() {
    const t = T(), s = rsvp.saved;
    const f = { ...s, ...splitPhone(s.phone) };
    return `<div class="scrim"></div><div class="panel paper">${Art.corner('tl sm')}${Art.corner('tr sm', 1)}
      <header><span></span>${langToggle()}</header>
      <div class="center"><div class="success-mark">${Art.icon.check}</div>
        <h2 class="script" style="font-size:${lang === 'hi' ? 26 : 32}px;max-width:330px;margin:0 auto">${esc(s.status === 'accept' ? t.thankYouAccept : t.thankYouDecline)}</h2>
        <p class="muted">${esc(t.savedNote)}</p></div>
      ${summaryRows(f, false)}
      <p class="q" style="margin-top:24px">${esc(t.editLinkTitle)}</p>
      <p class="muted" style="font-size:15px;margin-top:-6px">${esc(t.editLinkBody)}</p>
      <div class="editlink"><span id="elink">${esc(editUrl(rsvp.token))}</span><button class="btn ghost" style="min-height:40px;padding:0 14px" data-done="copy">${Art.icon.copy} ${esc(t.copy)}</button></div>
      <a class="btn ghost block" style="margin-top:10px" target="_blank" rel="noopener" href="${esc(waLink(s.phone, `${t.editLinkTitle} — Dreamy & Abhishek: ${editUrl(rsvp.token)}`))}">${Art.icon.whatsapp} ${esc(t.saveToWhatsapp)}</a>
      <button class="btn block" style="margin-top:16px" data-done="close">${esc(t.done)}</button></div>`;
  }
  function wireDone(el) {
    el.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => setLang(b.dataset.lang)));
    el.querySelector('[data-done="close"]').onclick = () => { rsvp.open = false; closeSheet('rsvp'); rsvp.step = 0; rsvp.mode = 'new'; rsvp.form = blankForm(); renderMain(); };
    const cp = el.querySelector('[data-done="copy"]');
    cp.onclick = async () => {
      const text = editUrl(rsvp.token);
      try { await navigator.clipboard.writeText(text); }
      catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
      cp.innerHTML = `${Art.icon.check} ${esc(T().copied)}`;
    };
  }

  async function loadEdit(token) {
    if (!token) return;
    const r = await call('POST', '/api/rsvp/lookup', { token });
    if (r.status !== 200) {
      if (!site) return renderGate(T().editNotFound);
      rsvp.open = false; closeSheet('rsvp'); return renderGate(T().editNotFound);
    }
    site = r.body.site;
    const s = r.body.submission;
    if (!document.querySelector('.topbar')) renderMain();
    const mine = s.status !== 'accept' || (s.guests.length && sameName(s.guests[0], s.primaryName));
    const { guests: savedGuests, partySize: _ps, ...savedRest } = s;
    rsvp.form = { ...blankForm(), ...savedRest, ...splitPhone(s.phone), meAttending: !!mine, others: s.status === 'accept' ? savedGuests.slice(mine ? 1 : 0) : [] };
    rsvp.mode = 'edit'; rsvp.token = token; rsvp.step = stepsFor(rsvp.form).length - 1; rsvp.errors = {}; rsvp.formErr = '';
    ls.set('wd_edit', token);
    if (!site.settings.editsOpen) { rsvp.saved = s; rsvp.step = 'done'; }
    openRsvp(true);
  }

  // ---------- boot ----------
  async function boot() {
    document.documentElement.lang = lang;
    document.body.classList.toggle('lang-hi', lang === 'hi');
    if (!document.getElementById('art-defs')) { const d = document.createElement('div'); d.id = 'art-defs'; d.innerHTML = Art.defs; document.body.prepend(d); }
    const hash = new URLSearchParams(location.hash.slice(1));
    const params = new URLSearchParams(location.search);
    if (params.get('lang')) { const q = new URLSearchParams(location.search); q.delete('lang'); try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch {} }
    if (hash.get('edit')) {
      const token = hash.get('edit');
      try { history.replaceState(null, '', location.pathname + location.search); } catch {}
      ls.set('wd_seen_intro', '1');
      const r = await call('GET', '/api/site');
      if (r.status === 200) { site = r.body; if (!ls.get('wd_lang') && site.settings.defaultLang) applyLang(site.settings.defaultLang); renderMain(); }
      return loadEdit(token);
    }
    if (params.get('invite')) {
      const code = params.get('invite');
      try { history.replaceState(null, '', location.pathname); } catch {}
      const a = await call('POST', '/api/access', { code });
      if (a.status !== 200) return renderGate(T().badCode);
    }
    const r = await call('GET', '/api/site');
    if (r.status === 401) return renderGate(params.get('invalid') ? T().badCode : '');
    if (r.status !== 200) return renderGate(T().network);
    site = r.body;
    if (!ls.get('wd_lang') && site.settings.defaultLang && site.settings.defaultLang !== lang) applyLang(site.settings.defaultLang);
    let wantGuide = false; try { wantGuide = location.hash === '#travel-guide'; } catch {}
    if (wantGuide) return renderGuide();
    renderMain();
    if (!ls.get('wd_seen_intro')) showIntro();
  }
  // An edit link opened in an already-open tab only changes the hash.
  addEventListener('hashchange', () => {
    const tok = new URLSearchParams(location.hash.slice(1)).get('edit');
    if (tok && view === 'main') { try { history.replaceState(null, '', location.pathname + location.search); } catch {} loadEdit(tok); }
    else if (tok) boot();
  });
  window.GuestApp = { boot };
})();
