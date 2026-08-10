import { db } from "./firebase.js";
import { requireAuth } from "./admin-auth.js";
requireAuth(['Admin']); // Replaced by PIN lock as requested

import { collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase config (Same as main app)
const firebaseConfig = {
  apiKey: "AIzaSyDbUyZCitEVeKr2Y_TQd2-jIAwEx5D72rU",
  authDomain: "beekke-villa-galle-4620d.firebaseapp.com",
  databaseURL: "https://beekke-villa-galle-4620d-default-rtdb.firebaseio.com",
  projectId: "beekke-villa-galle-4620d",
  storageBucket: "beekke-villa-galle-4620d.firebasestorage.app",
  messagingSenderId: "665335733503",
  appId: "1:665335733503:web:6e8fccd098b11a636540ca",
  measurementId: "G-1H21EQPX9X"
};

// Initialize a secondary app so creating a user doesn't log the Admin out!
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

const addUserForm = document.getElementById('addUserForm');
const saveBtn = document.getElementById('saveUserBtn');
const saveStatus = document.getElementById('saveStatus');
const usersTableBody = document.getElementById('usersTableBody');

// Load Users
async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        usersTableBody.innerHTML = '';
        
        if (querySnapshot.empty) {
            usersTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-parchment/50">No users found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = 'group hover:bg-gold/5 transition-colors';
            tr.innerHTML = `
                <td class="py-4 px-4">
                    <div class="text-parchment font-semibold">${user.email}</div>
                    <div class="text-parchment/50 text-xs">${docSnap.id}</div>
                </td>
                <td class="py-4 px-4">
                    <span class="px-3 py-1 rounded-full text-xs tracking-widest uppercase font-classic ${user.role === 'Admin' ? 'bg-gold/20 text-gold' : 'bg-parchment/10 text-parchment'}">${user.role}</span>
                </td>
                <td class="py-4 px-4 text-right">
                    <button onclick="deleteUser('${docSnap.id}')" class="text-red-400 hover:text-red-300 font-classic text-xs tracking-widest uppercase transition-colors">Remove Role</button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading users: ", error);
        usersTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-red-400">Error loading users. Check console.</td></tr>';
    }
}

// Add User
if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('userEmail').value;
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;

        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Creating...';
        saveStatus.classList.add('hidden');

        try {
            // 1. Create User in Firebase Auth using the Secondary App
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            // 2. Save role in Firestore
            await setDoc(doc(db, "users", newUser.uid), {
                email: email,
                role: role,
                created_at: new Date()
            });

            // Reset secondary auth so we don't hold the session
            await secondaryAuth.signOut();

            // Reset Form & Update UI
            addUserForm.reset();
            saveStatus.classList.remove('hidden');
            setTimeout(() => saveStatus.classList.add('hidden'), 3000);
            
            // Reload table
            loadUsers();

        } catch (error) {
            console.error("Error creating user: ", error);
            alert(`Error: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Create User';
        }
    });
}

// Delete User Role (Note: This doesn't delete the Auth account in Client SDK, just the role, which effectively blocks access)
window.deleteUser = async (uid) => {
    if(confirm("Are you sure you want to remove this user's role? They will lose access to the Admin Panel.")) {
        try {
            await deleteDoc(doc(db, "users", uid));
            loadUsers();
        } catch(error) {
            console.error("Error deleting user: ", error);
            alert("Could not remove user role.");
        }
    }
}

// Initialize
loadUsers();
