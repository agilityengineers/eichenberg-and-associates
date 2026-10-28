// Homepage hero headline. Words wrapped in *asterisks* render in teal (<em>); everything else is plain text, HTML-escaped.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const accent = (s: unknown) => esc(String(s ?? '')).replace(/\*([^*]+)\*/g, '<em>$1</em>');

/** The two headline lines. A hero setting saved before the two-line fields existed still carries the old
 *  teal-word/rest pairs (bootstrap converts them on the next boot); compose those so the page keeps rendering meanwhile. */
export function headlineLines(hero: any): [string, string] {
  const compose = (teal?: string, rest?: string) => [teal ? `*${teal}*` : '', rest || ''].filter(Boolean).join(' ').trim();
  const l1 = hero?.headlineLine1 ?? compose(hero?.headlineAccent1, hero?.headlineRest1);
  const l2 = hero?.headlineLine2 ?? compose(hero?.headlineAccent2, hero?.headlineRest2);
  return [String(l1 || ''), String(l2 || '')];
}
