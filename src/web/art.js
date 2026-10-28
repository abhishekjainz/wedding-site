// Hand-drawn style SVG ornaments: watercolor florals, Rajwada illustration, seal, icons.
const Art = (() => {
  // Shared watercolor filter — soft, bleeding edges.
  const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="wc" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="0.6"/>
    </filter>
    <radialGradient id="rose-coral" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#f6c6b6"/><stop offset=".6" stop-color="#e99a88"/><stop offset="1" stop-color="#d9776a"/></radialGradient>
    <radialGradient id="rose-blush" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#fde5dc"/><stop offset=".65" stop-color="#f3bfb0"/><stop offset="1" stop-color="#e8a596"/></radialGradient>
    <radialGradient id="rose-peach" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#fde9d6"/><stop offset=".65" stop-color="#f6cba6"/><stop offset="1" stop-color="#eaa982"/></radialGradient>
    <radialGradient id="seal" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#f1d3a6"/><stop offset=".5" stop-color="#d4a46a"/><stop offset="1" stop-color="#a8773f"/></radialGradient>
  </defs></svg>`;

  function rose(x, y, r, tone = 'coral', rot = 0) {
    const g = `url(#rose-${tone})`;
    const petals = [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="${-r * 0.45}" rx="${r * 0.62}" ry="${r * 0.5}" transform="rotate(${a})" fill="${g}" opacity=".78"/>`).join('');
    const inner = [30, 150, 270].map(a => `<ellipse cx="0" cy="${-r * 0.22}" rx="${r * 0.36}" ry="${r * 0.3}" transform="rotate(${a})" fill="${g}" opacity=".85"/>`).join('');
    const curl = `<path d="M${-r * .25} ${-r * .05} q${r * .25} ${-r * .3} ${r * .5} 0 q${-r * .1} ${r * .22} ${-r * .3} ${r * .12}" fill="none" stroke="#c9675c" stroke-width="${Math.max(.8, r * .07)}" opacity=".55"/>`;
    return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#wc)">${petals}${inner}${curl}</g>`;
  }
  function leaf(x, y, len, rot, tone = '#8fae8d') {
    return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#wc)"><path d="M0 0 C ${len * .25} ${-len * .3}, ${len * .75} ${-len * .3}, ${len} 0 C ${len * .75} ${len * .3}, ${len * .25} ${len * .3}, 0 0Z" fill="${tone}" opacity=".62"/><path d="M${len * .05} 0 L${len * .9} 0" stroke="#6f9073" stroke-width=".8" opacity=".5"/></g>`;
  }
  function bud(x, y, s, rot) {
    return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#wc)"><ellipse cx="0" cy="0" rx="${s * .5}" ry="${s * .75}" fill="url(#rose-blush)" opacity=".85"/><path d="M${-s * .5} ${s * .3} Q0 ${s * 1.1} ${s * .5} ${s * .3}" fill="#9db897" opacity=".7"/></g>`;
  }

  // Light floral spray for a corner. Kept airy: few blooms, lots of space.
  function corner(cls = '', variant = 0) {
    const v = [
      () => `<path d="M8 6 C 40 40, 70 60, 120 70" stroke="#94ad8e" stroke-width="1.4" fill="none" opacity=".7"/>
        <path d="M30 26 C 30 60, 40 90, 38 130" stroke="#94ad8e" stroke-width="1.2" fill="none" opacity=".6"/>
        ${leaf(44, 34, 24, -20)}${leaf(70, 56, 22, 30, '#a3bf9f')}${leaf(98, 66, 20, -10)}${leaf(32, 74, 22, 100)}${leaf(36, 104, 18, 70, '#a3bf9f')}
        ${rose(26, 24, 15, 'coral', 10)}${rose(60, 46, 10, 'blush', -20)}${rose(118, 70, 8, 'peach', 0)}${bud(38, 128, 7, 10)}${bud(84, 58, 6, -40)}
        <circle cx="96" cy="40" r="2" fill="#e8a596" opacity=".6"/><circle cx="54" cy="96" r="1.6" fill="#f0c39e" opacity=".7"/>`,
      () => `<path d="M6 10 C 50 20, 90 30, 140 26" stroke="#94ad8e" stroke-width="1.2" fill="none" opacity=".6"/>
        ${leaf(40, 18, 20, 10)}${leaf(70, 24, 22, -30, '#a3bf9f')}${leaf(104, 28, 18, 20)}${leaf(18, 30, 20, 80)}
        ${rose(20, 16, 12, 'peach', 0)}${rose(52, 22, 8, 'coral', 30)}${bud(138, 26, 6, 80)}${bud(90, 16, 5, -60)}`,
    ][variant % 2];
    return `<svg class="corner ${cls}" viewBox="0 0 150 150" aria-hidden="true">${v()}</svg>`;
  }

  // Stylised watercolour line illustration of Rajwada, Indore (Holkar palace):
  // stone lower storeys with the great arched gateway, timber upper storeys with
  // rows of arched jharokha windows, corner turrets. Replaceable by a licensed photo.
  function rajwada(cls = '') {
    const stroke = '#b98a6c', wash = '#f3dcc6', wash2 = '#ecc9ad';
    let s = '';
    const row = (x0, x1, y, h, n) => { const w = (x1 - x0) / n; for (let i = 0; i < n; i++) { const cx = x0 + w * i + w / 2; s += `<path d="M${cx - w * .28} ${y + h} v${-h * .55} a${w * .28} ${w * .28} 0 0 1 ${w * .56} 0 v${h * .55}" fill="#e7bfa3" fill-opacity=".55" stroke="${stroke}" stroke-width=".6"/>`; } };
    // wings and central block
    s += `<rect x="40" y="92" width="110" height="108" fill="${wash}" stroke="${stroke}" stroke-width=".8"/>`;
    s += `<rect x="250" y="92" width="110" height="108" fill="${wash}" stroke="${stroke}" stroke-width=".8"/>`;
    s += `<rect x="150" y="40" width="100" height="160" fill="${wash2}" stroke="${stroke}" stroke-width=".9"/>`;
    // storey lines
    [114, 136, 158, 180].forEach(y => { s += `<path d="M40 ${y}H150M250 ${y}H360" stroke="${stroke}" stroke-width=".5" opacity=".7"/>`; });
    [62, 84, 106, 128].forEach(y => { s += `<path d="M150 ${y}H250" stroke="${stroke}" stroke-width=".6" opacity=".8"/>`; });
    // windows
    [92, 114, 136].forEach(y => { row(42, 148, y, 22, 7); row(252, 358, y, 22, 7); });
    [40, 62, 84, 106].forEach(y => { row(152, 248, y, 22, 6); });
    // balconies (projecting ledges)
    [62, 84, 106].forEach(y => { s += `<rect x="146" y="${y - 2}" width="108" height="3" fill="#dcb293" opacity=".8"/>`; });
    // great gate
    s += `<path d="M172 200 V160 Q172 132 200 128 Q228 132 228 160 V200Z" fill="#cf9f80" fill-opacity=".55" stroke="${stroke}" stroke-width="1"/>`;
    s += `<path d="M180 200 V162 Q180 142 200 139 Q220 142 220 162 V200" fill="none" stroke="${stroke}" stroke-width=".6"/>`;
    s += `<path d="M200 140V200" stroke="${stroke}" stroke-width=".5"/>`;
    // stone base courses either side of gate
    s += `<rect x="150" y="160" width="22" height="40" fill="#e5c3a6" stroke="${stroke}" stroke-width=".5"/><rect x="228" y="160" width="22" height="40" fill="#e5c3a6" stroke="${stroke}" stroke-width=".5"/>`;
    // roof parapet + small chhatris
    s += `<path d="M150 40 h100" stroke="${stroke}" stroke-width="1.2"/><path d="M40 92 h110 M250 92 h110" stroke="${stroke}" stroke-width="1"/>`;
    [[156, 40], [244, 40], [46, 92], [144, 92], [256, 92], [354, 92], [200, 40]].forEach(([x, y], i) => {
      const r = i === 6 ? 9 : 6;
      s += `<path d="M${x - r} ${y} v${-r * .8} h${r * 2} v${r * .8}" fill="${wash}" stroke="${stroke}" stroke-width=".6"/><path d="M${x - r * 1.1} ${y - r * .8} Q${x} ${y - r * 2.6} ${x + r * 1.1} ${y - r * .8}Z" fill="#e2b896" stroke="${stroke}" stroke-width=".6"/><path d="M${x} ${y - r * 2.1} v-3" stroke="${stroke}" stroke-width=".6"/>`;
    });
    // trees and ground wash
    const tree = (x, sc) => `<g filter="url(#wc)" opacity=".7"><circle cx="${x}" cy="${178 - 20 * sc}" r="${16 * sc}" fill="#a9c2a2"/><circle cx="${x + 12 * sc}" cy="${186 - 14 * sc}" r="${12 * sc}" fill="#94b38f"/><circle cx="${x - 12 * sc}" cy="${188 - 12 * sc}" r="${11 * sc}" fill="#b7cdb0"/><path d="M${x} 200 v${-22 * sc}" stroke="#8a7a62" stroke-width="1.5"/></g>`;
    return `<svg class="rajwada ${cls}" viewBox="0 0 400 214" role="img" aria-label="Illustration of Rajwada, Indore">
      <ellipse cx="200" cy="204" rx="210" ry="12" fill="#efe1cf" opacity=".8" filter="url(#wc)"/>
      <g filter="url(#wc)">${s}</g>${tree(18, 1.1)}${tree(384, 1)}${tree(370, .7)}
      <path d="M0 203 H400" stroke="${stroke}" stroke-width=".6" opacity=".6"/></svg>`;
  }

  function seal(cls = '') {
    return `<svg class="seal ${cls}" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M60 6 C76 4 88 14 98 22 C110 32 116 46 114 62 C113 78 106 92 92 102 C80 112 64 116 50 112 C34 109 20 100 12 86 C4 72 4 56 10 42 C16 28 26 18 40 11 C46 8 53 7 60 6Z" fill="url(#seal)"/>
      <circle cx="60" cy="60" r="38" fill="none" stroke="#a8773f" stroke-width="2" opacity=".55"/>
      <circle cx="60" cy="60" r="33" fill="none" stroke="#f3dbb4" stroke-width="1" opacity=".6"/>
      <text x="60" y="70" text-anchor="middle" font-family="'Pinyon Script', cursive" font-size="32" fill="#8a5e2f" opacity=".9">D&amp;A</text>
      <path d="M30 36 Q40 24 56 22" stroke="#fbeacb" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/></svg>`;
  }

  function divider() {
    return `<svg class="divider" viewBox="0 0 120 12" aria-hidden="true"><path d="M2 6H48M72 6H118" stroke="currentColor" stroke-width=".8"/><path d="M60 1 L65 6 L60 11 L55 6Z" fill="none" stroke="currentColor" stroke-width=".9"/><circle cx="51" cy="6" r="1.2" fill="currentColor"/><circle cx="69" cy="6" r="1.2" fill="currentColor"/></svg>`;
  }

  // Arched jharokha frame, used faintly behind the families section.
  function arch(cls = '') {
    return `<svg class="arch ${cls}" viewBox="0 0 300 160" aria-hidden="true" fill="none" stroke="#d9bca3" stroke-width="1">
      <path d="M40 160 V90 Q40 60 70 52 Q100 20 150 14 Q200 20 230 52 Q260 60 260 90 V160"/>
      <path d="M58 160 V96 Q58 72 82 66 Q110 38 150 32 Q190 38 218 66 Q242 72 242 96 V160"/>
      <path d="M10 160 V110 Q10 96 24 92 Q28 82 40 80 M290 160 V110 Q290 96 276 92 Q272 82 260 80"/>
      <path d="M150 14 v-8" /><circle cx="150" cy="4" r="3"/></svg>`;
  }

  const icon = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    dress: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="M9 3l-1 4 2 2-5 12h14L14 9l2-2-1-4M9 3c1 1.5 5 1.5 6 0"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 12h15m-5-5 5 5-5 5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M20 12H5m5-5-5 5 5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M6 6l12 12M18 6 6 18"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="M4 7h16M4 12h16M4 17h16"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    sprig: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 30V10" stroke="#6f9073" stroke-width="1.2"/><path d="M16 12c-6-1-9-5-9-9 5 0 9 4 9 9Zm0 6c6-1 9-5 9-9-5 0-9 4-9 9Zm0 6c-5-1-8-4-8-8 4 0 8 3 8 8Z" fill="#8fae8d" opacity=".8"/></svg>',
    flower: '<svg viewBox="0 0 32 32" aria-hidden="true"><g transform="translate(16 15)">' + [0, 72, 144, 216, 288].map(a => `<ellipse cy="-6" rx="5" ry="6.5" transform="rotate(${a})" fill="#eea494" opacity=".75"/>`).join('') + '<circle r="3" fill="#f6d0a8"/></g><path d="M16 22v8" stroke="#8fae8d" stroke-width="1.2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/></svg>',
    photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m4 17 5-4 4 3 3-2 4 3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  };
  return { defs, corner, rose, rajwada, seal, divider, arch, icon };
})();
