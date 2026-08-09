import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      let role = 'Manager'; // Default safe role
      if (userDoc.exists()) {
        role = userDoc.data().role;
      } else {
        // If user document doesn't exist, we can't verify they are authorized for the admin panel.
        // But for the very first setup, we might want to allow it or force creation.
        // For security, if they don't exist in the users collection, sign them out.
        // UNLESS it's the main admin. Let's handle this securely.
        console.warn("User document not found in 'users' collection.");
      }

      // Store role locally for UI rendering
      sessionStorage.setItem('adminRole', role);

      // 3. Redirect to Dashboard
      window.location.href = 'index.html';

    } catch (error) {
      console.error(error);
      errorMsg.classList.remove('hidden');
      if(error.code === 'auth/invalid-credential') {
         errorText.innerText = 'Invalid email or password.';
      } else {
         errorText.innerText = error.message;
      }
    } finally {
      // Restore UI
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

// Handle Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
    sessionStorage.removeItem('adminRole');
    window.location.href = 'login.html'; // Adjust path if needed
  });
}

// Function to enforce authentication and RBAC on Admin Pages
export function requireAuth(allowedRoles = ['Admin', 'Manager']) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not logged in -> Redirect to login
      const currentPath = window.location.pathname;
      if (currentPath.includes('/admin/')) {
        // We might be in a subfolder like /admin/settings/
        const depth = currentPath.split('/admin/')[1].split('/').length - 1;
        const prefix = '../'.repeat(depth);
        window.location.href = `${prefix}login.html`;
      }
      return;
    }

    // Check Role Authorization
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let userRole = 'Manager'; // default fallback
    if (userDoc.exists()) {
      userRole = userDoc.data().role;
    }

    // Save/Update session storage
    sessionStorage.setItem('adminRole', userRole);

    // Apply UI restrictions globally based on role
    applyRoleUI(userRole);

    if (!allowedRoles.includes(userRole)) {
      // User is logged in but doesn't have permission for this specific page
      alert('You do not have permission to view this page.');
      const depth = window.location.pathname.split('/admin/')[1].split('/').length - 1;
      const prefix = '../'.repeat(depth);
      window.location.href = `${prefix}index.html`; // Send back to dashboard
    }
  });
}

// Function to hide restricted sidebar elements based on Role
function applyRoleUI(role) {
  if (role === 'Manager') {
    // Hide Settings
    const settingsLink = document.querySelector('a[href*="settings"]');
    if (settingsLink) settingsLink.style.display = 'none';

    // Hide Users
    const usersLink = document.querySelector('a[href*="users"]');
    if (usersLink) usersLink.style.display = 'none';

    // Hide Packages
    const packagesLink = document.querySelector('a[href*="packages"]');
    if (packagesLink) packagesLink.style.display = 'none';

    // Hide Testimonials, FAQs, Experiences (if strictly requested)
    const testimonialsLink = document.querySelector('a[href*="testimonials"]');
    if (testimonialsLink) testimonialsLink.style.display = 'none';
    
    const faqsLink = document.querySelector('a[href*="faqs"]');
    if (faqsLink) faqsLink.style.display = 'none';

    const expLink = document.querySelector('a[href*="experiences"]');
    if (expLink) expLink.style.display = 'none';
  }
}
