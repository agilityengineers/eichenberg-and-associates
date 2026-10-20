// "Where is your go-live?" slider (home + Services). Labels and advice come from Website content → Go-live slider.
type Cfg = { monthsOut: string; daysOut: string; afterGoLive: string; advice: Record<string, string> };
document.querySelectorAll<HTMLElement>('[data-golive]').forEach((box) => {
  const cfg = JSON.parse(box.dataset.golive || '{}') as Cfg;
  const r = box.querySelector<HTMLInputElement>('input[type=range]'), out = box.querySelector('output'), adv = box.querySelector('[data-advice]');
  if (!r || !out || !adv) return;
  const update = () => {
    const m = +r.value; const stage = m >= 7 ? 'kickoff' : m >= 4 ? 'delivery' : m >= 1 ? 'assess' : 'after';
    const label = m === 0 ? cfg.afterGoLive : m <= 3 ? cfg.daysOut.replace('{n}', String(m * 30)) : cfg.monthsOut.replace('{n}', String(m));
    out.textContent = label; r.setAttribute('aria-valuetext', label); adv.textContent = cfg.advice?.[stage] || '';
    // Home: offer cards that fit now (by service order: kickoff → 1st + 2nd, delivery → 2nd, ≤ 90 days → 3rd).
    const fit: Record<string, number[]> = { kickoff: [0, 1], delivery: [1], assess: [2], after: [] };
    document.querySelectorAll<HTMLElement>('[data-offer]').forEach((el, i) => el.classList.toggle('fit', fit[stage].includes(i)));
    // Services: the matching timeline step.
    document.querySelectorAll<HTMLElement>('[data-stage]').forEach((li) => li.classList.toggle('on', li.dataset.stage === stage));
  };
  r.addEventListener('input', update); update();
});
