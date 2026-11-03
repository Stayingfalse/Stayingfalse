// Browser behaviour for the channel guide: TV static on load, channel changes on scroll,
// torchlight, the listings clock and the Random Acts of Santa season countdown.
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- TV static, then tune in ---
  const tv = document.querySelector('.tv-screen');
  const snow = tv && tv.querySelector('.snow');
  if (tv && snow && !reduce) {
    const ctx = snow.getContext('2d');
    const w = (snow.width = 160), h = (snow.height = 120);
    const img = ctx.createImageData(w, h);
    let frames = 0, raf;
    tv.classList.add('tuning');
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      if (++frames < 22) raf = requestAnimationFrame(draw);
      else { tv.classList.remove('tuning'); tv.classList.add('tuned'); }
    };
    raf = requestAnimationFrame(draw);
  }

  // --- channels switch on as they scroll in ---
  const worlds = document.querySelectorAll('[data-world]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-on'); io.unobserve(e.target); }
    }, { threshold: 0.22 });
    worlds.forEach((w) => io.observe(w));
  } else {
    worlds.forEach((w) => w.classList.add('is-on'));
  }

  // --- torchlight follows the pointer in the dungeon ---
  document.querySelectorAll('[data-torch]').forEach((el) => {
    if (reduce) return;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--x', `${e.clientX - r.left}px`);
      el.style.setProperty('--y', `${e.clientY - r.top}px`);
    });
  });

  // --- listings clock ---
  const clock = document.querySelector('[data-clock]');
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + ', ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    clock.dateTime = d.toISOString();
  };
  if (clock) { tick(); setInterval(tick, 15000); }

  // --- Random Acts of Santa season ---
  const ras = document.querySelector('[data-opens]');
  if (ras && ras.dataset.opens && ras.dataset.closes) {
    const now = new Date();
    const at = (y, md) => { const [m, d] = md.split('-').map(Number); return new Date(y, m - 1, d); };
    const y = now.getFullYear();
    // the season runs across new year: opens this year, closes next January
    let opens = at(y, ras.dataset.opens), closes = at(y + 1, ras.dataset.closes);
    const lastClose = at(y, ras.dataset.closes);
    if (now <= lastClose) { opens = at(y - 1, ras.dataset.opens); closes = lastClose; }
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const days = (d) => Math.ceil((d - now) / 864e5);
    const open = now >= opens && now <= closes;
    const nextOpen = open ? opens : (now > closes ? at(y, ras.dataset.opens) : opens);
    const seasonYear = (open ? opens : nextOpen).getFullYear();
    const dd = ras.querySelector('[data-season]');
    const short = document.querySelector('[data-season-short]');
    const n = days(open ? closes : nextOpen);
    if (dd) dd.innerHTML = open
      ? `Open now<small>Gifting runs until ${fmt(closes)}, ${n} day${n === 1 ? '' : 's'} to go</small>`
      : `Opens ${fmt(nextOpen)}<small>${n} day${n === 1 ? '' : 's'} to go. Get your wishlist ready.</small>`;
    if (short) short.textContent = open ? 'Open now' : `${n} days`;
    ras.querySelectorAll('[data-year]').forEach((el) => (el.textContent = seasonYear));
  }
})();
