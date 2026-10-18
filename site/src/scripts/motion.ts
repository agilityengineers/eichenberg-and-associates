// Scroll-reveal, progress bar, count-ups. Loaded once from Base.astro.
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

const bar = document.querySelector<HTMLElement>('.progress');
if (bar) addEventListener('scroll', () => { const d = document.documentElement; bar.style.width = Math.round((d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)) * 100) + '%'; }, { passive: true });

document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
  const to = Number(el.dataset.count), from = Number(el.dataset.from ?? 0), ms = Number(el.dataset.ms ?? 1400);
  const run = () => { const t0 = performance.now(); const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = String(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) el.textContent = String(to);
  else new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { run(); o.disconnect(); } }).observe(el);
});
