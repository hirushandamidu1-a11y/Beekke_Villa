import { db } from "./firebase.js";
import { requireAuth } from "./admin-auth.js";
requireAuth(['Admin', 'Manager']);
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allBookings = [];
let currentFilter = '';
let currentSearch = '';

async function fetchBookings() {
    try {
        const q = query(collection(db, "bookings"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);
        
        allBookings = [];
        querySnapshot.forEach(docSnap => {
            allBookings.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        updateUI();
    } catch (error) {
        console.error("Error fetching bookings:", error);
        document.getElementById('bookingsTableBody').innerHTML = `<tr><td colspan="8" class="px-4 py-16 text-center text-red-400">Error loading bookings.</td></tr>`;
    }
}

function updateUI() {
    // 1. Calculate Counts
    const counts = { all: allBookings.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    allBookings.forEach(b => {
        if (counts[b.status] !== undefined) counts[b.status]++;
    });

    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-pending').textContent = counts.pending;
    document.getElementById('count-approved').textContent = counts.approved;
    document.getElementById('count-rejected').textContent = counts.rejected;
    document.getElementById('count-cancelled').textContent = counts.cancelled;

    // 2. Filter & Search
    let filtered = allBookings;
    if (currentFilter !== '') {
        filtered = filtered.filter(b => b.status === currentFilter);
    }
    if (currentSearch !== '') {
        const s = currentSearch.toLowerCase();
        filtered = filtered.filter(b => 
            (b.full_name && b.full_name.toLowerCase().includes(s)) ||
            (b.email && b.email.toLowerCase().includes(s)) ||
            (b.booking_ref && b.booking_ref.toLowerCase().includes(s)) ||
            (b.phone && b.phone.toLowerCase().includes(s))
        );
    }

    // 3. Update Table
    const tbody = document.getElementById('bookingsTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-16 text-center text-parchment/30 font-classic tracking-wider">No bookings found.</td></tr>`;
    } else {
        let html = '';
        filtered.forEach(b => {
            const dateStr = b.check_in ? new Date(b.check_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
            const statusBadge = `<span class="badge badge-${b.status}">${(b.status || 'pending').charAt(0).toUpperCase() + (b.status || 'pending').slice(1)}</span>`;
            
            let actions = '';
            if (b.status === 'pending') {
                actions += `
                    <button class="action-btn btn-sm btn-approve mr-1" data-id="${b.id}" data-action="approved" title="Approve">✓</button>
                    <button class="action-btn btn-sm btn-reject mr-1" data-id="${b.id}" data-action="rejected" title="Reject">✗</button>
                `;
            }
            actions += `<button class="action-btn btn-sm btn-delete" data-id="${b.id}" data-action="delete" title="Delete">🗑</button>`;

            html += `
            <tr class="table-row border-b border-gold/5">
                <td class="px-4 py-3"><span class="font-classic text-gold text-sm">${b.booking_ref || '-'}</span></td>
                <td class="px-4 py-3">
                    <p class="text-parchment text-sm">${b.first_name || ''} ${b.last_name || ''}</p>
                    <p class="text-parchment/30 text-xs">${b.email || '-'}</p>
                </td>
                <td class="px-4 py-3 text-parchment/50 text-sm hidden md:table-cell">${b.phone || '-'}</td>
                <td class="px-4 py-3 text-parchment/60 text-sm">${b.package || 'Standard'}</td>
                <td class="px-4 py-3 text-parchment/50 text-xs hidden lg:table-cell">${dateStr}</td>
                <td class="px-4 py-3 font-display text-gold text-sm font-semibold">LKR ${b.total_price ? b.total_price.toLocaleString() : '0'}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3"><div class="flex items-center justify-center">${actions}</div></td>
            </tr>
            `;
        });
        tbody.innerHTML = html;
        attachActionListeners();
    }

    document.getElementById('showingCount').textContent = `${filtered.length} booking(s)`;
}

function attachActionListeners() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;

            if (action === 'delete') {
                if (confirm("Are you sure you want to delete this booking?")) {
                    try {
                        await deleteDoc(doc(db, "bookings", id));
                        fetchBookings(); // Refresh
                    } catch (err) { alert('Error deleting: ' + err.message); }
                }
            } else {
                // Update status
                try {
                    await updateDoc(doc(db, "bookings", id), { status: action });
                    
                    // Trigger WhatsApp and Email to customer
                    const booking = allBookings.find(b => b.id === id);
                    if (booking && booking.phone && booking.email) {
                        const customerPhone = booking.phone.replace(/[^0-9]/g, '');
                        const checkInDate = new Date(booking.check_in).toLocaleDateString();
                        
                        let waText = '';
                        let emailSubject = '';
                        let emailBody = '';
                        
                        if (action === 'approved') {
                            waText = encodeURIComponent(`Hello ${booking.full_name},\n\nGreat news! Your booking at Beekke Villa (Ref: ${booking.booking_ref}) for ${checkInDate} has been ACCEPTED. 🎉\n\nWe look forward to hosting you!`);
                            emailSubject = encodeURIComponent(`Booking ACCEPTED - Beekke Villa (${booking.booking_ref})`);
                            emailBody = encodeURIComponent(`Hello ${booking.full_name},\n\nGreat news! Your booking at Beekke Villa (Ref: ${booking.booking_ref}) for ${checkInDate} has been ACCEPTED.\n\nWe look forward to hosting you!`);
                        } else if (action === 'rejected') {
                            waText = encodeURIComponent(`Hello ${booking.full_name},\n\nThank you for choosing Beekke Villa. Unfortunately, the dates you requested (from ${checkInDate}) are already fully booked. 😔\n\nWould you like to book for another date? Please let us know!`);
                            emailSubject = encodeURIComponent(`Booking Update - Beekke Villa (${booking.booking_ref})`);
                            emailBody = encodeURIComponent(`Hello ${booking.full_name},\n\nThank you for choosing Beekke Villa. Unfortunately, the dates you requested (from ${checkInDate}) are already fully booked.\n\nWould you like to book for another date? Please reply to this email and let us know!`);
                        }
                        
                        // Open WhatsApp
                        window.open(`https://wa.me/${customerPhone}?text=${waText}`, '_blank');
                        // Open Email Client
                        setTimeout(() => {
                            window.location.href = `mailto:${booking.email}?subject=${emailSubject}&body=${emailBody}`;
                        }, 500); // Slight delay so browser doesn't block both
                    }

                    fetchBookings(); // Refresh
                } catch (err) { alert('Error updating status: ' + err.message); }
            }
        });
    });
}

// Setup Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Update styling
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.className = "filter-btn font-classic text-xs tracking-widest uppercase px-4 py-2 rounded border transition-all border-parchment/10 text-parchment/40 hover:border-gold/40 hover:text-parchment/70";
        });
        e.target.className = "filter-btn font-classic text-xs tracking-widest uppercase px-4 py-2 rounded border transition-all border-gold text-gold";
        
        currentFilter = e.target.dataset.status;
        updateUI();
    });
});

// Setup Search
document.getElementById('searchBtn').addEventListener('click', () => {
    currentSearch = document.getElementById('searchInput').value;
    updateUI();
});
document.getElementById('searchInput').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        currentSearch = e.target.value;
        updateUI();
    }
});

// Init
fetchBookings();
