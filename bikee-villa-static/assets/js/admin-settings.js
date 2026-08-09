import { db } from "./firebase.js";
import { requireAuth } from "./admin-auth.js";
requireAuth(['Admin']);
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById('settingsForm');
const saveBtn = document.getElementById('saveBtn');
const saveMessage = document.getElementById('saveMessage');

// Settings Document Reference
const settingsRef = doc(db, "settings", "site_config");

// Form Inputs
const inputs = {
    email: document.getElementById('emailInput'),
    phone: document.getElementById('phoneInput'),
    whatsapp: document.getElementById('whatsappInput'),
    price: document.getElementById('priceInput'),
    address: document.getElementById('addressInput'),
    facebook: document.getElementById('facebookInput'),
    instagram: document.getElementById('instagramInput')
};

// Load existing settings
async function loadSettings() {
    try {
        const docSnap = await getDoc(settingsRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.email) inputs.email.value = data.email;
            if (data.phone) inputs.phone.value = data.phone;
            if (data.whatsapp) inputs.whatsapp.value = data.whatsapp;
            if (data.price) inputs.price.value = data.price;
            if (data.address) inputs.address.value = data.address;
            if (data.facebook) inputs.facebook.value = data.facebook;
            if (data.instagram) inputs.instagram.value = data.instagram;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// Save settings
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        
        const configData = {
            email: inputs.email.value,
            phone: inputs.phone.value,
            whatsapp: inputs.whatsapp.value,
            price: inputs.price.value,
            address: inputs.address.value,
            facebook: inputs.facebook.value,
            instagram: inputs.instagram.value,
            updated_at: new Date().toISOString()
        };
        
        // Merge true so we don't accidentally wipe out unmanaged fields if any
        await setDoc(settingsRef, configData, { merge: true });
        
        // Show success message
        saveMessage.classList.remove('hidden');
        setTimeout(() => {
            saveMessage.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error("Error saving settings:", error);
        alert('Error saving settings: ' + error.message);
    } finally {
        saveBtn.textContent = '✦ Save Settings';
        saveBtn.disabled = false;
    }
});

// Initial load
loadSettings();
