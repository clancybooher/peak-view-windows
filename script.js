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

// Contact form — fetch submission + Turnstile + validation
(function () {
  'use strict';

  function getField(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function showAlert(form, msg) {
    let el = form.querySelector('.f-alert');
    if (!el) {
      el = document.createElement('p');
      el.className = 'f-alert f-alert--error';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'polite');
      const btn = form.querySelector('.f-submit');
      form.insertBefore(el, btn);
    }
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearAlert(form) {
    const el = form.querySelector('.f-alert');
    if (el) el.hidden = true;
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn.dataset.orig = btn.textContent;
      btn.textContent = 'SENDING…';
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.orig || 'GET MY FREE EVALUATION →';
    }
  }

  function showSuccess(form) {
    const wrapper = form.closest('.c-form');
    if (!wrapper) return;
    const firstName = (getField(form, 'name')?.value || '').split(' ')[0] || 'there';
    wrapper.innerHTML =
      '<div class="f-success" role="status" aria-live="polite">' +
        '<div class="f-success__icon" aria-hidden="true">' +
          '<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
          '</svg>' +
        '</div>' +
        '<h3>Got it, ' + firstName + '.</h3>' +
        '<p>Clancy will reach out personally — usually same day. In the meantime you can call or text directly at <a href="tel:+15416393968">541-639-3968</a>.</p>' +
      '</div>';
  }

  function validate(form) {
    const name  = getField(form, 'name')?.value.trim();
    const phone = getField(form, 'phone')?.value.trim();
    const email = getField(form, 'email')?.value.trim();
    const type  = getField(form, 'project_type')?.value;
    if (!name)                                          return 'Please enter your name.';
    if (!phone)                                         return 'Please enter your phone number.';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
    if (!type)                                          return 'Please select a project type.';
    return null;
  }

  // Wire up all contact forms (index + about)
  document.querySelectorAll('form[name^="contact"]').forEach(function (form) {
    form.setAttribute('novalidate', '');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearAlert(form);

      const err = validate(form);
      if (err) { showAlert(form, err); return; }

      // Grab the Turnstile token injected by the widget
      const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
      const token = tokenInput?.value || '';
      if (!token) {
        showAlert(form, 'Please complete the security check.');
        return;
      }

      const btn = form.querySelector('.f-submit');
      setLoading(btn, true);

      const payload = {
        name:          getField(form, 'name').value.trim(),
        phone:         getField(form, 'phone').value.trim(),
        email:         getField(form, 'email').value.trim(),
        project_type:  getField(form, 'project_type').value,
        message:       getField(form, 'message')?.value.trim() || '',
        turnstileToken: token,
      };

      try {
        const res  = await fetch('/api/submit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          showSuccess(form);
        } else {
          showAlert(form, data.error || 'Something went wrong. Please call 541-639-3968.');
          setLoading(btn, false);
          if (window.turnstile) window.turnstile.reset();
        }
      } catch {
        showAlert(form, 'Connection error. Please call or text us at 541-639-3968.');
        setLoading(btn, false);
        if (window.turnstile) window.turnstile.reset();
      }
    });
  });
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
