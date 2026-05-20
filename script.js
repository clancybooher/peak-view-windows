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
          if (currentY > lastY && currentY > navH) {
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
    burger.addEventListener('click', () => {
      const open = mobMenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
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
      const target = document.querySelector(a.getAttribute('href'));
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

  const cards = Array.from(track.children);
  let perView = getPerView();
  let current = 0;

  function getPerView() {
    if (window.innerWidth < 580) return 1;
    if (window.innerWidth < 900) return 2;
    return 3;
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
    const gap      = 24; // matches 1.5rem gap in CSS
    const cardW    = cards[0] ? cards[0].offsetWidth : 0;
    const slideAmt = current * perView * (cardW + gap);
    track.style.transform = 'translateX(-' + slideAmt + 'px)';
    dotsWrap.querySelectorAll('.t-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

  buildDots();

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
      }
    }, 200);
  });
})();
