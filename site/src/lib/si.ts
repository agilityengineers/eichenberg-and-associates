// "Systems Integrator (SI)" convention: the copy stays as written in the CMS; every "SI" token is rendered as
// <abbr title="Systems Integrator">SI</abbr> (dotted underline), as in the design reference.
import { escapeHtml } from './sanitize';
const ABBR = '<abbr title="Systems Integrator">SI</abbr>';
/** Plain text → HTML with SI wrapped. Use with set:html. */
export const si = (s: string | undefined | null) => escapeHtml(String(s ?? '')).replace(/\bSI\b/g, ABBR);
/** For Markdown/HTML sources that are rendered afterwards (no escaping). */
export const siRaw = (s: string) => s.replace(/\bSI\b/g, ABBR);
/** Persona landing pages: as in their design reference, the spelled-out "Systems Integrator (SI)" stays plain;
 *  a bare "SI" elsewhere is still wrapped. */
export const siPlainFirst = (s: string | undefined | null) => escapeHtml(String(s ?? '')).replace(/(?<!Systems Integrator \()\bSI\b/g, ABBR);
