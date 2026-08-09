import { db } from "./firebase.js";
import { requireAuth } from "./admin-auth.js";
requireAuth(['Admin']);
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById('testimonialForm');
const addBtn = document.getElementById('addBtn');
const testimonialsList = document.getElementById('testimonialsList');

// Handle Add
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('nameInput');
        const locationInput = document.getElementById('locationInput');
        const ratingInput = document.getElementById('ratingInput');
        const textInput = document.getElementById('textInput');
        
        try {
            addBtn.textContent = 'Saving...';
            addBtn.disabled = true;

            await addDoc(collection(db, "testimonials"), {
                name: nameInput.value,
                location: locationInput.value,
                rating: parseInt(ratingInput.value),
                text: textInput.value,
                created_at: new Date().toISOString()
            });

            form.reset();
            loadTestimonials(); 
            
        } catch (error) {
            console.error('Save failed:', error);
            alert('Error adding testimonial: ' + error.message);
        } finally {
            addBtn.textContent = '✦ Add Testimonial';
            addBtn.disabled = false;
        }
    });
}

// Load
async function loadTestimonials() {
    if (!testimonialsList) return;
    
    try {
        const q = query(collection(db, "testimonials"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);
        
        testimonialsList.innerHTML = ''; 
        
        if (querySnapshot.empty) {
            testimonialsList.innerHTML = `
                <div class="py-10 text-center text-parchment/30 font-classic tracking-wider">
                    <p>No testimonials added yet.</p>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const review = docSnap.data();
            const id = docSnap.id;
            
            // Create stars string
            const stars = '★'.repeat(review.rating || 5) + '☆'.repeat(5 - (review.rating || 5));
            
            const card = document.createElement('div');
            card.className = "bg-parchment/5 rounded p-4 border border-gold/10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group hover:border-gold/30 transition-colors";
            card.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="font-display text-gold font-bold">${review.name}</span>
                        <span class="text-parchment/40 text-xs font-classic">${review.location || ''}</span>
                        <span class="text-gold-light text-xs tracking-widest">${stars}</span>
                    </div>
                    <p class="text-parchment/70 font-classic text-sm italic">"${review.text}"</p>
                </div>
                <button class="text-red-400 hover:text-red-500 font-classic text-sm px-4 py-2 border border-red-900/30 rounded delete-btn" data-id="${id}">Delete</button>
            `;
            testimonialsList.appendChild(card);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this testimonial?')) {
                    const id = e.target.dataset.id;
                    try {
                        await deleteDoc(doc(db, "testimonials", id));
                        loadTestimonials(); 
                    } catch(err) {
                        console.error(err);
                        alert('Error deleting: ' + err.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error("Error loading testimonials:", error);
        testimonialsList.innerHTML = `<p class="text-red-400 p-4">Error loading: ${error.message}</p>`;
    }
}

// Initial load
loadTestimonials();
