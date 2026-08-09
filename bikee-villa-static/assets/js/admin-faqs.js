import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById('faqForm');
const addBtn = document.getElementById('addBtn');
const faqsList = document.getElementById('faqsList');

// Handle Add
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const questionInput = document.getElementById('questionInput');
        const answerInput = document.getElementById('answerInput');
        
        try {
            addBtn.textContent = 'Saving...';
            addBtn.disabled = true;

            await addDoc(collection(db, "faqs"), {
                question: questionInput.value,
                answer: answerInput.value,
                created_at: new Date().toISOString()
            });

            form.reset();
            loadFAQs(); 
            
        } catch (error) {
            console.error('Save failed:', error);
            alert('Error adding FAQ: ' + error.message);
        } finally {
            addBtn.textContent = '✦ Add FAQ';
            addBtn.disabled = false;
        }
    });
}

// Load
async function loadFAQs() {
    if (!faqsList) return;
    
    try {
        const q = query(collection(db, "faqs"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);
        
        faqsList.innerHTML = ''; 
        
        if (querySnapshot.empty) {
            faqsList.innerHTML = `
                <div class="py-10 text-center text-parchment/30 font-classic tracking-wider">
                    <p>No FAQs added yet.</p>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const faq = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.className = "bg-parchment/5 rounded p-4 border border-gold/10 flex flex-col md:flex-row gap-4 justify-between group hover:border-gold/30 transition-colors";
            card.innerHTML = `
                <div class="flex-1">
                    <h3 class="font-display text-gold font-bold mb-2">Q: ${faq.question}</h3>
                    <p class="text-parchment/70 font-classic text-sm">A: ${faq.answer}</p>
                </div>
                <div class="flex items-start">
                    <button class="text-red-400 hover:text-red-500 font-classic text-sm px-4 py-2 border border-red-900/30 rounded delete-btn" data-id="${id}">Delete</button>
                </div>
            `;
            faqsList.appendChild(card);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this FAQ?')) {
                    const id = e.target.dataset.id;
                    try {
                        await deleteDoc(doc(db, "faqs", id));
                        loadFAQs(); 
                    } catch(err) {
                        console.error(err);
                        alert('Error deleting: ' + err.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error("Error loading FAQs:", error);
        faqsList.innerHTML = `<p class="text-red-400 p-4">Error loading: ${error.message}</p>`;
    }
}

// Initial load
loadFAQs();
