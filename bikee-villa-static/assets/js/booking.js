/**
 * Bikee Villa — Booking Form JavaScript
 * Handles: date pickers, price preview, AJAX submission
 */

import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  // ── Pricing data (injected from PHP) ──────────────────────
  const pricing = window.bikeePricing || {
    family_nonac: 25000, family_ac: 30000,
    family_cook_nonac: 30000, family_cook_ac: 35000,
    suite_function: 7500
  };

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
