/* ==========================================================
   animations.js — Purely cosmetic site animation effects:
   preloader, custom cursor, hero text reveal, animated counters,
   scroll reveal, magnetic buttons, header hide-on-scroll, active
   nav link tracking. None of this touches cart/product state.
   ========================================================== */

// ===== UNIFIED SCROLL HANDLER (back-to-top, header, active nav link) =====
// These three effects used to be three separate `scroll` listeners, each
// mixing style *writes* (boxShadow, classList) with a layout *read*
// (section.offsetTop). Listeners run synchronously in registration order
// within the same frame, so an earlier write invalidated layout right
// before a later listener read it back — forcing the browser to
// recompute layout synchronously on every single scroll event ("forced
// reflow", flagged at ~43ms total in profiling).
//
// Fix:
//   1. Merge all three into one listener, throttled to once per animation
//      frame via requestAnimationFrame (scroll can fire dozens of times
//      per frame; we only need to update once per paint).
//   2. Never read geometry (offsetTop) inside the scroll loop — section
//      offsets are measured once up front (and re-measured on resize)
//      instead of on every tick, removing the forced read entirely.
//   3. Register the listener as `passive` so it never blocks the
//      browser's native scrolling while it waits to see if we'll call
//      preventDefault (we never do).
function initScrollEffects() {
  const scrollTopBtn = document.getElementById('scroll-top-btn');
  const header = document.querySelector('header');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section[id], main[id]');

  let sectionOffsets = [];
  function measureSections() {
    sectionOffsets = Array.from(sections).map(section => ({
      id: section.getAttribute('id'),
      top: section.offsetTop - 100
    }));
  }
  measureSections();
  window.addEventListener('resize', measureSections, { passive: true });

  let lastScrollY = window.scrollY;
  let ticking = false;

  function update() {
    ticking = false;
    const currentScrollY = window.scrollY;

    // --- back-to-top button ---
    scrollTopBtn.classList.toggle('show', currentScrollY > 400);

    // --- header shadow + hide-on-scroll ---
    header.style.boxShadow = currentScrollY > 50
      ? '0 4px 20px rgba(0, 0, 0, 0.6)'
      : 'var(--shadow-sm)';

    const mobileMenuOpen = navMenu && navMenu.classList.contains('open');
    header.classList.toggle(
      'header-hidden',
      !mobileMenuOpen && currentScrollY > lastScrollY && currentScrollY > 160
    );
    lastScrollY = currentScrollY;

    // --- active nav link (uses cached offsets — no layout read here) ---
    let current = '';
    for (const { id, top } of sectionOffsets) {
      if (currentScrollY >= top) current = id;
    }
    navLinks.forEach(link => {
      const isActive = link.getAttribute('href') === `#${current}` ||
        (current === 'home' && link.getAttribute('href') === '#');
      link.classList.toggle('active', isActive);
    });
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== INTERSECTION OBSERVER FOR ANIMATIONS =====
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.testimonial-card, .feature-item, .about-badge').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// ===== PRELOADER =====
function initPreloader() {
  const preloader = document.getElementById('preloader');
  const progressBar = document.getElementById('preloader-progress');
  if (!preloader || !progressBar) return;

  document.body.classList.add('is-loading');

  let progress = 0;
  const tick = setInterval(() => {
    progress += Math.random() * 18;
    if (progress >= 90) {
      progress = 90;
      clearInterval(tick);
    }
    progressBar.style.width = progress + '%';
  }, 120);

  const finishLoading = () => {
    clearInterval(tick);
    progressBar.style.width = '100%';
    setTimeout(() => {
      preloader.classList.add('hide');
      document.body.classList.remove('is-loading');
    }, 350);
  };

  window.addEventListener('load', finishLoading, { once: true });

  setTimeout(finishLoading, 4000);
}

// ===== CUSTOM CURSOR =====
function initCustomCursor() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  document.body.classList.add('using-custom-cursor');

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  function animateRing() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateRing);
  }
  animateRing();

  const hoverSelector = 'a, button, .product-card, input, select, .qty-btn';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverSelector)) {
      ring.classList.add('cursor-hover');
      dot.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverSelector)) {
      ring.classList.remove('cursor-hover');
      dot.classList.remove('cursor-hover');
    }
  });
}

// ===== HERO TEXT REVEAL =====
function initHeroReveal() {
  const title = document.querySelector('.hero-title');
  if (!title) return;

  const words = title.querySelectorAll('.reveal-inner');
  words.forEach((word, i) => {
    word.style.transitionDelay = `${i * 0.12 + 0.15}s`;
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      title.classList.add('revealed');
    });
  });
}

// ===== ANIMATED NUMBER COUNTERS =====
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animateCounter = (el) => {
    const target = parseInt(el.dataset.counter, 10) || 0;
    const suffix = el.dataset.suffix || '';

    if (reduceMotion) {
      el.textContent = target + suffix;
      return;
    }

    const duration = 1400;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target + suffix;
      }
    }
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

// ===== MAGNETIC BUTTONS =====
function initMagneticButtons() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('.magnetic-btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });
}

// ===== SCROLL REVEAL for [data-reveal] sections =====
function initScrollReveal() {
  const elements = document.querySelectorAll('[data-reveal]');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  elements.forEach(el => observer.observe(el));
}
