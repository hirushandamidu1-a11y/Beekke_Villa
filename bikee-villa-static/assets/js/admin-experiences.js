import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const IMGBB_API_KEY = "b0b14f09f4ec988d05c5de896a3d976b";

const form = document.getElementById('experienceForm');
const addBtn = document.getElementById('addBtn');
const experiencesGrid = document.getElementById('experiencesGrid');

// Handle Add
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const titleInput = document.getElementById('titleInput');
        const descInput = document.getElementById('descInput');
        const fileInput = document.getElementById('imageInput');
        
        const file = fileInput.files[0];
        if (!file) return;

        try {
            addBtn.textContent = 'Uploading...';
            addBtn.disabled = true;

            // 1. Upload to ImgBB
            const formData = new FormData();
            formData.append('image', file);

            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            const imgbbResult = await imgbbResponse.json();

            if (!imgbbResult.success) {
                throw new Error(imgbbResult.error?.message || 'ImgBB upload failed');
            }

            const imageUrl = imgbbResult.data.url;
            
            // 2. Save to Firestore
            await addDoc(collection(db, "experiences"), {
                title: titleInput.value,
                description: descInput.value,
                image_url: imageUrl,
                created_at: new Date().toISOString()
            });

            form.reset();
            document.getElementById('fileName').textContent = "Click to browse or drag & drop";
            loadExperiences(); // Refresh
            
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Error adding experience: ' + error.message);
        } finally {
            addBtn.textContent = '✦ Add Experience';
            addBtn.disabled = false;
        }
    });
}

// Load Experiences
async function loadExperiences() {
    if (!experiencesGrid) return;
    
    try {
        const q = query(collection(db, "experiences"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);
        
        experiencesGrid.innerHTML = ''; 
        
        if (querySnapshot.empty) {
            experiencesGrid.innerHTML = `
                <div class="col-span-full py-10 text-center text-parchment/30 font-classic tracking-wider">
                    <p>No experiences added yet.</p>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const exp = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.className = "bg-parchment/5 rounded overflow-hidden border border-gold/10 flex flex-col";
            card.innerHTML = `
                <div class="h-48 overflow-hidden relative">
                    <img src="${exp.image_url}" alt="${exp.title}" class="w-full h-full object-cover" />
                    <button class="absolute top-2 right-2 bg-red-900/80 text-parchment hover:bg-red-600 p-2 rounded-full delete-btn transition-colors" data-id="${id}" title="Delete">🗑</button>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-display text-lg text-gold mb-2">${exp.title}</h3>
                    <p class="text-parchment/70 font-classic text-sm line-clamp-3">${exp.description}</p>
                </div>
            `;
            experiencesGrid.appendChild(card);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this experience?')) {
                    // Get closest button in case they clicked inner span/icon
                    const id = e.currentTarget.dataset.id;
                    try {
                        await deleteDoc(doc(db, "experiences", id));
                        loadExperiences(); 
                    } catch(err) {
                        console.error(err);
                        alert('Error deleting: ' + err.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error("Error loading experiences:", error);
        experiencesGrid.innerHTML = `<p class="col-span-full text-red-400 p-4">Error loading: ${error.message}</p>`;
    }
}

// Initial load
loadExperiences();
