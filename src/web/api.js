// HTTP transport for the deployed site. Session cookies are HttpOnly and set by the server.
window.API = {
  async call(method, path, body) {
    const res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, body: data };
  },
  async download(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('download failed');
    const cd = res.headers.get('Content-Disposition') || '';
    const name = (cd.match(/filename="([^"]+)"/) || [])[1] || 'export';
    return { blob: await res.blob(), filename: name };
  },
  async upload(file) {
    const res = await fetch('/api/admin/media', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  },
};
