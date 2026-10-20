// Shared by every dashboard page. Writes go through /api/admin/* (signed-in session; validated on the server).
export async function api(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) {
  const r = await fetch('/api/admin/' + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); throw new Error('signed out'); }
  if (!r.ok) { alert(j.error || 'That didn’t save. Try again.'); throw new Error(j.error); }
  return j;
}
(window as any).api = api;

// <button data-action="patch|delete|convert" data-table data-id data-field data-value data-cycle data-current>
document.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!b) return;
  const { action, table, id, field, value, cycle, current } = b.dataset as Record<string, string>;
  b.setAttribute('aria-busy', 'true');
  try {
    const done = () => (b.dataset.redirect ? location.assign(b.dataset.redirect) : location.reload());
    if (action === 'patch') { let v: any = value; if (cycle) { const o = cycle.split('|'); v = o[(o.indexOf(current) + 1) % o.length]; } if (/^-?\d+(\.\d+)?$/.test(String(v))) v = Number(v); await api(table, 'PATCH', { id, [field]: v }); done(); }
    if (action === 'delete' && confirm(b.dataset.confirm || 'Remove this?')) { await api(table, 'DELETE', { id }); done(); }
    if (action === 'convert') { await api('convert', 'POST', { id }); location.reload(); }
  } catch {} finally { b.removeAttribute('aria-busy'); }
});

// <form data-save="table" data-method="POST|PATCH">: flat forms → one row.
document.querySelectorAll<HTMLFormElement>('form[data-save]').forEach((f) => f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body: Record<string, unknown> = {};
  new FormData(f).forEach((v, k) => { body[k] = typeof v === 'string' ? v : ''; });
  f.querySelectorAll<HTMLInputElement>('input[type=checkbox][name]').forEach((c) => (body[c.name] = c.checked));
  f.querySelectorAll<HTMLInputElement>('input[type=number][name]').forEach((c) => (body[c.name] = c.value === '' ? null : Number(c.value)));
  const st = f.querySelector('[role=status]'); if (st) st.textContent = 'Saving…';
  try { await api(f.dataset.save!, (f.dataset.method as any) || 'PATCH', body); if (st) st.textContent = 'Saved.'; if (f.dataset.reload !== undefined) location.reload(); }
  catch { if (st) st.textContent = ''; }
}));
