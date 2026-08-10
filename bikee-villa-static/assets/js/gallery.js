import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;

  // ── 1. Fetch from Firebase ─────────────────────────────────
  try {
    const q = query(collection(db, "gallery"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    
    galleryGrid.innerHTML = ''; // Clear loading indicator
    
    if (querySnapshot.empty) {
      galleryGrid.innerHTML = `
        <div class="col-span-full py-16 text-center text-woods-light font-classic tracking-wider w-full">
          <p class="text-4xl mb-4">🖼️</p>
          <p>No photos yet.</p>
        </div>
      `;
      return;
    }

    let count = 0;
    querySnapshot.forEach((doc) => {
      const img = doc.data();
      count++;
      
      const item = document.createElement('div');
      item.className = `gallery-item w-[75vw] flex-shrink-0 snap-center md:w-auto overflow-hidden rounded-[2rem] shadow-lg cursor-pointer group relative aspect-[4/5] bg-woods-dark ${count > 8 ? 'gallery-hidden-extra' : ''}`;
      item.setAttribute('data-category', img.category || 'other');
      item.setAttribute('data-src', img.url);
      item.setAttribute('data-title', img.title || 'Gallery Image');
      
      item.innerHTML = `
        <img src="${img.url}"
             alt="${img.title || 'Gallery Image'}"
             class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
             loading="lazy" />
        <div class="absolute inset-0 bg-gradient-to-t from-woods-dark/90 via-woods-dark/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
          <span class="inline-block px-3 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 text-gold text-xs font-classic tracking-widest uppercase rounded-full mb-2">
            ${img.category || 'other'}
          </span>
          <h3 class="font-display text-xl text-parchment">${img.title || ''}</h3>
        </div>
      `;
      
      galleryGrid.appendChild(item);
    });
    
  } catch (error) {
    console.error("Error loading gallery:", error);
    galleryGrid.innerHTML = `<div class="col-span-full text-red-500 p-4 text-center">Failed to load gallery images.</div>`;
    return; // Stop execution on error
  }

  // ── 2. Initialize Gallery Logic ─────────────────────────────
  
  const filterBtns  = document.querySelectorAll('.gallery-filter');
  const galleryItems = document.querySelectorAll('.gallery-item');

  // Filter Logic
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Update active button
      filterBtns.forEach(b => {
        b.classList.remove('active', 'bg-woods-dark', 'text-parchment', 'shadow-md', 'shadow-woods-dark/20');
        b.classList.add('bg-white', 'text-woods-light');
      });
      btn.classList.remove('bg-white', 'text-woods-light');
      btn.classList.add('active', 'bg-woods-dark', 'text-parchment', 'shadow-md', 'shadow-woods-dark/20');

      // Filter items with fade transition
      galleryItems.forEach(item => {
        const cat = item.dataset.category;
        const isExtra = item.classList.contains('gallery-hidden-extra');
        const isExpanded = galleryGrid.classList.contains('gallery-expanded');

        // If item is an extra and grid not expanded, skip (keep hidden)
        if (isExtra && !isExpanded) {
          item.style.display = 'none';
          return;
        }

        if (filter === 'all' || cat === filter) {
          item.style.display = 'block';
          item.style.opacity = '0';
          item.style.transform = 'scale(0.95)';
          requestAnimationFrame(() => {
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          });
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.95)';
          setTimeout(() => { item.style.display = 'none'; }, 350);
        }
      });
    });
  });

  // Lightbox Logic
  const lightbox        = document.getElementById('lightbox');
  const lightboxImg     = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose   = document.getElementById('lightboxClose');
  const lightboxPrev    = document.getElementById('lightboxPrev');
  const lightboxNext    = document.getElementById('lightboxNext');

  let currentIndex = 0;
  let visibleItems  = [];

  const openLightbox = (index) => {
    visibleItems = [...document.querySelectorAll('.gallery-item')].filter(el => el.style.display !== 'none');
    currentIndex = index;
    showImage(currentIndex);
    if (lightbox) {
      lightbox.classList.remove('hidden'); // Ensure base display is flex via css
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeLightbox = () => {
    if (lightbox) {
      lightbox.classList.add('hidden');
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxImg.src = '';
    }
  };

  const showImage = (idx) => {
    if (visibleItems.length === 0) return;
    const item = visibleItems[idx];
    if (!item) return;
    if (lightboxImg) {
      lightboxImg.style.opacity = '0';
      lightboxImg.style.transform = 'scale(0.96)';
      setTimeout(() => {
        lightboxImg.src = item.dataset.src;
        lightboxImg.alt = item.dataset.title;
        if (lightboxCaption) lightboxCaption.textContent = item.dataset.title;
        lightboxImg.onload = () => {
          lightboxImg.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          lightboxImg.style.opacity = '1';
          lightboxImg.style.transform = 'scale(1)';
        };
      }, 150);
    }
  };

  // Open on click
  galleryItems.forEach((item) => {
    item.addEventListener('click', () => {
      const visible = [...document.querySelectorAll('.gallery-item')].filter(el => el.style.display !== 'none');
      const clickedIdx = visible.indexOf(item);
      openLightbox(clickedIdx);
    });
  });

  // Navigation
  lightboxNext?.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % visibleItems.length;
    showImage(currentIndex);
  });
  lightboxPrev?.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    showImage(currentIndex);
  });

  // Close
  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % visibleItems.length; showImage(currentIndex); }
    if (e.key === 'ArrowLeft')  { currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length; showImage(currentIndex); }
  });

  // Touch swipe support
  let touchStartX = 0;
  lightbox?.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
  lightbox?.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) { currentIndex = (currentIndex + 1) % visibleItems.length; }
      else          { currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length; }
      showImage(currentIndex);
    }
  });

  // See More / See Less Toggle
  const seeMoreBtn   = document.getElementById('seeMoreBtn');
  const seeMoreLabel = document.getElementById('seeMoreLabel');
  const seeMoreIcon  = document.getElementById('seeMoreIcon');

  if (seeMoreBtn && galleryGrid) {
    let expanded = false;

    // Check if we even need the button
    if (galleryItems.length <= 8) {
      document.getElementById('seeMoreWrap').style.display = 'none';
    }

    seeMoreBtn.addEventListener('click', () => {
      expanded = !expanded;

      if (expanded) {
        galleryGrid.classList.add('gallery-expanded');
        seeMoreLabel.textContent = 'See Less';
        seeMoreIcon.style.transform = 'rotate(180deg)';
        seeMoreIcon.style.transition = 'transform 0.3s ease';
      } else {
        galleryGrid.classList.remove('gallery-expanded');
        seeMoreLabel.textContent = 'See More Photos';
        seeMoreIcon.style.transform = 'rotate(0deg)';
        seeMoreIcon.style.transition = 'transform 0.3s ease';
        // Scroll back to gallery section smoothly
        document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

});
