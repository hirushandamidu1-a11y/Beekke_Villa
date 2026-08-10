import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Auto-redirect if already logged in when visiting login.html
if (window.location.pathname.endsWith('login.html')) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace('index.html');
    }
  });
}

// Handle Login Form Submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const spinner = document.getElementById('loginSpinner');
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // UI Loading state
    btn.disabled = true;
    spinner.classList.remove('hidden');
    errorMsg.classList.add('hidden');

    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch User Role from Firestore
      let role = 'Admin'; // Default role fallback
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role) {
          role = userDoc.data().role;
        }
      } catch (err) {
        console.warn("Could not fetch user document, proceeding with default role:", err);
      }

      // Store role locally for UI rendering
      sessionStorage.setItem('adminRole', role);

      // 3. Redirect to Dashboard
      window.location.replace('index.html');

    } catch (error) {
      console.error(error);
      errorMsg.classList.remove('hidden');
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
         errorText.innerText = 'Invalid email or password.';
      } else {
         errorText.innerText = error.message || 'Login failed. Please check your credentials.';
      }
    } finally {
      // Restore UI
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

// Global function to bind logout buttons across all pages
export function setupLogout() {
  document.querySelectorAll('#logoutBtn, [data-action="logout"]').forEach((btn) => {
    if (btn.dataset.logoutBound === 'true') return;
    btn.dataset.logoutBound = 'true';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Logout error:", err);
      }
      sessionStorage.removeItem('adminRole');
      
      const currentPath = window.location.pathname;
      let prefix = '';
      if (currentPath.includes('/admin/')) {
        const subPath = currentPath.split('/admin/')[1] || '';
        const depth = subPath.split('/').filter(Boolean).length - 1;
        prefix = '../'.repeat(Math.max(0, depth));
      }
      window.location.replace(`${prefix}login.html`);
    });
  });
}

// Notification System Engine for Check-outs and Stay Completions
export async function initNotificationSystem() {
  const notifBtn = document.getElementById('notifBellBtn');
  const notifBadge = document.getElementById('notifBadge');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifList = document.getElementById('notifList');

  if (!notifBtn || !notifDropdown || !notifList) return;

  // Toggle Dropdown
  if (!notifBtn.dataset.bound) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.add('hidden');
      }
    });
    notifBtn.dataset.bound = 'true';
  }

  try {
    const querySnapshot = await getDocs(collection(db, "bookings"));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = today.toISOString().split('T')[0];

    const todayCheckouts = [];
    const recentCompletions = [];

    function parseDate(dateVal) {
      if (!dateVal) return null;
      if (typeof dateVal === 'object' && dateVal.seconds) return new Date(dateVal.seconds * 1000);
      if (typeof dateVal === 'string' && dateVal.includes('-')) {
          const parts = dateVal.split('T')[0].split('-');
          if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? null : d;
    }

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.check_out || data.status === 'rejected' || data.status === 'cancelled') return;

      const checkOutDate = parseDate(data.check_out);
      if (!checkOutDate) return;
      
      checkOutDate.setHours(0, 0, 0, 0);
      const checkOutStr = checkOutDate.toISOString().split('T')[0];

      const guestName = data.first_name || data.full_name || 'Guest';
      const ref = data.booking_ref || 'BK-';

      if (checkOutStr === todayStr) {
        todayCheckouts.push({ id: docSnap.id, guestName, ref, ...data });
      } else if (checkOutDate < today && data.status === 'approved') {
        recentCompletions.push({ id: docSnap.id, guestName, ref, ...data });
      }
    });

    const totalAlerts = todayCheckouts.length + recentCompletions.length;

    if (totalAlerts > 0 && notifBadge) {
      notifBadge.textContent = totalAlerts;
      notifBadge.classList.remove('hidden');
    } else if (notifBadge) {
      notifBadge.classList.add('hidden');
    }

    if (totalAlerts === 0) {
      notifList.innerHTML = `<div class="p-4 text-center text-parchment/40 text-xs font-classic tracking-wider">No active check-out alerts today.</div>`;
      return;
    }

    let itemsHTML = '';

    todayCheckouts.forEach(b => {
      itemsHTML += `
        <div class="p-3 bg-yellow-500/10 border-l-2 border-yellow-500 rounded text-xs font-body mb-2 hover:bg-yellow-500/20 transition-colors cursor-pointer" onclick="location.href='${location.pathname.includes('/admin/bookings/') ? 'index.html' : 'bookings/index.html'}'">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-yellow-300">🔔 Check-out Today!</span>
            <span class="text-[0.65rem] text-gold/60 font-classic">${b.ref}</span>
          </div>
          <p class="text-parchment/90 font-medium">${b.guestName} check-out date is today.</p>
          <p class="text-parchment/50 text-[0.7rem] mt-0.5">${b.phone || b.email || ''}</p>
        </div>
      `;
    });

    recentCompletions.forEach(b => {
      const coStr = new Date(b.check_out).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      itemsHTML += `
        <div class="p-3 bg-purple-500/10 border-l-2 border-purple-500 rounded text-xs font-body mb-2 hover:bg-purple-500/20 transition-colors cursor-pointer" onclick="location.href='${location.pathname.includes('/admin/bookings/') ? 'index.html' : 'bookings/index.html'}'">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-purple-300">🎉 Stay Completed</span>
            <span class="text-[0.65rem] text-gold/60 font-classic">${b.ref}</span>
          </div>
          <p class="text-parchment/90 font-medium">${b.guestName} check-out ended on ${coStr}.</p>
        </div>
      `;
    });

    notifList.innerHTML = itemsHTML;

  } catch (err) {
    console.error("Error fetching notification items:", err);
  }
}

