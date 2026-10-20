// Client side of the schema-driven editor (src/components/cms): repeatable rows, uploads, and saving as JSON.
const read = (f: HTMLElement): any => {
  const k = f.dataset.kind;
  if (k === 'object') { const o: Record<string, any> = {}; f.querySelectorAll<HTMLElement>(':scope > .cms-body > .cms-f').forEach((c) => { if (c.dataset.key) o[c.dataset.key] = read(c); }); return o; }
  if (k === 'list') return [...f.querySelectorAll<HTMLElement>(':scope > .cms-items > .cms-item')].map((li) => {
    const v = read(li.querySelector<HTMLElement>(':scope > .cms-f')!); return li.dataset.type ? { type: li.dataset.type, ...v } : v; })
    .filter((v) => !(f.dataset.scalar && typeof v === 'string' && !v.trim()));
  const el = f.querySelector<HTMLInputElement>('.cms-v'); if (!el) return null;
  if (k === 'boolean') return el.checked;
  if (k === 'number') return el.value === '' ? null : Number(el.value);
  return el.value;
};
export const readForm = (form: HTMLElement) => read(form.querySelector<HTMLElement>('[data-root]')!);

let seq = 0;
const freshIds = (root: HTMLElement) => root.querySelectorAll<HTMLElement>('[id]').forEach((el) => {
  const id = `n${Date.now().toString(36)}${seq++}`; root.querySelector(`label[for="${el.id}"]`)?.setAttribute('for', id); el.id = id; });

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const list = t.closest<HTMLElement>('.cms-list'); if (!list || !t.closest('[data-add],[data-move],[data-remove]')) return;
  const items = list.querySelector<HTMLElement>(':scope > .cms-items')!;
  if (t.closest('[data-add]')) {
    const type = list.querySelector<HTMLSelectElement>(':scope > .cms-add [data-add-type]')?.value;
    const tpl = list.querySelector<HTMLTemplateElement>(type ? `:scope > template[data-type="${type}"]` : ':scope > template');
    if (!tpl) return; const li = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement; freshIds(li); items.appendChild(li);
    li.querySelector<HTMLElement>('input:not([type=checkbox]),textarea,select')?.focus(); dirty(list); return;
  }
  const li = t.closest<HTMLElement>('.cms-item'); if (!li || li.parentElement !== items) return;
  if (t.closest('[data-remove]')) { if (li.textContent?.trim() && [...li.querySelectorAll<HTMLInputElement>('.cms-v')].some((x) => x.value) && !confirm('Remove this row?')) return; li.remove(); }
  else { const dir = Number(t.closest<HTMLElement>('[data-move]')!.dataset.move); const sib = dir < 0 ? li.previousElementSibling : li.nextElementSibling; if (sib) dir < 0 ? sib.before(li) : sib.after(li); t.closest<HTMLElement>('button')?.focus(); }
  dirty(list);
});

// Uploads go to /api/admin/media and come back as a /media/… URL.
document.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement; if (!input.matches('[data-upload]') || !input.files?.[0]) return;
  const box = input.closest<HTMLElement>('.cms-up')!, v = box.querySelector<HTMLInputElement>('.cms-v')!, prev = box.querySelector<HTMLImageElement>('.cms-prev');
  const fd = new FormData(); fd.set('file', input.files[0]); const label = input.parentElement!; const was = label.firstChild!.textContent; label.firstChild!.textContent = 'Uploading…';
  try { const r = await fetch('/api/admin/media', { method: 'POST', body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed');
    v.value = j.url; if (prev) { prev.src = j.url; prev.hidden = false; } dirty(box); }
  catch (err: any) { alert(err.message); } finally { label.firstChild!.textContent = was; input.value = ''; }
});
document.addEventListener('input', (e) => { const t = e.target as HTMLElement; if (t.closest('[data-cms-form]')) dirty(t); if (t.matches('.cms-up .cms-v')) { const p = t.parentElement!.querySelector<HTMLImageElement>('.cms-prev'); if (p) { p.src = (t as HTMLInputElement).value; p.hidden = !(t as HTMLInputElement).value; } } });

const dirty = (el: Element) => { const f = el.closest<HTMLFormElement>('[data-cms-form]'); if (f) { f.dataset.dirty = '1'; const st = f.querySelector('.cms-st'); if (st) st.textContent = 'Unsaved changes'; } };
addEventListener('beforeunload', (e) => { if (document.querySelector('[data-cms-form][data-dirty]')) e.preventDefault(); });

document.querySelectorAll<HTMLFormElement>('[data-cms-form]').forEach((form) => form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = form.querySelector('.cms-st')!, btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const payload: Record<string, any> = { ...JSON.parse(form.dataset.extra || '{}'), data: readForm(form) };
  const body = form.querySelector<HTMLTextAreaElement>('[data-body]'); if (body) payload.body = body.value;
  const slug = form.querySelector<HTMLInputElement>('[data-slug-input]'); if (slug) payload.newSlug = slug.value.trim();
  st.textContent = 'Saving…'; btn.disabled = true;
  try {
    const r = await fetch(form.dataset.endpoint!, { method: form.dataset.method || 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not save.');
    delete form.dataset.dirty; st.textContent = 'Saved. Live on the site now.';
    if (j.redirect) location.href = j.redirect;
  } catch (err: any) { st.textContent = err.message; } finally { btn.disabled = false; }
}));
