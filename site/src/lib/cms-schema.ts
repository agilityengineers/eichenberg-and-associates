// Field definitions for everything editable at Dashboard → Website content (and reused by Settings and Landing pages).
// Each field maps to one key in the stored JSON. Lists are repeatable rows; `types` lists are page-builder blocks.
import { z } from 'zod';

export type Widget = 'string' | 'text' | 'markdown' | 'number' | 'boolean' | 'image' | 'file' | 'select' | 'date' | 'object' | 'list';
export type Field = {
  name: string; label: string; widget: Widget; hint?: string; optional?: boolean;
  options?: { value: string; label: string }[];          // select
  min?: number; max?: number; step?: number;              // number
  fields?: Field[];                                        // object, or list of objects
  of?: Field;                                              // list of single values
  types?: { name: string; label: string; fields: Field[] }[];  // list of typed blocks
  fixed?: boolean;                                         // list rows can be edited but not added, removed or reordered
  singular?: string; readonly?: boolean;
};
export type DocType = {
  collection: string; slug?: string; label: string; group: string; description?: string; fields: Field[];
  body?: { label: string; optional?: boolean }; entry?: { singular: string; titleKey: string; slugEditable?: boolean; urlPrefix?: string };
};

type X = Partial<Field>;
const str = (name: string, label: string, x: X = {}): Field => ({ name, label, widget: 'string', ...x });
const text = (name: string, label: string, x: X = {}): Field => ({ name, label, widget: 'text', ...x });
const num = (name: string, label: string, x: X = {}): Field => ({ name, label, widget: 'number', ...x });
const bool = (name: string, label: string, x: X = {}): Field => ({ name, label, widget: 'boolean', ...x });
const img = (name: string, label: string, x: X = {}): Field => ({ name, label, widget: 'image', optional: true, ...x });
const obj = (name: string, label: string, fields: Field[], x: X = {}): Field => ({ name, label, widget: 'object', fields, ...x });
const rows = (name: string, label: string, fields: Field[], x: X = {}): Field => ({ name, label, widget: 'list', fields, ...x });
const items = (name: string, label: string, of: Field, x: X = {}): Field => ({ name, label, widget: 'list', of, ...x });
const link = [str('label', 'Label'), str('href', 'Link (path or URL)')];
const meta = [str('title', 'Browser title'), text('description', 'Search description')];