// Function to enforce authentication and RBAC on Admin Pages with anti-flash security overlay
export function requireAuth(allowedRoles = ['Admin', 'Manager']) {
  // Create anti-flash loading overlay if not already present
  let overlay = document.getElementById('authLoadingOverlay');
  if (!overlay && document.body) {
    overlay = document.createElement('div');
    overlay.id = 'authLoadingOverlay';
    overlay.className = 'fixed inset-0 bg-[#1B0000] z-[9999] flex flex-col items-center justify-center text-[#D4AF37] font-serif transition-opacity duration-300';
    overlay.innerHTML = `
      <div class="animate-spin mb-4 text-4xl">✦</div>
      <p class="text-xs tracking-[0.3em] uppercase text-[#FDF5E6]/70">Authenticating Access...</p>
    `;
    document.body.appendChild(overlay);
  }

  // Setup logout buttons & notification engine when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupLogout();
    });
  } else {
    setupLogout();
  }

  onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    let prefix = '';
    if (currentPath.includes('/admin/')) {
      const subPath = currentPath.split('/admin/')[1] || '';
      const depth = subPath.split('/').filter(Boolean).length - 1;
      prefix = '../'.repeat(Math.max(0, depth));
    }

    if (!user) {
      // Not logged in -> Immediately redirect to login page
      window.location.replace(`${prefix}login.html`);
      return;
    }

    // Fetch Role Authorization from Firestore
    let userRole = sessionStorage.getItem('adminRole') || 'Admin';
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().role) {
        userRole = userDoc.data().role;
      }
    } catch (err) {
      console.warn("Error fetching user role from Firestore:", err);
    }

    // Save/Update session storage
    sessionStorage.setItem('adminRole', userRole);

    const currentUserDisplay = document.getElementById('currentUserDisplay');
    if (currentUserDisplay) {
      currentUserDisplay.textContent = `${user.email} (${userRole})`;
    }

    // Apply UI restrictions globally based on role
    applyRoleUI(userRole);
    setupLogout();
    initNotificationSystem();

    if (!allowedRoles.includes(userRole)) {
      // User is logged in but doesn't have permission for this specific page
      alert('You do not have permission to view this page.');
      window.location.replace(`${prefix}index.html`); // Send back to dashboard
      return;
    }

    // Auth succeeded -> Fade out and remove loading overlay
    const overlay = document.getElementById('authLoadingOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  });
}

// Function to hide restricted sidebar elements based on Role
function applyRoleUI(role) {
  if (role === 'Manager') {
    const settingsLink = document.querySelector('a[href*="settings"]');
    if (settingsLink) settingsLink.style.display = 'none';

    const usersLink = document.querySelector('a[href*="users"]');
    if (usersLink) usersLink.style.display = 'none';

    const packagesLink = document.querySelector('a[href*="packages"]');
    if (packagesLink) packagesLink.style.display = 'none';

    const testimonialsLink = document.querySelector('a[href*="testimonials"]');
    if (testimonialsLink) testimonialsLink.style.display = 'none';
    
    const faqsLink = document.querySelector('a[href*="faqs"]');
    if (faqsLink) faqsLink.style.display = 'none';

    const expLink = document.querySelector('a[href*="experiences"]');
    if (expLink) expLink.style.display = 'none';
  }
}
