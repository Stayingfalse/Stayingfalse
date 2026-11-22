// Browser behaviour for the channel guide: TV static on load, channel changes on scroll,
// torchlight, the listings clock and the Random Acts of Santa season countdown.
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
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

  // --- reels: each channel switches on when it fills the screen, and off again when it leaves,
  //     so its entrance plays every time you swipe back to it ---
  const reels = [...document.querySelectorAll('[data-reel]')];
  const navList = document.querySelector('[data-reel-nav]');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const navLinks = reels.map((r) => {
    if (!navList) return null;
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${r.id}`;
    link.innerHTML = '<span></span>';
    link.querySelector('span').textContent = r.dataset.reel;
    li.append(link);
    navList.append(li);
    return link;
  });
  const setActive = (reel) => {
    reels.forEach((r, i) => navLinks[i] && navLinks[i].setAttribute('aria-current', r === reel ? 'true' : 'false'));
    if (themeMeta && reel.dataset.tint) themeMeta.content = reel.dataset.tint;
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.55) { e.target.classList.add('is-on'); setActive(e.target); }
        else if (!e.isIntersecting && !reduce) e.target.classList.remove('is-on');
      }
    }, { threshold: [0, 0.55] });
    reels.forEach((r) => io.observe(r));
  } else {
    reels.forEach((r) => r.classList.add('is-on'));
  }

  const go = (reel) => reel && reel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  document.addEventListener('click', (e) => {
    const nextBtn = e.target.closest('[data-next]');
    if (nextBtn) {
      const i = reels.indexOf(nextBtn.closest('[data-reel]'));
      go(reels[i + 1]);
      return;
    }
    const shareBtn = e.target.closest('[data-share]');
    if (shareBtn) share(shareBtn);
  });

  // --- share a channel: the native share sheet where there is one, otherwise copy the link ---
  const toast = document.querySelector('[data-toast]');
  let toastTimer;
  const say = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };
  async function share(btn) {
    const url = new URL(btn.dataset.share, location.href).href;
    const title = btn.dataset.title || document.title;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      say('Link copied');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      say('Couldn\'t copy the link. It\'s in the address bar.');
      history.replaceState(null, '', btn.dataset.share);
    }
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