export const DOCS: DocType[] = [
  // ---------- Site-wide ----------
  { collection: 'settings', slug: 'site', group: 'Site-wide', label: 'Firm details, menu & footer', fields: [
    str('name', 'Firm name'), str('tagline', 'Tagline'), text('description', 'Default search description'),
    str('email', 'Email'), str('phone', 'Phone (as shown)'), str('phoneHref', 'Phone (digits for the tel: link)'), str('linkedin', 'LinkedIn URL'),
    str('responseWindow', 'Reply window (e.g. two business days)'), str('certification', 'Certification line'),
    str('ctaLabel', 'Header button label'), str('ctaHref', 'Header button link'),
    rows('nav', 'Menu', link, { singular: 'menu item' }),
    obj('footer', 'Footer', [text('tagline', 'Tagline'), str('servicesHeading', 'Column 1 heading'), rows('services', 'Column 1 links', link, { singular: 'link' }),
      str('firmHeading', 'Column 2 heading'), rows('firm', 'Column 2 links', link, { singular: 'link' }), str('contactHeading', 'Column 3 heading'),
      str('linkedinLabel', 'LinkedIn link text'), str('privacyLabel', 'Privacy link text'), str('termsLabel', 'Terms link text')]),
  ] },
  { collection: 'settings', slug: 'hero', group: 'Site-wide', label: 'Homepage hero', fields: [
    str('eyebrow', 'Eyebrow line'),
    str('headlineLine1', 'Headline line 1', { hint: 'Wrap the teal words in asterisks, e.g. *Change* is inevitable, — they can sit anywhere in the line.' }),
    str('headlineLine2', 'Headline line 2', { hint: 'e.g. Will they be *ready?*' }), text('subtitle', 'Subtitle'),
    items('rotating', 'Rotating lines (italic, change every 4 seconds)', text('', 'Line'), { singular: 'line' }),
    str('ctaLabel', 'Primary button label'), str('ctaHref', 'Primary button link'), str('secondaryLabel', 'Secondary button label'), str('secondaryHref', 'Secondary button link'),
    img('backgroundImage', 'Background image', { hint: 'JPEG or WebP, about 1920px wide, under 400 KB. Leave empty for a solid navy hero.' }),
    str('backgroundVideo', 'Background video (MP4 URL)', { optional: true, hint: 'Optional. Muted and looping; the image above is the poster.' }),
    str('backgroundAlt', 'Background image description (alt text)', { optional: true }),
    num('tint', 'Navy tint over the background (0 = none, 1 = solid)', { min: 0, max: 1, step: 0.02, hint: 'Keep at 0.6 or higher so the text stays readable.' }),
    bool('showDashboard', 'Show the animated readiness card'),
    obj('card', 'Readiness card', [str('title', 'Title'), str('pill', 'Status pill'), rows('rows', 'Rows', [str('label', 'Label'), str('value', 'Value')], { singular: 'row' }),
      str('quoteLabel', 'Teal card — small caps line'), str('quoteText', 'Teal card — question')]),
    rows('proof', 'Proof strip under the hero', [str('title', 'Bold line'), str('text', 'Text')], { singular: 'item' }),
    items('marqueeExtra', 'Extra lines in the teal ticker (after the rotating lines)', str('', 'Line'), { singular: 'line' }),
  ] },
  { collection: 'settings', slug: 'golive', group: 'Site-wide', label: '“Where is your go-live?” slider', description: 'Shown on the home page and the Services page.', fields: [
    str('label', 'Question'), items('ticks', 'Scale labels (left, middle, right)', str('', 'Label'), { fixed: true, hint: 'Left is kickoff (12 months out), right is go-live + 90 days.' }),
    str('monthsOut', 'Months label ({n} = number)'), str('daysOut', 'Days label ({n} = number)'), str('afterGoLive', 'Label at the far right (after go-live)'),
    obj('advice', 'Advice shown under the slider', [text('kickoff', '7–12 months out'), text('delivery', '4–6 months out'), text('assess', '90 days or less'), text('after', 'After go-live')]),
  ] },
  { collection: 'settings', slug: 'grid', group: 'Site-wide', label: '“Who can lead it? Who can do it?” grid', description: 'The four quadrants on the home page and in step 3 of every landing-page form.', fields: [
    rows('cells', 'Quadrants', [str('id', 'Code', { readonly: true }), str('tag', 'Small caps line'), text('label', 'Statement'), str('result', 'Result shown after choosing')], { fixed: true }),
  ] },
  { collection: 'settings', slug: 'cta', group: 'Site-wide', label: 'Closing call to action', description: 'The navy band at the end of service detail pages and insight posts.', fields: [
    str('heading', 'Heading'), text('text', 'Text'), str('label', 'Button label'), str('href', 'Button link'),
  ] },
  { collection: 'settings', slug: 'feeds', group: 'Site-wide', label: 'Insights feed (RSS)', description: 'Posts from these feeds appear on the Insights page, merged with the site’s own Insights posts, newest first. The home page can show the latest few.', fields: [
    rows('sources', 'Feed sources', [str('name', 'Display name (shown under each post)'), str('url', 'Feed URL'), bool('enabled', 'Enabled')], { singular: 'feed', hint: 'A standard RSS/Atom address (for a WordPress blog: the site address followed by /feed) or an rss.app URL (.xml or .json). Untick “Enabled” to pause a feed.' }),
    num('insightsCount', 'Posts on the Insights page', { min: 1, max: 50 }),
    bool('showImages', 'Show each post’s picture when the feed includes one'),
    str('readMore', 'Link text at the foot of each post card'), str('emptyText', 'Text when there are no posts yet'),
    num('cacheMinutes', 'Check feeds for new posts every (minutes)', { min: 5, max: 1440 }),
    bool('showOnHome', 'Show the “Latest insights” section on the home page'), str('homeEyebrow', 'Home section eyebrow'), str('homeHeading', 'Home section heading'),
    str('homeLink', 'Home section link text'), num('homeCount', 'Posts on the home page', { min: 1, max: 6 }),
  ] },
  // ---------- Pages ----------
  { collection: 'pages', slug: 'home', group: 'Pages', label: 'Home', fields: [
    str('title', 'Browser title'),
    obj('gap', 'Section: The gap', [str('eyebrow', 'Eyebrow'), text('heading', 'Heading'), items('paragraphs', 'Paragraphs', text('', 'Paragraph'), { singular: 'paragraph' }), str('closing', 'Closing line')]),
    rows('stats', 'Numbers under “The gap”', [str('prefix', 'Before the number (e.g. ~ or ≤)', { optional: true }), num('value', 'Number'), num('from', 'Count up from'), text('text', 'Caption')], { singular: 'number' }),
    obj('offers', 'Section: What we offer', [str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), str('link', 'Link text'), str('fitLabel', '“Fits now” tag'), str('learnMore', 'Card link text')]),
    obj('who', 'Section: Who this is for', [str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('lead', 'Lead'), str('link', 'Link text'), rows('facts', 'Facts', [str('label', 'Label'), text('text', 'Text')], { singular: 'fact' })]),
    obj('approach', 'Section: How an engagement runs', [str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), rows('phases', 'Phases', [str('num', 'Number'), str('name', 'Name'), text('text', 'Text')], { singular: 'phase' }), str('footnote', 'Footnote')]),
    obj('testimonials', 'Section: Testimonials', [str('eyebrow', 'Eyebrow')]),
    obj('partners', 'Section: For SI partners', [str('eyebrow', 'Eyebrow'), text('heading', 'Heading'), text('text', 'Text'), str('link', 'Link text')]),
    obj('cta', 'Section: The first call (grid)', [str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('text', 'Text'), str('prompt', 'Prompt under the heading'), str('label', 'Button label')]),
  ] },
  { collection: 'pages', slug: 'services', group: 'Pages', label: 'Services', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('lead', 'Lead'),
    rows('timeline', 'Timeline under the slider', [str('when', 'When'), str('what', 'What')], { fixed: true }),
    str('whoLabel', '“Who it’s for” label'), str('getLabel', '“What you get” label'), str('detailsLabel', 'Details link text'),
  ] },
  { collection: 'pages', slug: 'who-we-serve', group: 'Pages', label: 'Who we serve', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('lead', 'Lead'), rows('facts', 'Profile facts', [str('label', 'Label'), text('text', 'Text')], { singular: 'fact' }),
    str('triggerLabel', '“The trigger:” label'), str('painsLabel', '“What you’re dealing with” label'), str('footer', 'Line under the situations'), str('footerLink', 'Link text'),
  ] },
  { collection: 'pages', slug: 'partners', group: 'Pages', label: 'For SI partners', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('lead', 'Lead'), str('coverHeading', 'Chart heading'),
    str('youCoverLabel', 'Left box title'), items('youCover', 'Left box items', str('', 'Item'), { singular: 'item' }),
    str('weCoverLabel', 'Right box title'), items('weCover', 'Right box items', str('', 'Item'), { singular: 'item' }),
    text('chartNote', 'Note under the chart', { optional: true, hint: 'Clear this once the final chart is in.' }),
    rows('why', 'Why cards', [str('heading', 'Heading'), text('text', 'Text')], { singular: 'card' }),
    obj('cta', 'Closing call to action', [str('heading', 'Heading'), text('text', 'Text'), str('label', 'Button label')]),
  ] },
  { collection: 'pages', slug: 'about', group: 'Pages', label: 'About', description: 'Name, role, photo and bio are under Team.', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('portraitPlaceholder', 'Text shown until a photo is uploaded'),
    str('missionLabel', 'Mission label'), text('mission', 'Mission'), str('visionLabel', 'Vision label'), text('vision', 'Vision'),
    str('valuesLabel', 'Values label'), rows('values', 'Values', [str('name', 'Name'), text('text', 'Text')], { singular: 'value' }),
    rows('how', 'How we work', [str('label', 'Label'), text('text', 'Text')], { singular: 'item' }),
  ] },
  { collection: 'pages', slug: 'insights', group: 'Pages', label: 'Insights', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('lead', 'Lead'),
    str('newsletterEyebrow', 'Newsletter eyebrow'), str('newsletterHeading', 'Newsletter heading'), str('newsletterText', 'Newsletter text'),
    str('newsletterNote', 'Small note after the text', { optional: true }), str('emailLabel', 'Email label'), str('emailPlaceholder', 'Email placeholder'),
    str('subscribeLabel', 'Button label'), str('subscribing', 'While sending'), str('subscribed', 'Success message'), str('subscribeError', 'Error message'),
  ] },
  { collection: 'pages', slug: 'contact', group: 'Pages', label: 'Contact', description: 'The “Where are you?” choices are under Dashboard → Settings → Pick-lists.', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('lead', 'Lead'),
    str('emailLabel', 'Email label'), str('phoneLabel', 'Phone label'), str('linkedinLabel', 'LinkedIn label'), str('linkedinText', 'LinkedIn link text'),
    obj('form', 'Form', [str('name', 'Name label'), str('email', 'Email label'), str('company', 'Company label'), str('role', 'Role label'), str('situation', 'Situation label', { hint: 'The choices themselves are under Dashboard → Settings → Pick-lists.' }),
      str('choose', 'Empty choice'), str('message', 'Message label'), str('submit', 'Button label'), text('note', 'Note under the button'), str('sending', 'While sending'),
      str('nameError', 'Missing name'), str('emailError', 'Invalid email'), str('situationError', 'Missing situation'), str('failure', 'Generic error'), str('fallback', 'Error suffix before the email address')]),
    str('successHeading', 'Success heading'), text('successText', 'Success text'),
    obj('booking', 'Book a call (Calendly)', [str('url', 'Calendly event URL', { optional: true, hint: 'Leave empty to hide the booking button and the calendar shown after sending.' }),
      str('intro', 'Line above the button'), str('label', 'Button label'), str('afterText', 'Line above the calendar after sending'), str('frameTitle', 'Booking frame title (screen readers)')]),
  ] },
  { collection: 'pages', slug: 'landing', group: 'Pages', label: 'Landing pages (shared copy)', description: 'Wording used on all five /for/… pages. Each page’s own copy is under Dashboard → Landing pages.', fields: [
    str('soundFamiliar', 'Lead-in before the situation'), str('stepsHint', 'Hint next to the hero button'),
    str('goalsLabel', 'Goals label'), str('painsLabel', 'Pains label'), str('engagementLabel', 'Engagement label'),
    rows('proof', 'Proof items under the messages', [str('title', 'Bold line'), str('text', 'Text')], { singular: 'item' }),
    str('formEyebrow', 'Form eyebrow'), str('formHeading', 'Form heading'), text('formIntro', 'Form intro'),
    items('steps', 'Step names', str('', 'Step'), { fixed: true }),
    str('gridHeading', 'Grid heading'), str('gridIntro', 'Grid intro'), str('gridError', 'Grid not chosen'),
    str('choose', 'Empty choice'), str('required', 'Required field message'), str('emailError', 'Invalid email'),
    str('back', 'Back button'), str('next', 'Next button'), str('finish', 'Last button'), str('sending', 'While sending'), text('note', 'Note under the buttons'),
    str('doneLabel', 'Result label'), text('doneText', 'Thank-you text ({first} = first name)'), str('magnetSent', 'Lead magnet line ({email})'), str('bookingTitle', 'Booking frame title'),
    str('failure', 'Generic error'), str('fallback', 'Error suffix before the email address'), str('footerNote', 'Footer certification'),
  ] },
  { collection: 'pages', slug: 'not-found', group: 'Pages', label: 'Page not found (404)', fields: [
    ...meta, str('eyebrow', 'Eyebrow'), str('heading', 'Heading'), text('text', 'Text', { hint: 'Links: [Label](/path)' }),
  ] },
  // ---------- Collections ----------
  { collection: 'services', group: 'Collections', label: 'Services', entry: { singular: 'service', titleKey: 'title', slugEditable: true, urlPrefix: '/services/' }, body: { label: 'Detail (service page only)', optional: true }, fields: [
    str('title', 'Title'), num('order', 'Order'), str('when', 'When in the go-live (eyebrow)'), text('summary', 'Summary (home card)'), text('lead', 'Lead'),
    text('who', 'Who it’s for'), items('points', 'What you get', str('', 'Point'), { singular: 'point' }), text('message', 'Key message (quote)'), str('cta', 'Button label'),
    str('price', 'Price', { optional: true }), bool('showPrice', 'Show the price publicly'),
  ] },
  { collection: 'situations', group: 'Collections', label: 'Who we serve — situations', entry: { singular: 'situation', titleKey: 'headline' }, fields: [
    num('order', 'Order'), str('role', 'Role line'), str('headline', 'Headline'), text('trigger', 'Trigger'), items('pains', 'What you’re dealing with', str('', 'Pain point'), { singular: 'pain point' }),
    text('message', 'Message'), str('href', 'Link (path)'), str('cta', 'Link text'),
  ] },
  { collection: 'team', group: 'Collections', label: 'Team', entry: { singular: 'person', titleKey: 'name' }, body: { label: 'Bio' }, fields: [
    str('name', 'Name'), str('role', 'Role'), img('photo', 'Photo', { hint: 'Portrait, 4:5, at least 800 × 1000.' }), num('order', 'Order'),
  ] },
  { collection: 'testimonials', group: 'Collections', label: 'Testimonials', entry: { singular: 'testimonial', titleKey: 'name' }, fields: [
    num('order', 'Order'), text('text', 'Quote'), str('name', 'Name'), str('title', 'Title'), bool('confirmed', 'Confirmed current'),
  ] },
  { collection: 'insights', group: 'Collections', label: 'Insights posts', entry: { singular: 'post', titleKey: 'title', slugEditable: true, urlPrefix: '/insights/' }, body: { label: 'Post' }, fields: [
    str('title', 'Title'), text('description', 'Summary (cards and search)'), { name: 'date', label: 'Date', widget: 'date' }, str('tag', 'Tag'), str('author', 'Author'), bool('draft', 'Draft (hidden from the site)'),
  ] },
  { collection: 'custom-pages', group: 'Collections', label: 'New pages (page builder)', entry: { singular: 'page', titleKey: 'title', slugEditable: true, urlPrefix: '/p/' }, fields: [
    str('title', 'Page title'), text('description', 'Search description'), bool('published', 'Published'), bool('inNav', 'Show in the menu'),
    { name: 'blocks', label: 'Page blocks', widget: 'list', singular: 'block', types: [
      { name: 'hero', label: 'Hero', fields: [str('eyebrow', 'Eyebrow', { optional: true }), str('heading', 'Heading'), text('text', 'Text', { optional: true }), bool('dark', 'Navy background')] },
      { name: 'text', label: 'Text', fields: [str('heading', 'Heading', { optional: true }), { name: 'body', label: 'Body (Markdown)', widget: 'markdown' }] },
      { name: 'two-column', label: 'Two columns', fields: [str('eyebrow', 'Eyebrow', { optional: true }), str('heading', 'Heading'), { name: 'body', label: 'Body (Markdown)', widget: 'markdown' }] },
      { name: 'bullets', label: 'Bullet list', fields: [str('heading', 'Heading', { optional: true }), items('items', 'Items', str('', 'Item'), { singular: 'item' })] },
      { name: 'quote', label: 'Pull quote', fields: [text('text', 'Quote'), str('cite', 'Attribution', { optional: true })] },
      { name: 'image', label: 'Image', fields: [img('src', 'Image', { optional: false }), str('alt', 'Description (alt text)'), str('caption', 'Caption', { optional: true })] },
      { name: 'cta', label: 'Call to action', fields: [str('heading', 'Heading'), text('text', 'Text', { optional: true }), str('label', 'Button label'), str('href', 'Button link')] },
    ] },
  ] },
];

