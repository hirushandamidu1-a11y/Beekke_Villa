import { db } from "./firebase.js";
import { requireAuth } from "./admin-auth.js";
requireAuth(['Admin']); // Only Admins can manage packages

import { collection, addDoc, getDocs, setDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById('packageForm');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveStatus = document.getElementById('saveStatus');
const container = document.getElementById('packagesContainer');
const formTitle = document.getElementById('formTitle');

// Initial seed data if empty
const seedData = [
    {
        codeName: "family_nonac",
        title: "Family / Event Package",
        subtitle: "Non-Air Conditioned · 1 Day",
        price: 25000,
        icon: "🏡",
        isFeatured: false,
        isSmallCard: false,
        features: ["Exclusive villa access", "All 5 rooms", "Up to 12 guests", "Kitchen access"],
        order: 1
    },
    {
        codeName: "family_ac",
        title: "Family / Event Package",
        subtitle: "Air Conditioned · 1 Day",
        price: 30000,
        icon: "❄️",
        isFeatured: true,
        isSmallCard: false,
        features: ["Exclusive villa access", "All 5 rooms with AC", "Up to 12 guests", "Kitchen access"],
        order: 2
    },
    {
        codeName: "suite_function",
        title: "Suite / Function Package",
        subtitle: "Events & Functions",
        price: 7500,
        icon: "🎭",
        isFeatured: false,
        isSmallCard: false,
        features: ["Suite room access", "Function hall", "Ideal for events", "Flexible arrangements"],
        order: 3
    },
    {
        codeName: "family_cook_nonac",
        title: "With Cook · Non-AC",
        subtitle: "Full catering included",
        price: 30000,
        icon: "👨‍🍳",
        isFeatured: false,
        isSmallCard: true,
        features: [],
        order: 4
    },
    {
        codeName: "family_cook_ac",
        title: "With Cook · AC",
        subtitle: "Full catering + AC",
        price: 35000,
        icon: "👨‍🍳",
        isFeatured: false,
        isSmallCard: true,
        features: [],
        order: 5
    }
];

let allPackages = [];

async function loadPackages() {
    try {
        const q = query(collection(db, "packages"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        
        // Auto-seed if completely empty
        if (snapshot.empty) {
            console.log("No packages found. Seeding initial data...");
            for (let pkg of seedData) {
                await setDoc(doc(db, "packages", pkg.codeName), pkg);
            }
            // reload
            return loadPackages();
        }

        allPackages = [];
        container.innerHTML = '';
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            allPackages.push({ id: docSnap.id, ...data });
            
            const card = document.createElement('div');
            card.className = `p-6 rounded-sm border ${data.isFeatured ? 'bg-gold/10 border-gold' : 'bg-woods border-gold/20'} flex flex-col relative`;
            
            let featureList = data.features && data.features.length > 0 
                ? `<ul class="text-xs text-parchment/70 space-y-1 mb-4 flex-1">
                    ${data.features.map(f => `<li>• ${f}</li>`).join('')}
                   </ul>`
                : `<div class="flex-1"></div>`;

            card.innerHTML = `
                ${data.isFeatured ? '<span class="absolute top-2 right-2 text-[10px] bg-gold text-woods px-2 py-0.5 rounded uppercase font-classic font-bold tracking-widest">Featured</span>' : ''}
                ${data.isSmallCard ? '<span class="absolute top-2 left-2 text-[10px] bg-woods-light text-parchment/50 px-2 py-0.5 rounded uppercase font-classic tracking-widest border border-gold/10">Small Card</span>' : ''}
                
                <div class="text-3xl mb-2">${data.icon}</div>
                <h3 class="font-display text-lg text-parchment font-semibold">${data.title}</h3>
                <p class="font-classic text-[10px] text-parchment/50 uppercase tracking-widest mb-3">${data.subtitle}</p>
                
                <div class="font-display text-2xl font-bold text-gold mb-3">Rs. ${data.price}</div>
                
                ${featureList}
                
                <div class="flex items-center gap-3 mt-4 pt-4 border-t border-gold/10">
                    <button onclick="editPackage('${docSnap.id}')" class="text-gold hover:text-gold-light font-classic text-xs tracking-widest uppercase transition-colors">Edit</button>
                    <button onclick="deletePackage('${docSnap.id}')" class="text-red-400 hover:text-red-300 font-classic text-xs tracking-widest uppercase transition-colors ml-auto">Delete</button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading packages:", error);
        container.innerHTML = '<p class="text-red-400">Error loading packages.</p>';
    }
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';
        saveStatus.classList.add('hidden');

        const id = document.getElementById('packageId').value;
        const codeName = document.getElementById('codeName').value.trim();
        const docId = id || codeName; // use existing ID or new code name
        
        const packageData = {
            codeName: docId,
            title: document.getElementById('title').value.trim(),
            subtitle: document.getElementById('subtitle').value.trim(),
            price: Number(document.getElementById('price').value),
            icon: document.getElementById('icon').value.trim(),
            isFeatured: document.getElementById('isFeatured').checked,
            isSmallCard: document.getElementById('isSmallCard').checked,
            features: document.getElementById('features').value.split('\n').map(f => f.trim()).filter(f => f !== ''),
            order: id ? allPackages.find(p => p.id === id)?.order || 99 : allPackages.length + 1
        };

        try {
            await setDoc(doc(db, "packages", docId), packageData);
            
            resetForm();
            saveStatus.classList.remove('hidden');
            setTimeout(() => saveStatus.classList.add('hidden'), 3000);
            loadPackages();
        } catch (error) {
            console.error("Error saving package:", error);
            alert("Failed to save package.");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Package';
        }
    });
}

window.editPackage = (id) => {
    const pkg = allPackages.find(p => p.id === id);
    if (!pkg) return;

    document.getElementById('packageId').value = id;
    document.getElementById('codeName').value = pkg.codeName;
    document.getElementById('codeName').disabled = true; // don't allow changing ID after creation
    document.getElementById('title').value = pkg.title;
    document.getElementById('subtitle').value = pkg.subtitle;
    document.getElementById('price').value = pkg.price;
    document.getElementById('icon').value = pkg.icon;
    document.getElementById('isFeatured').checked = pkg.isFeatured || false;
    document.getElementById('isSmallCard').checked = pkg.isSmallCard || false;
    document.getElementById('features').value = (pkg.features || []).join('\n');

    formTitle.innerText = "Edit Package";
    cancelBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deletePackage = async (id) => {
    if (confirm("Are you sure you want to delete this package? This will remove it from the live website immediately.")) {
        try {
            await deleteDoc(doc(db, "packages", id));
            loadPackages();
        } catch (error) {
            console.error("Error deleting package:", error);
            alert("Failed to delete.");
        }
    }
};

window.resetForm = () => {
    form.reset();
    document.getElementById('packageId').value = '';
    document.getElementById('codeName').disabled = false;
    formTitle.innerText = "Add New Package";
    cancelBtn.classList.add('hidden');
};

loadPackages();
