(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  const videoPath = 'assets/video/elan-noir-ritual.mp4';
  const V = {
    scrub: videoPath,
    full:  videoPath,
    small: videoPath
  };

  const hero = $('#hero'), sticky = $('#sticky'), video = $('#ritual');
  const header = $('#header'), exitEl = $('#exit'), cue = $('#cue');
  const mqScrub = matchMedia('(min-width:1025px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  const mqReduce = matchMedia('(prefers-reduced-motion:reduce)');
  const scenes = [...document.querySelectorAll('.scene')].map(el => ({ el, s: +el.dataset.start, e: +el.dataset.end, on: false }));

  let mode = '', cur = 0, visible = true, looping = false, lastP = -1;

  /* ---------- video source / mode ---------- */
  function tryPlay() {
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {
        // Fallback for strict browser autoplay policies
      });
    }
  }

  function setMode() {
    const next = mqScrub.matches ? 'scrub' : 'auto';
    if (next === mode) return;
    mode = next;
    hero.classList.toggle('is-scrub', mode === 'scrub');
    
    video.loop = mode === 'auto';
    video.preload = 'auto';

    if (!video.src.includes(videoPath)) {
      video.src = videoPath;
      video.load();
    }

    cur = 0;
    lastP = -1;
    
    if (mode === 'auto') {
      tryPlay();
    } else {
      video.pause();
    }
    startLoop();
  }

  ['touchstart', 'pointerdown', 'keydown', 'click'].forEach(t =>
    addEventListener(t, () => { 
      if (mode === 'auto' && video.paused && visible) tryPlay(); 
    }, { once: false, passive: true }));

  /* ---------- narrative cards ---------- */
  const FADE = 0.22;
  function updateScenes(p) {
    const still = mqReduce.matches;
    for (const sc of scenes) {
      const t = (p - sc.s) / (sc.e - sc.s);
      const o = t > 0 && t < 1 ? Math.min(clamp(t / FADE), clamp((1 - t) / FADE)) : 0;
      const on = o > 0;
      if (on !== sc.on) { 
        sc.on = on; 
        sc.el.style.willChange = on ? 'opacity, transform' : 'auto'; 
      }
      if (on || sc.drawn) {
        sc.el.style.opacity = o.toFixed(3);
        sc.el.style.transform = still ? 'none' : `translateY(${((1 - clamp(t / FADE)) * 20 * (t < 0.5 ? 1 : 0)).toFixed(2)}px)`;
      }
      sc.drawn = on;
    }
  }

  /* ---------- rAF loop ---------- */
  function frame() {
    looping = false;
    if (!visible && mode === 'auto') return;
    let p = 0;
    if (mode === 'scrub') {
      const range = hero.offsetHeight - sticky.offsetHeight;
      p = range > 0 ? clamp(-hero.getBoundingClientRect().top / range) : 0;
      if (video.duration) {
        const target = p * video.duration;
        cur += (target - cur) * 0.12;
        if (Math.abs(target - cur) < 0.003) cur = target;
        const d = Math.abs(video.currentTime - cur);
        if (d > 0.01 && (!video.seeking || d > 0.2)) {
          video.currentTime = cur;
        }
      }
      exitEl.style.opacity = clamp((p - 0.96) / 0.04).toFixed(3);
      cue.style.opacity = p > 0.02 ? 0 : 1;
    } else if (video.duration) {
      p = video.currentTime / video.duration;
      exitEl.style.opacity = 0;
    }
    if (p !== lastP) { 
      lastP = p; 
      updateScenes(p); 
    }
    startLoop(true);
  }

  function startLoop(force) {
    if (looping) return;
    if (!force && !visible && mode === 'auto') return;
    looping = true; 
    requestAnimationFrame(frame);
  }

  /* ---------- visibility handling ---------- */
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (mode !== 'auto') return;
    if (visible) { 
      tryPlay(); 
      startLoop(); 
    } else {
      video.pause();
    }
  }, { threshold: 0.05 }).observe(hero);

  document.addEventListener('visibilitychange', () => {
    if (mode === 'auto') { 
      if (document.hidden) video.pause(); 
      else if (visible) tryPlay(); 
    }
  });

  mqScrub.addEventListener ? mqScrub.addEventListener('change', setMode) : mqScrub.addListener(setMode);
  setMode();

  /* ---------- header scroll styling ---------- */
  let hTick = false;
  const hdr = () => { 
    header.classList.toggle('scrolled', scrollY > 4); 
    hTick = false; 
  };
  addEventListener('scroll', () => { 
    if (!hTick) { 
      hTick = true; 
      requestAnimationFrame(hdr); 
    } 
  }, { passive: true });
  hdr();

  const setHH = () => document.documentElement.style.setProperty('--hh', header.offsetHeight + 'px');
  setHH(); 
  addEventListener('resize', setHH, { passive: true });

  /* ---------- mobile drawer ---------- */
  const burger = $('#burger'), drawer = $('#drawer');
  function setDrawer(open) {
    drawer.classList.toggle('open', open);
    drawer.toggleAttribute('inert', !open);
    drawer.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { 
      const a = $('a', drawer); 
      a && a.focus(); 
    } else if (document.activeElement && drawer.contains(document.activeElement)) {
      burger.focus();
    }
  }

  burger.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  drawer.addEventListener('click', e => { if (e.target.closest('a')) setDrawer(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawer(false); });
  addEventListener('resize', () => { if (innerWidth > 1024 && drawer.classList.contains('open')) setDrawer(false); }, { passive: true });

  drawer.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...drawer.querySelectorAll('a')], first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { 
      e.preventDefault(); 
      burger.focus(); 
    } else if (!e.shiftKey && document.activeElement === last) { 
      e.preventDefault(); 
      burger.focus(); 
    }
  });

  /* ---------- scroll reveal ---------- */
  const rev = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { 
      if (e.isIntersecting) { 
        e.target.classList.add('in'); 
        io.unobserve(e.target); 
      } 
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rev.forEach(el => io.observe(el));
  } else {
    rev.forEach(el => el.classList.add('in'));
  }

  /* ---------- privacy dialog ---------- */
  const dlg = $('#privacy');
  $('#privacy-open').addEventListener('click', () => dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''));
  $('#privacy-close').addEventListener('click', () => dlg.close ? dlg.close() : dlg.removeAttribute('open'));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();