export const findDoc = (collection: string, slug?: string) => DOCS.find((d) => d.collection === collection && (d.entry ? true : d.slug === slug));

/** Empty value for a new row. */
export function blank(f: Field): any {
  if (f.widget === 'object') return Object.fromEntries((f.fields || []).map((c) => [c.name, blank(c)]));
  if (f.widget === 'list') return [];
  if (f.widget === 'boolean') return false;
  if (f.widget === 'number') return null;
  return '';
}

/** Server-side validation built from the same definitions (every API input goes through zod). */
export function zodFor(f: Field): z.ZodTypeAny {
  const opt = (t: z.ZodTypeAny) => (f.optional ? t.optional().nullable() : t);
  switch (f.widget) {
    case 'object': return z.object(Object.fromEntries((f.fields || []).map((c) => [c.name, zodFor(c)]))).passthrough();
    case 'list':
      if (f.types) return z.array(z.discriminatedUnion('type', f.types.map((t) => z.object({ type: z.literal(t.name), ...Object.fromEntries(t.fields.map((c) => [c.name, zodFor(c)])) })) as any)).max(200);
      return z.array(f.of ? zodFor(f.of) : zodFor({ name: '', label: '', widget: 'object', fields: f.fields })).max(200);
    case 'number': return f.optional ? z.number().finite().nullable().optional() : z.number().finite().nullable();
    case 'boolean': return z.boolean();
    case 'select': return opt(z.enum((f.options || []).map((o) => o.value) as [string, ...string[]]));
    case 'markdown': return opt(z.string().max(100_000));
    case 'text': return opt(z.string().max(10_000));
    default: return opt(z.string().max(2_000));
  }
}
export const docSchema = (fields: Field[]) => zodFor({ name: '', label: '', widget: 'object', fields });

