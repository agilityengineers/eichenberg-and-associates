import { defineCollection, z } from 'astro:content';

const services = defineCollection({ type: 'content', schema: z.object({
  title: z.string(), order: z.number(), when: z.string(), lead: z.string(), who: z.string(),
  points: z.array(z.string()), message: z.string(), cta: z.string(),
  price: z.string().optional(), showPrice: z.boolean().default(false), summary: z.string(),
})});

const insights = defineCollection({ type: 'content', schema: z.object({
  title: z.string(), description: z.string(), date: z.coerce.date(), tag: z.string().default('Readiness'),
  draft: z.boolean().default(false), author: z.string().default('Jennifer Eichenberg'),
})});

const team = defineCollection({ type: 'content', schema: z.object({
  name: z.string(), role: z.string(), photo: z.string().optional(), order: z.number().default(1),
})});

const situations = defineCollection({ type: 'data', schema: z.object({
  order: z.number(), role: z.string(), headline: z.string(), trigger: z.string(),
  pains: z.array(z.string()), message: z.string(), href: z.string(), cta: z.string(),
})});

const testimonials = defineCollection({ type: 'data', schema: z.object({
  order: z.number(), text: z.string(), name: z.string(), title: z.string(), confirmed: z.boolean().default(false),
})});

const pages = defineCollection({ type: 'data', schema: z.any() });   // per-page copy, shape owned by each .astro page

const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hero'), eyebrow: z.string().optional(), heading: z.string(), text: z.string().optional(), dark: z.boolean().default(true) }),
  z.object({ type: z.literal('text'), heading: z.string().optional(), body: z.string() }),
  z.object({ type: z.literal('two-column'), eyebrow: z.string().optional(), heading: z.string(), body: z.string() }),
  z.object({ type: z.literal('bullets'), heading: z.string().optional(), items: z.array(z.string()) }),
  z.object({ type: z.literal('quote'), text: z.string(), cite: z.string().optional() }),
  z.object({ type: z.literal('image'), src: z.string(), alt: z.string().optional(), caption: z.string().optional() }),
  z.object({ type: z.literal('cta'), heading: z.string(), text: z.string().optional(), label: z.string().default('Start a conversation'), href: z.string().default('/contact') }),
]);
const customPages = defineCollection({ type: 'content', schema: z.object({
  title: z.string(), slug: z.string().regex(/^[a-z0-9-]+$/), description: z.string(), published: z.boolean().default(false), inNav: z.boolean().default(false), blocks: z.array(block),
})});

export const collections = { services, insights, team, situations, testimonials, pages, customPages };
