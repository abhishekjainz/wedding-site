// India travel guide for international guests. A separate page inside the private site,
// linked from the main invitation. Facts checked October 2026 — see SOURCES at the bottom.
const Guide = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHECKED = 'October 2026';

  const ic = {
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 15.5v-2l-8-5V3.6a1.5 1.5 0 0 0-3 0v4.9l-8 5v2l8-2.5v4.4l-2 1.5V21l3.5-1 3.5 1v-2.1l-2-1.5V13l8 2.5Z"/></svg>',
    car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.6 7.2A2 2 0 0 1 7.5 6h9a2 2 0 0 1 1.9 1.2L20 11a2 2 0 0 1 1 1.7V16a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-3.3A2 2 0 0 1 4 11Zm1.6.8L6 11h12l-1.2-3Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M20 12H5m5-5-5 5 5 5"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 8h14l-3-3M20 16H6l3 3"/></svg>',
  };

  // A route is a list of stops; each leg says how you travel to the next stop.
  const route = stops => `<div class="route">${stops.map((s, i) => `${i ? `<span class="leg ${s.by}">${s.by === 'fly' ? ic.plane : ic.car}<small>${esc(s.time || '')}</small></span>` : ''}<span class="stop ${s.end ? 'end' : ''}"><i></i>${esc(s.name)}</span>`).join('')}</div>`;

  const TRIPS = [
    { from: 'Landing in Delhi?', options: [
      { tag: 'Option 1', title: 'The Golden Triangle Lite', sub: 'Delhi → Agra → Jaipur → fly to Indore', days: '4–5 days',
        stops: [{ name: 'Delhi' }, { name: 'Agra', by: 'drive', time: '3½–4 h' }, { name: 'Jaipur', by: 'drive', time: '4–5 h' }, { name: 'Indore', by: 'fly', time: '1½ h direct', end: true }],
        body: [
          ['Agra', 'Stop for a day to see the iconic Taj Mahal — honestly, one day is plenty here as there aren’t many other sights. Go at sunrise for soft light and smaller crowds, and note the Taj is <b>closed on Fridays</b>.'],
          ['Jaipur, the Pink City', 'My personal favourite — I used to live here! Incredible culture, grand palaces (Amber Fort, City Palace, Hawa Mahal), amazing street shopping for souvenirs in Johari and Bapu Bazaar, and top-tier food. I have lots of local friends here who can show you around!'],
          ['Getting around', 'Best done by hiring a private car with a driver (about 3½–4 hours Delhi → Agra on the expressway, 4–5 hours Agra → Jaipur). I can help you arrange trusted drivers closer to the date. From Jaipur, take a direct flight to Indore.'],
        ] },
      { tag: 'Option 2', title: 'Culture & Lakes', sub: 'Delhi → Udaipur → road trip to Indore', days: '3–4 days',
        stops: [{ name: 'Delhi' }, { name: 'Udaipur', by: 'fly', time: '1¼ h' }, { name: 'Indore', by: 'drive', time: '6–7 h', end: true }],
        body: [
          ['Udaipur, the City of Lakes', 'Take a short flight from Delhi. Sunset boat rides on Lake Pichola, the floating Lake Palace and Jag Mandir, the vast City Palace, rooftop dinners — beautiful, romantic and slower-paced.'],
          ['Getting to Indore', 'There’s currently no direct flight from Udaipur to Indore, so make it a scenic 6–7 hour road trip by private car through the Rajasthan and Malwa countryside.'],
        ] },
    ] },
    { from: 'Landing in Mumbai?', options: [
      { tag: 'Option 1', title: 'Mumbai City Explore', sub: 'Easiest & least hectic', days: '2–3 days',
        stops: [{ name: 'Mumbai' }, { name: 'Indore', by: 'fly', time: '1½ h direct', end: true }],
        body: [['Why we love it', 'Spend 2–3 days on Mumbai’s nightlife, heritage architecture and coastal vibes — the Gateway of India and Colaba, a sunset walk on Marine Drive, the art-deco and Victorian Gothic buildings of the Fort area, and Bandra’s cafés and bars. Then catch a quick direct flight to Indore.']] },
      { tag: 'Option 2', title: 'The Beach Reset 🏖️', sub: 'Mumbai → Goa → fly to Indore', days: '3–4 days',
        stops: [{ name: 'Mumbai' }, { name: 'Goa', by: 'fly', time: '1¼ h' }, { name: 'Indore', by: 'fly', time: '1¾ h direct', end: true }],
        body: [['Goa', 'Sun, beaches, sea breeze and beach parties. North Goa is lively (Anjuna, Vagator); South Goa is calmer and quieter (Palolem, Colva). Goa has two airports — Dabolim (GOI) and Mopa (GOX) — so check which one your flights use. A direct flight takes you on to Indore.']] },
      { tag: 'Option 3', title: 'Culture & Scenery', sub: 'Mumbai → Udaipur → road trip to Indore', days: '3–4 days',
        stops: [{ name: 'Mumbai' }, { name: 'Udaipur', by: 'fly', time: '1½ h' }, { name: 'Indore', by: 'drive', time: '6–7 h', end: true }],
        body: [['Udaipur', 'Fly to Udaipur for lake rides and palaces, then take a private car for the 6–7 hour road trip to Indore.']] },
    ] },
  ];

  const NEAR = [
    { name: 'Indore itself', time: 'In town', text: 'Graze through Sarafa Bazaar’s famous night-time street-food market and Chappan Dukan (“56 shops”), see the Holkar-era Rajwada palace and Lal Bagh Palace, and visit Kanch Mandir — a Jain temple covered floor to ceiling in mirrors and glass.' },
    { name: 'Ujjain', time: '≈ 1–1½ h', text: 'One of India’s seven holy cities, home to the Mahakaleshwar Jyotirlinga temple and ghats on the Shipra river. Temples are busy — go early.' },
    { name: 'Omkareshwar', time: '≈ 2–2½ h', text: 'A sacred island temple town on the Narmada river, shaped (they say) like the symbol “Om”. Lovely for a boat ride.' },
    { name: 'Maheshwar', time: '≈ 2–2½ h', text: 'A peaceful riverside fort and ghats on the Narmada, and the home of hand-woven Maheshwari saris — a wonderful place to buy one.' },
    { name: 'Mandu', time: '≈ 2½–3 h', text: 'Romantic hilltop ruins of palaces and pavilions, including the Jahaz Mahal (“Ship Palace”). Best as a full day trip.' },
  ];

  const TIPS = [
    { t: 'Weather & what to pack', b: '<p>February is one of the nicest times to be in India. In Indore expect warm, sunny days (roughly mid-20s °C) and cool evenings, sometimes down to around 10 °C. Delhi, Agra and Jaipur are cooler, especially early mornings; Goa and Mumbai are hot and humid.</p><ul><li>Light layers plus a warm jacket or shawl for evenings</li><li>Comfortable shoes for sightseeing — and for dancing at the Baraat!</li><li>Sunglasses, sunscreen and a hat</li><li>A universal travel adapter (India uses plug types C, D and M, 230 V)</li></ul>' },
    { t: 'Money', b: '<ul><li>The currency is the Indian Rupee (₹ / INR). ATMs are everywhere in cities; let your bank know you’re travelling.</li><li>Cards work in hotels, restaurants, malls and most shops; carry some cash for markets, tips, auto-rickshaws and street food.</li><li>Most locals pay by scanning QR codes (UPI). Visitors usually can’t use UPI with a foreign bank account, so cards and cash are your friends.</li><li>Bargaining is normal at markets and with auto-rickshaws — not in shops with fixed prices.</li></ul>' },
    { t: 'Phone & internet', b: '<ul><li>Easiest: buy a travel eSIM for India before you fly.</li><li>A local SIM (Airtel or Jio) is cheaper but needs your passport, visa and a photo; airport counters can set it up.</li><li>WhatsApp is how everyone in India communicates — including us and the wedding updates.</li></ul>' },
    { t: 'Getting around', b: '<ul><li>Uber and Ola work in all the cities in this guide (and Rapido for quick rides). Use the prepaid taxi or app counters at airports.</li><li>For the road trips, hire a car with a driver — self-driving in India is not recommended for first-time visitors. We can help arrange drivers.</li><li>For auto-rickshaws without a meter, agree the fare before you get in.</li></ul>' },
    { t: 'Health & food', b: '<ul><li>Drink only bottled or filtered water, and go easy on street food in your first couple of days.</li><li>Pack basic medicines (for upset stomachs especially), oral rehydration salts and hand sanitiser.</li><li>Get travel insurance, and check with a travel clinic or your doctor a few weeks before about recommended vaccinations.</li><li>Delhi’s air quality can be poor in winter — if you’re sensitive, bring a mask.</li></ul>' },
    { t: 'Culture & etiquette', b: '<ul><li>At temples, dress modestly (shoulders and knees covered), take off your shoes, and leather items may not be allowed inside Jain temples.</li><li>Ask before photographing people; some temples don’t allow photos inside.</li><li>Use your right hand to eat, pay and pass things.</li><li>Jain food is vegetarian — no meat, fish or eggs — and many traditional dishes also avoid onion, garlic and root vegetables.</li><li>Touts may tell you an attraction is “closed today” and offer an alternative — politely decline and check yourself.</li></ul>' },
    { t: 'What to wear to the wedding', b: '<p>Indian outfits are very welcome (and so much fun!), but never expected. Colourful and festive is the mood; dress codes for each event will be shared soon. Jaipur and Indore are great for shopping — if you want something tailored, allow a few days. Ask us and we’ll point you to the right places.</p>' },
    { t: 'Time zone', b: '<p>India is on IST (UTC +5:30), with no daylight saving. In February that’s 2½ hours behind Singapore and 4½ hours ahead of Central European Time.</p>' },
  ];

  const SOURCES = [
    ['Official Indian e-Visa portal', 'https://indianvisaonline.gov.in/'],
    ['e-Tourist Visa fee table (official, 8 Sep 2026)', 'https://indianvisaonline.gov.in/evisa/images/Etourist_fee_final.pdf'],
    ['High Commission of India, Singapore — e-Tourist Visa', 'https://www.hcisingapore.gov.in/eTourist'],
    ['e-Arrival Card mandatory from 1 Oct 2025 (Lufthansa Group)', 'https://business.lufthansagroup.com/de/en/program/experts/news/effective-1-october-2025--earrival-card-now-mandatory-for-entry-'],
  ];

  function render({ helpPhone, helpPhoneDisplay, contacts, waLink, lang, langToggle, art }) {
    const people = (contacts && contacts.length) ? contacts : [{ name: 'us', phone: helpPhone, display: helpPhoneDisplay }];
    const names = people.map(p => esc(p.name)).join(' or ');
    const waBtns = (msg, cls = '') => people.map(p => `<a class="btn ${cls}" href="${esc(waLink(p.phone, msg))}" target="_blank" rel="noopener">${art.icon.whatsapp} ${esc(p.name)}</a>`).join('');
    const hiNote = lang === 'hi' ? `<p class="callout" lang="hi">यह यात्रा गाइड भारत पहली बार आ रहे अंतरराष्ट्रीय मेहमानों के लिए है, इसलिए यह अंग्रेज़ी में है।</p>` : '';
    const wa = msg => waLink(helpPhone, msg);
    return `
    <header class="topbar paper scrolled"><button class="iconbtn" data-act="home" aria-label="Back to the invitation">${ic.back}</button>
      <span class="caps" style="font-size:10.5px">Travel guide</span>${langToggle()}</header>
    <main class="guide" lang="en">
    <section class="g-hero">${art.corner('tl')}${art.corner('tr', 1)}
      <p class="caps">For our friends from abroad</p>
      <h1 class="script">Your India Travel Guide</h1>
      <p class="lede">Coming to India for the first time? Here’s everything you need — the visa, getting to Indore, and our favourite trips to add before or after the wedding.</p>
      ${hiNote}
      <nav class="g-nav" aria-label="Guide sections">
        <a href="#g-visa" data-gjump>Visa & entry</a><a href="#g-arrive" data-gjump>Getting to Indore</a><a href="#g-trips" data-gjump>Trip ideas</a><a href="#g-near" data-gjump>Around Indore</a><a href="#g-tips" data-gjump>Good to know</a>
      </nav>
    </section>

    <section id="g-visa">
      <h2 class="script">Visa & entry</h2>
      <p class="caps sub">Start here — sort this out early</p>
      <p>Most international guests need a visa to visit India. The easiest option is the <b>e-Tourist Visa</b>, which you apply for online. It covers holidays and visiting friends and family — that includes coming to our wedding.</p>
      <div class="g-cards two">
        <div class="g-card"><p class="flag">🇸🇬 Singapore passport</p><p><b>Eligible for the e-Tourist Visa.</b></p>
          <p class="small">Our tip: the <b>1-year visa costs the same $25</b> as the 30-day one for Singaporeans, gives multiple entries and lets you apply earlier — an easy choice.</p></div>
        <div class="g-card"><p class="flag">🇪🇺 EU passports</p><p><b>Eligible for the e-Tourist Visa</b> (e.g. Germany, France, the Netherlands, Italy, Spain, Ireland, Austria, Belgium, Poland, Portugal and the Nordic countries).</p>
          <p class="small">The 30-day visa ($25 in February) is usually all you need. Other nationalities (e.g. UK, US, Canada, Australia) can use the same system — check your country on the official site.</p></div>
      </div>
      <div class="g-table" role="table" aria-label="e-Tourist Visa options">
        <div role="row" class="th"><span>Visa</span><span>Entries & stay</span><span>Fee*</span></div>
        <div role="row"><span><b>30 days</b></span><span>Two entries; valid 30 days from arrival</span><span>US$25</span></div>
        <div role="row"><span><b>1 year</b></span><span>Multiple entries; up to 90 days per visit</span><span>SG $25 · EU $40</span></div>
        <div role="row"><span><b>5 years</b></span><span>Multiple entries; up to 90 days per visit</span><span>US$200</span></div>
      </div>
      <p class="small muted">*Fees in US dollars for travel in February, from the official fee table dated 8 September 2026, plus a small card/bank charge. The 30-day visa is cheaper (US$10) only for April–June travel.</p>
      <h3>When to apply</h3>
      <div class="timeline">
        <div><b>Open now</b><span>1-year and 5-year visas can be applied for up to 120 days before arrival.</span></div>
        <div><b>From ~7 January 2027</b><span>30-day visas open up to 30 days before arrival (for a 6 February arrival).</span></div>
        <div><b>At least 4 days before you fly</b><span>The latest you can apply — but don’t leave it this late! Approval usually takes 2–3 days.</span></div>
        <div><b>Within 72 hours before landing</b><span>Fill in the free <b>e-Arrival Card</b> online or in the “Indian Visa Su-Swagatam” app — it’s mandatory for all foreign visitors.</span></div>
      </div>
      <h3>Your checklist</h3>
      <ul class="checks">
        ${['Passport valid for at least 6 months after you arrive, with 2 blank pages',
          'Apply only on the official site, <a href="https://indianvisaonline.gov.in/" target="_blank" rel="noopener">indianvisaonline.gov.in</a> — many look-alike agency sites charge much more',
          'A recent square photo with a plain light background (no glasses) and a scan of your passport photo page',
          'Print your e-Visa approval (ETA) and carry it with your passport',
          'Fly into a major airport — Delhi, Mumbai, Jaipur, Goa and Indore all accept e-Visa arrivals',
          'Complete the e-Arrival Card within 72 hours of landing and keep the QR code handy',
          'Travel insurance — strongly recommended',
          'OCI card holders don’t need a visa',
        ].map(x => `<li>${ic.check}<span>${x}</span></li>`).join('')}
      </ul>
      <p class="small muted">Rules change — always double-check on the official portal before applying. Checked ${CHECKED}.</p>
    </section>

    <section id="g-arrive">
      <h2 class="script">Getting to Indore</h2>
      <p class="caps sub">Devi Ahilya Bai Holkar Airport · IDR</p>
      <p>Indore is in the heart of India, and it's well connected by direct domestic flights. Most international guests fly into <b>Delhi (DEL)</b> or <b>Mumbai (BOM)</b> and take a short direct flight to Indore — about 1½ hours from either.</p>
      <div class="g-cards two">
        <div class="g-card"><p class="flag">From Singapore</p><p class="small">No direct flights to Indore yet — connect through Mumbai, Delhi or Hyderabad on a single booking.</p></div>
        <div class="g-card"><p class="flag">From Europe</p><p class="small">Fly to Delhi or Mumbai, then connect to Indore. Leave at least 3 hours if your flights are on separate tickets.</p></div>
      </div>
      <p class="small">Direct flights also connect Indore with Jaipur, Goa, Bengaluru, Hyderabad, Ahmedabad, Pune, Chennai and Kolkata. The airport is about 20–30 minutes by car from the city. Let us know your flight times in your RSVP — we’ll help with airport pick-ups.</p>
    </section>

    <section id="g-trips">
      <h2 class="script">Explore before the wedding</h2>
      <p class="caps sub">Pre-wedding travel recommendations</p>
      <p>If you want to land a few days early and explore India before reaching Indore, here are my top curated options!</p>
      <div class="protip">${ic.bulb}<p><b>Pro-tip:</b> I strongly recommend travelling in small groups rather than solo — India can feel a bit overwhelming at first, and doing it together is much more fun!</p></div>
      ${TRIPS.map(g => `<h3 class="from">${ic.pin}${esc(g.from)}</h3>
        ${g.options.map(o => `<article class="trip">
          <div class="trip-head"><span class="tag">${esc(o.tag)}</span><span class="days">${esc(o.days)}</span></div>
          <h4>${esc(o.title)}</h4><p class="trip-sub">${esc(o.sub)}</p>
          ${route(o.stops)}
          ${o.body.map(([h, t]) => `<p><b>${esc(h)}:</b> ${t}</p>`).join('')}
        </article>`).join('')}`).join('')}
      <h3 class="from">${ic.pin}Landing anywhere else?</h3>
      <article class="trip"><p>Reach out to ${names} directly! We’ll happily help you draft a customised mini-itinerary. Bengaluru, Hyderabad, Chennai, Kolkata and Ahmedabad all have direct flights to Indore too.</p>
        <p class="small muted" style="margin:0 0 8px">Message us on WhatsApp to plan your trip:</p>
        <div class="helpbtns">${waBtns('Hi! I’d love help planning my India trip around the wedding.')}</div></article>
      <div class="protip after">${ic.swap}<p><b>Travelling after the wedding?</b> You can follow these exact same routes in reverse! International flights out of India mostly leave from Delhi or Mumbai.</p></div>
    </section>

    <section id="g-near">
      <h2 class="script">Around Indore</h2>
      <p class="caps sub">For the days around the celebrations</p>
      <p>Indore is a friendly, food-obsessed city — and there’s plenty to see within a few hours’ drive.</p>
      <div class="near">${NEAR.map(n => `<div class="near-item"><div><b>${esc(n.name)}</b><span class="tag">${ic.car}${esc(n.time)}</span></div><p>${esc(n.text)}</p></div>`).join('')}</div>
    </section>

    <section id="g-tips">
      <h2 class="script">Good to know</h2>
      <p class="caps sub">Practical tips for first-timers</p>
      <div class="acc">${TIPS.map((x, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(x.t)}</summary><div>${x.b}</div></details>`).join('')}</div>
    </section>

    <section class="g-help">
      <h2 class="script" style="font-size:40px">Any questions?</h2>
      <p>Visas, flights, drivers or what to wear — message ${names} directly, we’re happy to help.</p>
      <div class="contacts">${people.map(p => `<div class="contact"><b>${esc(p.name)}</b><span>${esc(p.display || p.phone)}</span>
        <div class="helpbtns"><a class="btn" href="${esc(waLink(p.phone, 'Hi! I have a travel question about the wedding.'))}" target="_blank" rel="noopener">${art.icon.whatsapp} WhatsApp</a>
        <a class="btn ghost" href="tel:${esc(p.phone)}">${art.icon.phone} Call</a></div></div>`).join('')}</div>
      <p class="small muted" style="margin-top:14px">For anything about the wedding itself, the wedding help line is ${esc(helpPhoneDisplay)}.</p>
      <button class="btn coral" style="margin-top:26px" data-act="home">${ic.back} Back to the invitation</button>
      <details class="sources"><summary>Sources (checked ${CHECKED})</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul></details>
    </section>
    </main>`;
  }
  return { render };
})();