// ---------- Dashboard → Landing pages (one row in landing_pages per persona) ----------
export const LANDING_FIELDS: Field[] = [
  // The prototype's fields first, in its order…
  str('eyebrow', 'Eyebrow (audience)'), str('headline', 'Headline'), text('situation', 'Situation subhead'),
  rows('messages', 'Lead message (quote) and key messages', [str('label', 'Label'), text('text', 'Message')], { singular: 'message', hint: 'The first message is the quote in the hero; all of them appear under “The engagement”.' }),
  str('cta', 'Button label'), str('magnet_title', 'Lead magnet title', { optional: true }),
  str('booking_url', 'Calendly event URL', { optional: true, hint: 'e.g. https://calendly.com/eichenberg/exploration — loads inline after the form.' }),
  img('hero_image', 'Hero background image', { hint: 'JPEG or WebP, about 1920px wide, under 400 KB. Leave empty for the default office photo.' }),
  // …then the rest of what the page shows.
  str('frame', 'Frame (after the eyebrow)'),
  { name: 'magnet_url', label: 'Lead magnet PDF', widget: 'file', optional: true, hint: 'Upload the PDF, or paste a link. It is emailed to people who submit the form.' },
  items('goals', 'What you’re after', text('', 'Goal'), { singular: 'goal' }),
  items('pains', 'What you’re dealing with', text('', 'Pain point'), { singular: 'pain point' }),
  obj('offer', 'The engagement', [str('name', 'Offer'), text('detail', 'Detail'), str('price', 'Fee range')]),
  bool('show_price', 'Show the fee range'), bool('published', 'Published (unlisted URL)'),
];

