(function () {
  'use strict';

  // Nav scroll state + hide on scroll down
  const nav = document.getElementById('nav');
  if (nav) {
    let lastY = window.scrollY;
    let ticking = false;

    const tick = () => nav.classList.toggle('scrolled', window.scrollY > 48);

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY;
      if (!ticking) {
        requestAnimationFrame(() => {
          tick();
          const navH = nav.offsetHeight;
          const menuOpen = document.getElementById('mob-menu')?.classList.contains('open');
          // Never hide the bar while the mobile menu is open — doing so takes the
          // burger off screen and leaves no way to close the menu.
          if (menuOpen) {
            nav.classList.remove('nav--hidden');
          } else if (currentY > lastY && currentY > navH) {
            nav.classList.add('nav--hidden');
          } else {
            nav.classList.remove('nav--hidden');
          }
          lastY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    tick();
  }

  // Mobile menu
  const burger = document.getElementById('burger');
  const mobMenu = document.getElementById('mob-menu');
  if (burger && mobMenu) {
    const setMenu = (open) => {
      mobMenu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      // Keep the bar visible whenever the menu is showing.
      if (open && nav) nav.classList.remove('nav--hidden');
    };

    burger.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenu(!mobMenu.classList.contains('open'));
    });

    // Any link closes it (including same-page hash links, where no navigation
    // happens and the menu would otherwise stay open over the content).
    mobMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobMenu.classList.contains('open')) setMenu(false);
    });

    // Returning to desktop width must not leave the overlay and scroll-lock on.
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && mobMenu.classList.contains('open')) setMenu(false);
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const ans  = item.querySelector('.faq-a');
      const open = item.classList.contains('open');

      // Close all open items
      document.querySelectorAll('.faq-item.open').forEach(el => {
        el.classList.remove('open');
        el.querySelector('.faq-a').style.maxHeight = '0';
        el.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });

      if (!open) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Smooth scroll for hash links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href.length < 2) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
})();

// Offer banner dismiss
(function () {
  const banner = document.getElementById('offer-banner');
  const close  = document.getElementById('banner-close');
  if (!banner || !close) return;

  function dismiss() {
    banner.classList.add('dismissed');
    document.body.classList.remove('has-banner');
    try { sessionStorage.setItem('pvw-banner-dismissed', '1'); } catch (_) {}
  }

  close.addEventListener('click', dismiss);

  try {
    if (sessionStorage.getItem('pvw-banner-dismissed')) dismiss();
  } catch (_) {}
})();

// Testimonials carousel
(function () {
  const track    = document.getElementById('t-track');
  const dotsWrap = document.getElementById('t-dots');
  const prevBtn  = document.getElementById('t-prev');
  const nextBtn  = document.getElementById('t-next');
  if (!track || !dotsWrap) return;

  const cards = Array.from(track.querySelectorAll('.t-card'));
  if (!cards.length) return;

  let perView = getPerView();
  let current = 0;

  function getPerView() {
    return 1;
  }

  function totalPages() { return Math.ceil(cards.length / perView); }

  function buildDots() {
    dotsWrap.innerHTML = '';
    for (let i = 0; i < totalPages(); i++) {
      const d = document.createElement('button');
      d.className = 't-dot' + (i === current ? ' active' : '');
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', 'Page ' + (i + 1));
      d.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(d);
    }
  }

  function goTo(idx) {
    current = Math.max(0, Math.min(idx, totalPages() - 1));
    cards.forEach((card, i) => {
      const active = i === current;
      card.classList.toggle('t-card--active', active);
      card.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dotsWrap.querySelectorAll('.t-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
    syncWrapHeight();
  }

  const wrap = track.parentElement;

  function syncWrapHeight() {
    if (!wrap || !cards[current]) return;
    wrap.style.minHeight = cards[current].offsetHeight + 'px';
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

  try {
    buildDots();
    goTo(0);
  } catch (_) {
    cards[0].classList.add('t-card--active');
    cards[0].setAttribute('aria-hidden', 'false');
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nv = getPerView();
      if (nv !== perView) {
        perView = nv;
        current = 0;
        buildDots();
        goTo(0);
      } else {
        syncWrapHeight();
      }
    }, 200);
  });
})();

// Scroll reveal — staggered, luxury easing (respects prefers-reduced-motion)
(function () {
  'use strict';
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const STAGGER_MS = 90;
  const CHILD_SEL = [
    '.wg-card',
    '.gallery-preview-item',
    '.gallery-preview-grid > img',
    '.gallery-item',
    '.process-step',
    '.b-card',
    '.svc-card',
    '.prod-card',
    '.trust-badge',
    '.energy-stat',
    '.step',
    '.pillar',
  ].join(', ');

  const HEAD_SEL = '.section-head-center, .sec-head, .sec-head--center, .testimonials-head';
  const sections = document.querySelectorAll(
    'section:not(.hero):not(.cta-band), .trust-bar, .page-hero'
  );

  const toObserve = [];

  sections.forEach((section) => {
    section.querySelectorAll('.why-img').forEach((img) => {
      img.classList.add('reveal-img');
      toObserve.push(img);
    });

    const children = section.querySelectorAll(CHILD_SEL);
    if (children.length > 0) {
      children.forEach((child, i) => {
        child.classList.add('reveal-child');
        child.style.setProperty('--reveal-delay', i * STAGGER_MS + 'ms');
        toObserve.push(child);
      });
      const head = section.querySelector(HEAD_SEL);
      if (head) {
        head.classList.add('reveal');
        toObserve.push(head);
      }
    } else {
      section.classList.add('reveal');
      toObserve.push(section);
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
  );

  toObserve.forEach((el) => observer.observe(el));
})();
