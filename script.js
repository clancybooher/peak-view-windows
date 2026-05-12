document.addEventListener('DOMContentLoaded', function () {
  const nav = document.querySelector('nav');
  const hero = document.querySelector('#hero');

  const handleScroll = () => {
    const scrolled = window.scrollY > 24;
    nav.classList.toggle('nav--scrolled', scrolled);
  };

  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });

  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.18 });
    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('visible'));
  }
});
