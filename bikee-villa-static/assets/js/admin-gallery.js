import { db } from "./firebase.js";
import { requireAuth } from "./admin-auth.js";
requireAuth(['Admin', 'Manager']);
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const IMGBB_API_KEY = "b0b14f09f4ec988d05c5de896a3d976b"; // ImgBB API Key provided by user

const form = document.getElementById('uploadForm');
const uploadBtn = document.getElementById('uploadBtn');
const galleryGrid = document.getElementById('galleryGrid');

// Handle Upload
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('imageInput');
        const titleInput = document.getElementById('titleInput');
        const categoryInput = document.getElementById('categoryInput');
        
        const file = fileInput.files[0];
        if (!file) return;

        try {
            uploadBtn.textContent = 'Uploading...';
            uploadBtn.disabled = true;

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
            await addDoc(collection(db, "gallery"), {
                url: imageUrl,
                filename: file.name,
                title: titleInput.value || file.name,
                category: categoryInput.value,
                created_at: new Date().toISOString()
            });

            alert('Image uploaded successfully!');
            form.reset();
            loadGallery(); // Refresh the grid
            
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            uploadBtn.textContent = '✦ Upload';
            uploadBtn.disabled = false;
        }
    });
}

// Load Gallery
async function loadGallery() {
    if (!galleryGrid) return;
    
    try {
        const q = query(collection(db, "gallery"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);
        
        galleryGrid.innerHTML = ''; // Clear loading message
        
        if (querySnapshot.empty) {
            galleryGrid.innerHTML = `
                <div class="col-span-full py-16 text-center text-parchment/30 font-classic tracking-wider">
                    <p class="text-4xl mb-4">🖼️</p>
                    <p>No images uploaded yet. Use the form above to add your first image.</p>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const img = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.className = "group relative bg-parchment/5 rounded overflow-hidden border border-gold/10 hover:border-gold/30 transition-all";
            card.innerHTML = `
                <div class="aspect-square overflow-hidden">
                    <img src="${img.url}" alt="${img.title}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <!-- Overlay on hover -->
                <div class="absolute inset-0 bg-woods-dark/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3">
                    <p class="text-parchment text-sm font-classic tracking-wider text-center px-3">${img.title}</p>
                    <span class="badge badge-approved text-xs">${img.category}</span>
                    <button class="btn-sm btn-delete delete-btn" data-id="${id}">🗑 Delete</button>
                </div>
                <!-- Info bar -->
                <div class="px-3 py-2 border-t border-gold/10">
                    <p class="text-parchment/60 text-xs font-classic truncate">${img.title}</p>
                    <p class="text-parchment/30 text-xs">${img.category}</p>
                </div>
            `;
            galleryGrid.appendChild(card);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this image from the gallery?')) {
                    const id = e.target.dataset.id;
                    try {
                        // Delete from Firestore only (ImgBB hosts the file for free permanently)
                        await deleteDoc(doc(db, "gallery", id));
                        loadGallery(); // Refresh
                    } catch(err) {
                        console.error(err);
                        alert('Error deleting: ' + err.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error("Error loading gallery:", error);
        galleryGrid.innerHTML = `<p class="col-span-full text-red-400 p-4">Error loading images: ${error.message}</p>`;
    }
}

// Initial load
loadGallery();
