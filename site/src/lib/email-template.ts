// Visitor acknowledgement emails: wording lives in Website content → Site-wide → Acknowledgement emails (settings/emails).
// Templates use {token} placeholders. Template text and every inserted value are HTML-escaped; only the link tokens passed in `links` insert markup,
// and their href and text are escaped too. Unknown tokens are left as typed.
import { escapeHtml } from './sanitize';

type Vars = Record<string, string>;
type Links = Record<string, { href: string; text: string }>;

// Template text sits between tags, so &, < and > are all that need escaping (apostrophes stay as typed).
const escapeText = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** Plain-text fill (subject lines). */
export const fillText = (tpl: string, vars: Vars) =>
  String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/** One HTML paragraph, or '' when the template is empty (so a line can be switched off by clearing it). */
export function paragraph(tpl: string, vars: Vars, links: Links = {}): string {
  if (!String(tpl || '').trim()) return '';
  const html = escapeText(String(tpl)).replace(/\{(\w+)\}/g, (m, k) => {
    if (k in links) return `<a href="${escapeHtml(links[k].href)}">${escapeHtml(links[k].text)}</a>`;
    return k in vars ? escapeHtml(vars[k]) : m;
  });
  return `<p>${html.replace(/\r?\n/g, '<br>')}</p>`;
}
