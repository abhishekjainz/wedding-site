// Builds the deployable site (public/) and the single-file offline preview (dist/preview.html).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const R = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const W = (p, s) => writeFileSync(new URL('../' + p, import.meta.url), s);
const strip = s => s.split('\n').filter(l => !l.includes('@@strip-for-browser')).join('\n');

const rulesBrowser = `const Rules = (() => {\n${strip(R('src/rules.js'))}\nreturn Rules;\n})();`;
const backend = `const { Rules, createService, hashPassword, createMemoryStore } = (() => {\n${strip(R('src/rules.js'))}\n${strip(R('src/defaults.js'))}\n${strip(R('src/service.js'))}\n${strip(R('src/memory-store.js'))}\nreturn { Rules, createService, hashPassword, createMemoryStore };\n})();`;
const web = n => R('src/web/' + n);

const FONTS = 'https://fonts.googleapis.com/css2?family=MonteCarlo&family=Roboto+Serif:ital,opsz,wdth,wght@0,8..144,50..150,300..600;1,8..144,50..150,300..500&family=Tiro+Devanagari+Hindi:ital@0;1&display=swap';
const head = (title, css, extra = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#fbf6ef"><meta name="color-scheme" content="light">
<title>${title}</title>
<meta property="og:title" content="Dreamy & Abhishek · 12–14 February 2027">
<meta property="og:description" content="You’re invited — a private wedding invitation.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
${extra}<style>${css}</style></head>`;

// ---- production site ----
mkdirSync(new URL('../public/assets', import.meta.url), { recursive: true });
const ASSET_FILES = ['mono.webp', 'seal.webp', 'paper.jpg', 'agency.webp', 'venue-photo.jpg', 'ev-home-days.jpg', 'ev-mehendi.jpg', 'ev-reception.jpg', 'ev-phere.jpg'];
for (const f of ASSET_FILES) copyFileSync(new URL('../assets/' + f, import.meta.url), new URL('../public/assets/' + f, import.meta.url));
W('public/app.js', [web('art.js'), web('i18n.js'), rulesBrowser, web('api.js'), web('guide.js'), web('guest.js'), 'GuestApp.boot();'].join('\n;\n'));
W('public/admin.js', [web('art.js'), web('i18n.js'), rulesBrowser, web('api.js'), web('admin.js'), 'AdminApp.boot();'].join('\n;\n'));
W('public/index.html', `${head('Dreamy & Abhishek', web('styles.css'), '<link rel="icon" href="/assets/mono.webp">')}
<body class="paper"><div id="app" class="app paper" aria-live="polite"></div><noscript><p style="padding:40px;text-align:center">Please enable JavaScript to view this invitation.</p></noscript><script src="/app.js" defer></script></body></html>`);
W('public/admin.html', `${head('RSVP dashboard · Dreamy & Abhishek', web('styles.css') + web('admin.css'), '<link rel="icon" href="/assets/mono.webp">')}
<body class="paper"><div id="app"></div><script src="/admin.js" defer></script></body></html>`);
W('public/_headers', `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/admin*
  Cache-Control: no-store
`);
W('public/robots.txt', 'User-agent: *\nDisallow: /\n');

// ---- single-file preview ----
// Works when opened directly or inside a sandboxed viewer: navigation never depends on
// the address bar, and a fallback supplies the crypto functions sandboxes switch off.
const router = `(function () {
  var mode = null;
  function show(admin) {
    if (mode && admin === (mode === 'admin')) return;
    mode = admin ? 'admin' : 'guest';
    document.querySelectorAll('.sheet,.intro,.modal').forEach(function (n) { n.remove(); });
    document.body.style.overflow = '';
    var app = document.getElementById('app');
    app.className = admin ? '' : 'app paper';
    try { scrollTo(0, 0); } catch (e) {}
    admin ? AdminApp.boot() : GuestApp.boot();
  }
  window.PREVIEW.go = function (where) {
    show(where === 'admin');
    try { history.replaceState(null, '', where === 'admin' ? '#admin' : location.pathname + location.search); } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-go]');
    if (b) { e.preventDefault(); window.PREVIEW.go(b.dataset.go); }
  });
  addEventListener('hashchange', function () { if (location.hash === '#admin') show(true); });
  var start = false; try { start = location.hash === '#admin'; } catch (e) {}
  show(start);
})();`;
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
const MIME = { webp: 'image/webp', jpg: 'image/jpeg' };
// header-photo.jpg is the couple's photo: preview only (on the live site it's uploaded via the dashboard and served only to invited guests)
import { existsSync } from 'node:fs';
const PREVIEW_ONLY = ['header-photo.jpg', 'story-1.jpg', 'story-2.jpg', 'story-3.jpg', 'story-4.jpg'].filter(f => existsSync(new URL('../assets/' + f, import.meta.url))); // optional
const assets = Object.fromEntries([...ASSET_FILES, ...PREVIEW_ONLY].map(f => [f, `data:${MIME[f.split('.').pop()]};base64,` + readFileSync(new URL('../assets/' + f, import.meta.url)).toString('base64')]));
W('dist/preview.html', `${head('Preview · Dreamy & Abhishek', web('styles.css') + web('admin.css'))}
<body class="paper"><div id="app" class="app paper" aria-live="polite"></div>
<style>:root { --tex: url(${assets['paper.jpg']}); }</style>
<script>window.ASSETS = ${JSON.stringify(assets)};</script>
<script>
${web('crypto-shim.js')}
${backend}
${web('art.js')}
${web('i18n.js')}
${web('api-preview.js')}
${web('guide.js')}
${web('guest.js')}
${web('admin.js')}
${router}
</script></body></html>`);
console.log('built public/ and dist/preview.html');
