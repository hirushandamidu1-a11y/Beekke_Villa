/**
 * Bikee Villa — Main JavaScript
 * Handles: sticky nav, mobile menu, scroll reveal, hero parallax
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Sticky Navbar & Mobile Sticky Bar ──────────────────────────────────────
  const navbar = document.getElementById('navbar');
  const mobileStickyBar = document.getElementById('mobileStickyBar');
  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    if (mobileStickyBar) {
      if (window.scrollY > window.innerHeight * 0.7) {
        mobileStickyBar.classList.remove('translate-y-full');
      } else {
        mobileStickyBar.classList.add('translate-y-full');
      }
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── 2. Active nav link highlighting ───────────────────────
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  const highlightNav = () => {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 100) current = sec.id;
    });
    navLinks.forEach(link => {
      link.classList.remove('text-gold');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('text-gold');
      }
    });
  };
  window.addEventListener('scroll', highlightNav, { passive: true });

  // ── 3. Mobile Menu ────────────────────────────────────────
  const menuBtn    = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  const closeMobile = () => {
    mobileMenu.classList.add('translate-x-full');
    menuBtn.classList.remove('hamburger-open');
    document.body.style.overflow = '';
  };

  menuBtn?.addEventListener('click', () => {
    const isClosed = mobileMenu.classList.contains('translate-x-full');
    if (!isClosed) {
      closeMobile();
    } else {
      mobileMenu.classList.remove('translate-x-full');
      menuBtn.classList.add('hamburger-open');
      document.body.style.overflow = 'hidden';
    }
  });

  mobileLinks.forEach(link => link.addEventListener('click', closeMobile));

  // ── 4. Scroll Reveal (Intersection Observer) ──────────────
  const revealElements = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger children with class reveal inside same parent
        entry.target.style.transitionDelay = (i % 4) * 0.1 + 's';
        entry.target.classList.add('visible');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealElements.forEach(el => revealObs.observe(el));

  // ── 5. Hero Background Zoom-in on load ───────────────────
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    window.addEventListener('load', () => heroBg.classList.add('loaded'));
    setTimeout(() => heroBg.classList.add('loaded'), 300);
  }

  // ── 6. Smooth anchor scroll (backup for older browsers) ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── 7. Stagger reveal for pricing cards ──────────────────
  document.querySelectorAll('.pricing-card, .pricing-card-featured').forEach((card, i) => {
    card.style.transitionDelay = (i * 0.1) + 's';
  });



});
