/**
 * Bikee Villa — Booking Form JavaScript
 * Handles: date pickers, price preview, AJAX submission
 */

import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

  // ── Dynamic Pricing & Packages ──────────────────────────────
  const pricing = {};
  
  try {
    const q = query(collection(db, "packages"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    
    const largeContainer = document.getElementById('dynamicPackagesContainer');
    const smallContainer = document.getElementById('dynamicSmallPackagesContainer');
    const packageSelect = document.getElementById('package_type');

    if (largeContainer) largeContainer.innerHTML = '';
    if (smallContainer) smallContainer.innerHTML = '';
    
    // Reset options
    if (packageSelect) {
      packageSelect.innerHTML = '<option value="">— Select a Package —</option>';
    }

    snapshot.forEach(docSnap => {
      const pkg = docSnap.data();
      const codeName = docSnap.id;
      
      // Store in pricing map
      pricing[codeName] = pkg.price;
      
      // Add to select dropdown
      if (packageSelect) {
        const option = document.createElement('option');
        option.value = codeName;
        option.textContent = `${pkg.title} · ${pkg.subtitle} — LKR ${pkg.price.toLocaleString('en-LK')}`;
        packageSelect.appendChild(option);
      }

      // Build DOM Card
      if (pkg.isSmallCard && smallContainer) {
        const card = document.createElement('div');
        card.className = "pricing-card w-[85vw] flex-shrink-0 snap-center md:w-auto bg-parchment/5 border border-gold/20 rounded-sm p-6 hover:border-gold/60 transition-all duration-500 group flex flex-col md:flex-row items-start md:items-center gap-6";
        card.innerHTML = `
          <div class="text-4xl flex-shrink-0">${pkg.icon}</div>
          <div class="flex-1">
            <h3 class="font-display text-lg text-parchment font-semibold">${pkg.title}</h3>
            <p class="font-classic text-parchment/50 text-xs tracking-widest uppercase mb-2">${pkg.subtitle}</p>
            <span class="font-display text-2xl font-bold text-gold">${pkg.price.toLocaleString('en-LK')} <span class="font-classic text-sm text-parchment/50">LKR/day</span></span>
          </div>
          <a href="#booking" class="flex-shrink-0 border border-gold/40 text-gold font-classic text-xs tracking-widest uppercase px-4 py-2 rounded-sm group-hover:bg-gold group-hover:text-woods transition-all duration-300">
            Book
          </a>
        `;
        smallContainer.appendChild(card);
      } else if (largeContainer) {
        const card = document.createElement('div');
        
        let featureList = pkg.features && pkg.features.length > 0 
          ? `<ul class="space-y-2 mb-8 font-body text-${pkg.isFeatured ? 'woods' : 'parchment/70'} text-sm">
              ${pkg.features.map(f => `<li class="flex gap-2"><span class="${pkg.isFeatured ? 'text-woods/60' : 'text-gold'}">✦</span> ${f}</li>`).join('')}
             </ul>`
          : '';

        if (pkg.isFeatured) {
          card.className = "pricing-card-featured w-[85vw] flex-shrink-0 snap-center md:w-auto relative bg-gradient-to-b from-gold to-gold-dark rounded-sm p-8 shadow-2xl transform scale-105";
          card.innerHTML = `
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-woods text-gold font-classic text-xs tracking-widest uppercase px-4 py-1 rounded-full border border-gold/30">
              Most Popular
            </div>
            <div class="text-woods text-3xl mb-4">${pkg.icon}</div>
            <h3 class="font-display text-xl text-woods font-semibold mb-2">${pkg.title}</h3>
            <p class="font-classic text-woods/60 text-xs tracking-widest uppercase mb-6">${pkg.subtitle}</p>
            <div class="flex items-baseline gap-2 mb-6">
              <span class="font-display text-4xl font-bold text-woods">${pkg.price.toLocaleString('en-LK')}</span>
              <span class="font-classic text-woods/60 text-sm">LKR / day</span>
            </div>
            ${featureList}
            <a href="#booking" class="block text-center bg-woods text-gold font-classic text-xs tracking-widest uppercase py-3 rounded-sm hover:bg-woods-dark transition-all duration-300">
              Book This Package
            </a>
          `;
        } else {
          card.className = "pricing-card w-[85vw] flex-shrink-0 snap-center md:w-auto bg-parchment/5 border border-gold/20 rounded-sm p-8 hover:border-gold/60 hover:bg-parchment/10 transition-all duration-500 group";
          card.innerHTML = `
            <div class="text-gold text-3xl mb-4">${pkg.icon}</div>
            <h3 class="font-display text-xl text-parchment font-semibold mb-2">${pkg.title}</h3>
            <p class="font-classic text-parchment/50 text-xs tracking-widest uppercase mb-6">${pkg.subtitle}</p>
            <div class="flex items-baseline gap-2 mb-6">
              <span class="font-display text-4xl font-bold text-gold">${pkg.price.toLocaleString('en-LK')}</span>
              <span class="font-classic text-parchment/50 text-sm">LKR / day</span>
            </div>
            ${featureList}
            <a href="#booking" class="block text-center border border-gold/40 text-gold font-classic text-xs tracking-widest uppercase py-3 rounded-sm group-hover:bg-gold group-hover:text-woods transition-all duration-300">
              Book This Package
            </a>
          `;
        }
        largeContainer.appendChild(card);
      }
    });
    
    // Initial call to update price preview if values were already set (e.g. back button cache)
    if (typeof updatePricePreview === 'function') {
      updatePricePreview();
    }
  } catch (error) {
    console.error("Error loading packages:", error);
  }

  // ── Flatpickr Date Pickers ────────────────────────────────
  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const checkInPicker = flatpickr('#check_in', {
    minDate: 'today',
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'F j, Y',
    disableMobile: false,
    onChange: (dates) => {
      if (dates[0]) {
        const next = new Date(dates[0]);
        next.setDate(next.getDate() + 1);
        checkOutPicker.set('minDate', next);
        checkOutPicker.clear();
        updatePricePreview();
      }
    }
  });

  const checkOutPicker = flatpickr('#check_out', {
    minDate: tomorrow,
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'F j, Y',
    disableMobile: false,
    onChange: () => updatePricePreview(),
  });

  // ── Price Preview ─────────────────────────────────────────
  const packageSelect  = document.getElementById('package_type');
  const pricePreview   = document.getElementById('pricePreview');
  const priceAmount    = document.getElementById('priceAmount');
  const priceDays      = document.getElementById('priceDays');

  const updatePricePreview = () => {
    const pkg      = packageSelect?.value;
    const checkIn  = document.getElementById('check_in')?.value;
    const checkOut = document.getElementById('check_out')?.value;

    if (!pkg || !checkIn || !checkOut) {
      pricePreview?.classList.add('hidden');
      return;
    }

    const d1    = new Date(checkIn);
    const d2    = new Date(checkOut);
    const days  = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    const rate  = pricing[pkg] || 0;
    const total = rate * days;

    pricePreview?.classList.remove('hidden');
    if (priceAmount) {
      priceAmount.textContent = 'LKR ' + total.toLocaleString('en-LK');
    }
    if (priceDays) {
      priceDays.textContent = `${days} day${days > 1 ? 's' : ''} × LKR ${rate.toLocaleString('en-LK')} / day`;
    }
  };

  packageSelect?.addEventListener('change', updatePricePreview);

  // ── Form Validation ───────────────────────────────────────
  const validate = (form) => {
    const errors = [];
    const required = ['full_name', 'email', 'phone', 'check_in', 'check_out', 'package_type'];

    required.forEach(field => {
      const el = form.querySelector(`[name="${field}"]`);
      if (!el?.value?.trim()) {
        errors.push(`${field.replace('_', ' ')} is required.`);
        el?.classList.add('border-red-400');
      } else {
        el?.classList.remove('border-red-400');
      }
    });

    const email = form.querySelector('[name="email"]');
    if (email?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      errors.push('Please enter a valid email address.');
      email.classList.add('border-red-400');
    }

    return errors;
  };

  // ── AJAX Submit ───────────────────────────────────────────
  const bookingForm  = document.getElementById('bookingForm');
  const successAlert = document.getElementById('bookingSuccess');
  const errorAlert   = document.getElementById('bookingError');
  const submitBtn    = document.getElementById('submitBtn');
  const btnText      = document.getElementById('btnText');
  const btnLoading   = document.getElementById('btnLoading');

  const showAlert = (type, message) => {
    if (type === 'success') {
      successAlert.textContent = message;
      successAlert.classList.remove('hidden');
      errorAlert.classList.add('hidden');
      successAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      errorAlert.textContent = message;
      errorAlert.classList.remove('hidden');
      successAlert.classList.add('hidden');
    }
  };

  const setLoading = (loading) => {
    submitBtn.disabled = loading;
    if (loading) {
      btnText?.classList.add('hidden');
      btnLoading?.classList.remove('hidden');
      submitBtn.style.opacity = '0.7';
    } else {
      btnText?.classList.remove('hidden');
      btnLoading?.classList.add('hidden');
      submitBtn.style.opacity = '1';
    }
  };

  bookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear old alerts
    successAlert?.classList.add('hidden');
    errorAlert?.classList.add('hidden');

    // Validate
    const errors = validate(bookingForm);
    if (errors.length > 0) {
      showAlert('error', errors[0]);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData(bookingForm);
      const bookingData = Object.fromEntries(formData.entries());
      
      const checkInDate = new Date(bookingData.check_in);
      const checkOutDate = new Date(bookingData.check_out);
      const days = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
      const rate = pricing[bookingData.package_type] || 0;
      
      bookingData.total_price = rate * days;
      bookingData.status = 'pending';
      bookingData.created_at = serverTimestamp();
      bookingData.booking_ref = 'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      await addDoc(collection(db, "bookings"), bookingData);

      // WhatsApp Redirect Logic
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "site_config"));
        let waNumber = "94770000000"; // Fallback
        if (settingsSnap.exists() && settingsSnap.data().whatsapp) {
            // Clean number: remove +, spaces, dashes
            waNumber = settingsSnap.data().whatsapp.replace(/[^0-9]/g, '');
        }
        
        const waText = encodeURIComponent(
`*New Booking Request!* 🏨
*Ref:* ${bookingData.booking_ref}

*Guest Name:* ${bookingData.full_name}
*Check-in:* ${bookingData.check_in}
*Check-out:* ${bookingData.check_out}
*Package:* ${bookingData.package_type}
*Price:* LKR ${bookingData.total_price.toLocaleString('en-LK')}

*Phone:* ${bookingData.phone}
*Email:* ${bookingData.email}

Please confirm this booking.`
        );

        // Open WhatsApp in a new tab
        window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
      } catch (waError) {
        console.error("WhatsApp redirect failed:", waError);
      }

      showAlert('success',
        `✦ Thank you! Your reservation request has been received. Reference: ${bookingData.booking_ref}. We will confirm within 24 hours. **You will receive our reply via WhatsApp and Email.**`
      );
      bookingForm.reset();
      checkInPicker.clear();
      checkOutPicker.clear();
      pricePreview?.classList.add('hidden');
    } catch (err) {
      console.error(err);
      showAlert('error', 'Error submitting booking. Please try again or contact us directly.');
    } finally {
      setLoading(false);
    }
  });

  // Clear red borders on input
  bookingForm?.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('border-red-400'));
    el.addEventListener('change', () => el.classList.remove('border-red-400'));
  });

});
