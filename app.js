(function () {
  'use strict';

  const TOTAL_FRAMES = 239;
  const FRAME_PATH = (i) => `frames/frame_${String(i).padStart(6, '0')}.webp`;
  const LERP = 0.12;

  // DOM Elements
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const siteHeader = document.getElementById('siteHeader');
  const navDotsBtn = document.getElementById('navDotsBtn');
  const mobileNavMenu = document.getElementById('mobileNavMenu');
  const floatingWrapper = document.getElementById('floatingContactWrapper');
  const floatingBtn = document.getElementById('floatingContactBtn');
  const floatingMenu = document.getElementById('floatingContactMenu');

  const frames = new Array(TOTAL_FRAMES).fill(null);
  let targetProgress = 0;
  let currentProgress = 0;
  let currentFrameIndex = 0;
  let lastRenderedIndex = -1;

  // Universally compatible image loader
  function loadFrame(i) {
    if (i < 0 || i >= TOTAL_FRAMES) return Promise.resolve(null);
    if (frames[i]) return Promise.resolve(frames[i]);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        frames[i] = img;
        if (i === currentFrameIndex || lastRenderedIndex === -1) {
          render(true);
        }
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = FRAME_PATH(i);
    });
  }

  // Preload all frames eagerly
  function preloadFrames() {
    loadFrame(0).then(() => render(true));

    for (let i = 1; i < TOTAL_FRAMES; i++) {
      loadFrame(i);
    }
  }

  // Find nearest loaded frame for zero-flicker scrubbing
  function getFrame(index) {
    if (frames[index] && frames[index].complete && frames[index].naturalWidth > 0) {
      return frames[index];
    }
    let offset = 1;
    while (index - offset >= 0 || index + offset < TOTAL_FRAMES) {
      const prev = index - offset;
      if (prev >= 0 && frames[prev] && frames[prev].complete && frames[prev].naturalWidth > 0) {
        return frames[prev];
      }
      const next = index + offset;
      if (next < TOTAL_FRAMES && frames[next] && frames[next].complete && frames[next].naturalWidth > 0) {
        return frames[next];
      }
      offset++;
    }
    return frames[0] || null;
  }

  // Draw frame to cover canvas viewport with GPU acceleration
  function render(force = false) {
    if (!ctx) return;
    const frameIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, currentFrameIndex));
    if (!force && frameIdx === lastRenderedIndex) return;

    const img = getFrame(frameIdx);
    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;

    const scale = Math.max(cw / iw, ch / ih);
    const rw = iw * scale;
    const rh = ih * scale;
    const ox = (cw - rw) * 0.5;
    const oy = (ch - rh) * 0.5;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, iw, ih, ox, oy, rw, rh);
    lastRenderedIndex = frameIdx;
  }

  // Update canvas resolution matching viewport
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    updateScroll();
    render(true);
  }

  // Calculate current scroll progress
  function updateScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
    const maxScroll = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    ) - window.innerHeight;

    if (maxScroll > 0) {
      targetProgress = Math.max(0, Math.min(1, scrollTop / maxScroll));
    } else {
      targetProgress = 0;
    }
  }

  // Auto-hide navigation tracking
  let lastScrollY = 0;
  const DELTA_THRESHOLD = 6;

  function onScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
    updateScroll();

    if (!siteHeader) return;

    // At top of page
    if (scrollTop <= 20) {
      siteHeader.classList.remove('nav-hidden');
      siteHeader.classList.remove('nav-scrolled');
      lastScrollY = scrollTop;
      return;
    }

    siteHeader.classList.add('nav-scrolled');

    // Do not auto-hide if mobile dropdown menu is open
    if (siteHeader.classList.contains('mobile-open')) {
      lastScrollY = scrollTop;
      return;
    }

    const delta = scrollTop - lastScrollY;
    if (Math.abs(delta) > DELTA_THRESHOLD) {
      if (delta > 0 && scrollTop > 60) {
        // Scrolling DOWN -> Auto hide navbar
        siteHeader.classList.add('nav-hidden');
      } else if (delta < 0) {
        // Scrolling UP -> Immediately pop up navbar
        siteHeader.classList.remove('nav-hidden');
      }
      lastScrollY = scrollTop;
    }
  }

  // Smooth lerping animation loop
  function loop() {
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.0001) {
      currentProgress += diff * LERP;
    } else {
      currentProgress = targetProgress;
    }

    const nextIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentProgress * (TOTAL_FRAMES - 1))));
    if (nextIndex !== currentFrameIndex || lastRenderedIndex === -1) {
      currentFrameIndex = nextIndex;
      render();
    }

    requestAnimationFrame(loop);
  }

  // Event listeners
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('touchmove', onScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(resize, 100);
    setTimeout(onScroll, 150);
  });
  window.addEventListener('load', () => {
    resize();
    render(true);
  });

  // Initialize Canvas & Animation Loop
  resize();
  preloadFrames();
  requestAnimationFrame(loop);

  // Mobile 3-Dots Menu Toggle
  if (navDotsBtn && siteHeader) {
    navDotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = siteHeader.classList.toggle('mobile-open');
      navDotsBtn.setAttribute('aria-expanded', String(isOpen));
      if (mobileNavMenu) {
        mobileNavMenu.setAttribute('aria-hidden', String(!isOpen));
      }
    });

    // Close mobile nav when clicking any link
    const mobileLinks = document.querySelectorAll('.mobile-nav-link, .mobile-nav-cta');
    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        siteHeader.classList.remove('mobile-open');
        navDotsBtn.setAttribute('aria-expanded', 'false');
        if (mobileNavMenu) {
          mobileNavMenu.setAttribute('aria-hidden', 'true');
        }
      });
    });

    // Close mobile nav when clicking outside
    document.addEventListener('click', (e) => {
      if (siteHeader.classList.contains('mobile-open') && !siteHeader.contains(e.target)) {
        siteHeader.classList.remove('mobile-open');
        navDotsBtn.setAttribute('aria-expanded', 'false');
        if (mobileNavMenu) {
          mobileNavMenu.setAttribute('aria-hidden', 'true');
        }
      }
    });
  }

  // Floating Liquid Glass Contact Widget Toggle
  if (floatingBtn && floatingWrapper) {
    floatingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = floatingWrapper.classList.toggle('open');
      floatingBtn.setAttribute('aria-expanded', String(isOpen));
      if (floatingMenu) {
        floatingMenu.setAttribute('aria-hidden', String(!isOpen));
      }
    });

    document.addEventListener('click', (e) => {
      if (floatingWrapper.classList.contains('open') && !floatingWrapper.contains(e.target)) {
        floatingWrapper.classList.remove('open');
        floatingBtn.setAttribute('aria-expanded', 'false');
        if (floatingMenu) {
          floatingMenu.setAttribute('aria-hidden', 'true');
        }
      }
    });
  }
})();