// ---------- Dashboard → Settings ----------
const level = { name: 'level', label: 'Status colour (manual rules)', widget: 'select' as const, options: [{ value: 'clear', label: 'Clear (teal)' }, { value: 'watch', label: 'Watch (amber)' }, { value: 'tripped', label: 'Tripped (red)' }] };
export const SETTINGS_FIELDS: Field[] = [
  rows('stages', 'Pipeline stages', [str('name', 'Stage'), str('question', 'Guiding question')], { fixed: true, hint: 'Five stages, left to right on the Pipeline board.' }),
  num('signedFromStage', 'Deals count as signed from stage number', { min: 1, max: 5, hint: '1 = Exploration … 5 = Continuation. Used for “Signed so far” and the measures.' }),
  obj('kept', 'Kept figure (Overview)', [str('label', 'Label'), num('value', 'Amount ($)')]),
  obj('bridge', 'Bridge income (for the bridge-share tripwire)', [num('income', 'Bridge income this year ($)'), num('revenue', 'Total revenue this year ($)')]),
  str('bdTargetText', 'BD-hours target (header line)'),
  rows('measures', 'Measures vs targets', [str('key', 'Measure', { readonly: true }), str('label', 'Label'), str('target', 'Target (as shown)'), num('targetNum', 'Target number (for the bar)')], { fixed: true }),
  items('learningQuestions', 'Learning questions', str('', 'Question'), { singular: 'question' }),
  rows('tripwires', 'Tripwires', [str('rule', 'Rule'),
    { name: 'metric', label: 'Checked against', widget: 'select', options: [{ value: 'bd_hours', label: 'BD hours a week (logged)' }, { value: 'bridge_share', label: 'Bridge income share (%)' }, { value: 'manual', label: 'Manual' }] },
    num('threshold', 'Threshold (hours or %)'), str('status', 'Status note (manual rules)', { optional: true }), level], { singular: 'tripwire' }),
  obj('partnerTargets', 'SI partner targets', [num('contacts', 'Contacts'), num('meetings', 'Meetings'), num('active', 'Active partners (bar)'), str('activeLabel', 'Active partners (as shown)'), text('note', 'Note above the table')]),
  obj('lists', 'Pick-lists', [
    items('offers', 'Offers (deals)', str('', 'Offer'), { singular: 'offer' }),
    items('sources', 'Lead sources (deals)', str('', 'Source'), { singular: 'source' }),
    items('platforms', 'Platforms (SI partners)', str('', 'Platform'), { singular: 'platform' }),
    rows('situations', '“Where are you?” choices (contact form)', [str('value', 'Code (kept in reports)'), str('label', 'Shown to visitors')], { singular: 'choice' }),
  ]),
];
