import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { requireAuth } from "./admin-auth.js";
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

requireAuth(['Admin', 'Manager']);

let allBookings = [];
let currentFilter = '';
let currentSearch = '';
let activeView = 'table'; // 'table' or 'calendar'

// Calendar State
let currentDate = new Date();
let calendarYear = currentDate.getFullYear();
let calendarMonth = currentDate.getMonth();

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function formatWhatsAppPhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '94' + cleaned.substring(1);
    }
    return cleaned;
}

function parseLocalDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal === 'object' && dateVal.seconds) {
        return new Date(dateVal.seconds * 1000);
    }
    if (typeof dateVal === 'string' && dateVal.includes('-')) {
        const parts = dateVal.split('T')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(dateVal) {
    const d = parseLocalDate(dateVal);
    if (!d) return '-';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── FETCH & UPDATE ──────────────────────────────────────────────────────────
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
        renderCalendar();
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

    // Today's date string for check-out checks
    const today = new Date();
    today.setHours(0,0,0,0);

    // 3. Update Table
    const tbody = document.getElementById('bookingsTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-16 text-center text-parchment/30 font-classic tracking-wider">No bookings found.</td></tr>`;
    } else {
        let html = '';
        filtered.forEach(b => {
            const dateStr = formatDateDisplay(b.check_in);
            
            // Calculate Check-out Badges
            let checkoutBadge = '';
            if (b.check_out && (b.status === 'approved' || b.status === 'pending')) {
                const coDate = parseLocalDate(b.check_out);
                if (coDate) {
                    coDate.setHours(0,0,0,0);

                    if (coDate.getTime() === today.getTime()) {
                        checkoutBadge = `<span class="block mt-1 badge bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 animate-pulse">🔔 Check-out Today</span>`;
                    } else if (coDate < today && b.status === 'approved') {
                        checkoutBadge = `<span class="block mt-1 badge bg-purple-500/20 text-purple-300 border border-purple-500/40">🎉 Completed</span>`;
                    }
                }
            }

            const statusBadge = `<span class="badge badge-${b.status}">${(b.status || 'pending').charAt(0).toUpperCase() + (b.status || 'pending').slice(1)}</span>${checkoutBadge}`;
            
            let actions = '';
            if (b.status === 'pending') {
                actions += `
                    <button class="action-btn btn-sm btn-approve mr-1" data-id="${b.id}" data-action="approved" title="Approve">✓</button>
                    <button class="action-btn btn-sm btn-reject mr-1" data-id="${b.id}" data-action="rejected" title="Reject">✗</button>
                `;
            }

            if (b.phone) {
                actions += `<button class="action-btn btn-sm bg-green-600/30 text-green-300 hover:bg-green-600 hover:text-white mr-1 flex items-center justify-center gap-2" data-id="${b.id}" data-action="thankyou" title="Send WhatsApp Message"><span>💬</span> <span>WhatsApp</span></button>`;
            }

            if (sessionStorage.getItem('adminRole') === 'Admin') {
                actions += `<button class="action-btn btn-sm btn-delete flex items-center justify-center" data-id="${b.id}" data-action="delete" title="Delete">🗑</button>`;
            }

            html += `
            <tr class="table-row border-b border-gold/5">
                <td data-label="Ref" class="px-4 py-3"><span class="font-classic text-gold text-sm">${b.booking_ref || '-'}</span></td>
                <td data-label="Guest" class="px-4 py-3">
                    <p class="text-parchment text-sm">${b.first_name || b.full_name || ''} ${b.last_name || ''}</p>
                    <p class="text-parchment/30 text-xs">${b.email || '-'}</p>
                </td>
                <td data-label="Phone" class="px-4 py-3 text-parchment/50 text-sm hidden md:table-cell">${b.phone || '-'}</td>
                <td data-label="Package" class="px-4 py-3 text-parchment/60 text-sm">${b.package || b.package_type || 'Standard'}</td>
                <td data-label="Dates" class="px-4 py-3 text-parchment/50 text-xs hidden lg:table-cell">${dateStr}</td>
                <td data-label="Amount" class="px-4 py-3 font-display text-gold text-sm font-semibold">LKR ${b.total_price ? b.total_price.toLocaleString() : '0'}</td>
                <td data-label="Status" class="px-4 py-3">${statusBadge}</td>
                <td data-label="Actions" class="px-4 py-3"><div class="flex flex-wrap items-center justify-end md:justify-center gap-2 w-full">${actions}</div></td>
            </tr>
            `;
        });
        tbody.innerHTML = html;
        attachActionListeners();
    }

    document.getElementById('showingCount').textContent = `${filtered.length} booking(s)`;
}

// ─── CALENDAR ENGINE ──────────────────────────────────────────────────────────
function renderCalendar() {
    const monthYearTitle = document.getElementById('calendarMonthYear');
    const grid = document.getElementById('calendarDaysGrid');
    if (!grid || !monthYearTitle) return;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearTitle.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    grid.innerHTML = '';

    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    // Padding empty cells before day 1
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = "bg-parchment/2 rounded border border-gold/5 p-2 min-h-[90px] opacity-20";
        grid.appendChild(emptyDiv);
    }

    // Days cells
    for (let day = 1; day <= totalDays; day++) {
        const cellDate = new Date(calendarYear, calendarMonth, day);
        cellDate.setHours(0,0,0,0);
        const isToday = cellDate.getTime() === today.getTime();

        // Find bookings overlapping this date
        const dayBookings = allBookings.filter(b => {
            if (!b.check_in) return false;
            const checkIn = parseLocalDate(b.check_in);
            if (!checkIn) return false;
            checkIn.setHours(0, 0, 0, 0);

            let checkOut = parseLocalDate(b.check_out) || new Date(checkIn);
            checkOut.setHours(23, 59, 59, 999);

            const targetDate = new Date(cellDate);
            targetDate.setHours(12, 0, 0, 0);

            return targetDate >= checkIn && targetDate <= checkOut;
        });

        const dayCell = document.createElement('div');
        dayCell.className = `rounded border p-2 min-h-[95px] flex flex-col justify-between cursor-pointer transition-all ${
            isToday 
                ? 'bg-gold/10 border-gold shadow-lg ring-1 ring-gold/50' 
                : 'bg-parchment/4 border-gold/15 hover:border-gold/40 hover:bg-parchment/8'
        }`;

        let statusChips = '';
        dayBookings.forEach(b => {
            let colorClasses = '';
            let statusIcon = '';

            const coDate = parseLocalDate(b.check_out);
            const isCheckoutDay = coDate && coDate.setHours(0,0,0,0) === cellDate.getTime();

            if (b.status === 'pending') {
                // Yellow
                colorClasses = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30';
                statusIcon = isCheckoutDay ? '🔔' : '⏳';
            } else if (b.status === 'approved') {
                // Green
                colorClasses = isCheckoutDay ? 'bg-purple-500/25 text-purple-200 border-purple-500/50 hover:bg-purple-500/35' : 'bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30';
                statusIcon = isCheckoutDay ? '🔔' : '✅';
            } else if (b.status === 'rejected') {
                // Red
                colorClasses = 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30';
                statusIcon = '❌';
            } else {
                colorClasses = 'bg-gray-500/20 text-gray-300 border-gray-500/40';
                statusIcon = '🚫';
            }

            const guestName = b.first_name || b.full_name || 'Guest';
            statusChips += `
                <div class="booking-chip text-[0.65rem] px-1.5 py-1 rounded border ${colorClasses} truncate font-classic tracking-wider flex items-center gap-1 mb-1 transition-colors" data-id="${b.id}">
                    <span>${statusIcon}</span>
                    <span class="truncate font-semibold">${guestName}</span>
                </div>
            `;
        });

        dayCell.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="font-display text-sm font-bold ${isToday ? 'text-gold' : 'text-parchment/80'}">${day}</span>
                ${dayBookings.length > 0 ? `<span class="text-[0.65rem] font-classic px-1.5 py-0.5 rounded-full bg-gold/20 text-gold font-bold">${dayBookings.length}</span>` : ''}
            </div>
            <div class="flex-1 overflow-y-auto max-h-[70px]">
                ${statusChips}
            </div>
        `;

        dayCell.addEventListener('click', (e) => {
            const chip = e.target.closest('.booking-chip');
            if (chip) {
                const bId = chip.dataset.id;
                const booking = allBookings.find(b => b.id === bId);
                if (booking) openBookingModal(booking);
            } else if (dayBookings.length > 0) {
                openBookingModal(dayBookings[0], dayBookings);
            }
        });

        grid.appendChild(dayCell);
    }
}

// Helper: Send WhatsApp Check-out / Thank-You Message
function sendCheckoutWhatsApp(booking) {
    if (!booking || !booking.phone) {
        alert("No phone number available for this guest.");
        return;
    }
    const customerPhone = formatWhatsAppPhone(booking.phone);
    if (!customerPhone) {
        alert("Invalid phone number format.");
        return;
    }

    const guestName = booking.first_name || booking.full_name || 'Guest';
    const ref = booking.booking_ref || '';

    const waText = encodeURIComponent(
        `Hello ${guestName}! 🌺\n\nThank you for choosing Beekke Villa for your stay (Ref: ${ref})!\nWe hope you had a wonderful time with us. Have a safe departure and safe travels back home! 🚗✨\n\nWe look forward to hosting you again soon!`
    );

    window.open(`https://wa.me/${customerPhone}?text=${waText}`, '_blank');
}

// ─── MODAL CONTROLS ───────────────────────────────────────────────────────────
function openBookingModal(primaryBooking, allDayBookings = [primaryBooking]) {
    const modal = document.getElementById('bookingModal');
    const title = document.getElementById('modalTitle');
    const subTitle = document.getElementById('modalSubTitle');
    const content = document.getElementById('modalContent');
    const actions = document.getElementById('modalActions');

    if (!modal) return;

    title.textContent = `Booking Details`;
    subTitle.textContent = `Ref: ${primaryBooking.booking_ref || '-'}`;

    const guestName = primaryBooking.first_name || primaryBooking.full_name || 'Guest';
    const lastName = primaryBooking.last_name || '';
    const checkIn = formatDateDisplay(primaryBooking.check_in);
    const checkOut = formatDateDisplay(primaryBooking.check_out);

    let statusBadgeColor = '';
    if (primaryBooking.status === 'pending') statusBadgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    else if (primaryBooking.status === 'approved') statusBadgeColor = 'bg-green-500/20 text-green-300 border-green-500/40';
    else if (primaryBooking.status === 'rejected') statusBadgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
    else statusBadgeColor = 'bg-gray-500/20 text-gray-300 border-gray-500/40';

    let dayListHTML = '';
    if (allDayBookings.length > 1) {
        dayListHTML = `
            <div class="mb-4 pb-3 border-b border-gold/10">
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40 mb-2">Bookings on this day (${allDayBookings.length}):</p>
                <div class="flex flex-wrap gap-2">
                    ${allDayBookings.map(b => `
                        <button class="modal-switch-btn text-xs px-2.5 py-1 rounded border ${b.id === primaryBooking.id ? 'border-gold text-gold font-bold bg-gold/10' : 'border-parchment/20 text-parchment/60 hover:text-parchment'}" data-id="${b.id}">
                            ${b.first_name || b.full_name || 'Guest'} (${b.status})
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        ${dayListHTML}
        <div class="grid grid-cols-2 gap-4 bg-parchment/5 p-4 rounded border border-gold/10">
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Guest Name</p>
                <p class="font-bold text-parchment text-base">${guestName} ${lastName}</p>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Status</p>
                <span class="inline-block mt-1 px-3 py-1 rounded text-xs uppercase font-classic border ${statusBadgeColor} font-bold">
                    ${(primaryBooking.status || 'pending').toUpperCase()}
                </span>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Phone</p>
                <p class="text-gold font-semibold">${primaryBooking.phone || '-'}</p>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Email</p>
                <p class="text-parchment/80 text-xs truncate">${primaryBooking.email || '-'}</p>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Check-In</p>
                <p class="text-parchment font-medium">${checkIn}</p>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Check-Out</p>
                <p class="text-parchment font-medium">${checkOut}</p>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Package</p>
                <p class="text-parchment font-medium">${primaryBooking.package || primaryBooking.package_type || 'Standard'}</p>
            </div>
            <div>
                <p class="text-xs uppercase font-classic tracking-widest text-parchment/40">Total Amount</p>
                <p class="text-gold font-bold text-base">LKR ${primaryBooking.total_price ? primaryBooking.total_price.toLocaleString() : '0'}</p>
            </div>
        </div>
    `;

    let actionButtons = '';
    if (primaryBooking.status === 'pending') {
        actionButtons += `
            <button class="modal-action-btn btn-sm btn-approve" data-id="${primaryBooking.id}" data-action="approved">✓ Approve Booking</button>
            <button class="modal-action-btn btn-sm btn-reject" data-id="${primaryBooking.id}" data-action="rejected">✗ Reject Booking</button>
        `;
    }

    if (primaryBooking.phone) {
        actionButtons += `<button id="modalWaBtn" class="btn-sm bg-green-600/30 text-green-300 hover:bg-green-600 hover:text-white font-bold border border-green-500/40">💬 Send Thank-you Message</button>`;
    }

    if (sessionStorage.getItem('adminRole') === 'Admin') {
        actionButtons += `<button class="modal-action-btn btn-sm btn-delete" data-id="${primaryBooking.id}" data-action="delete">🗑 Delete</button>`;
    }
    actions.innerHTML = actionButtons;

    modal.classList.remove('hidden');

    // Bind WhatsApp Thank you button in modal
    document.getElementById('modalWaBtn')?.addEventListener('click', () => {
        sendCheckoutWhatsApp(primaryBooking);
    });

    // Switch between multiple bookings on same day inside modal
    document.querySelectorAll('.modal-switch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('button');
            if (!targetBtn) return;
            const bId = targetBtn.dataset.id;
            const targetB = allDayBookings.find(b => b.id === bId);
            if (targetB) openBookingModal(targetB, allDayBookings);
        });
    });

    // Handle action buttons inside modal
    document.querySelectorAll('.modal-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const targetBtn = e.target.closest('button');
            if (!targetBtn) return;

            const id = targetBtn.dataset.id;
            const action = targetBtn.dataset.action;

            if (action === 'delete') {
                if (confirm("Are you sure you want to delete this booking?")) {
                    try {
                        await deleteDoc(doc(db, "bookings", id));
                        modal.classList.add('hidden');
                        fetchBookings();
                    } catch (err) { alert('Error deleting: ' + err.message); }
                }
            } else {
                try {
                    await updateDoc(doc(db, "bookings", id), { status: action });
                    
                    const booking = allBookings.find(b => b.id === id);
                    if (booking && booking.phone) {
                        const customerPhone = formatWhatsAppPhone(booking.phone);
                        const checkInDate = formatDateDisplay(booking.check_in);
                        
                        let waText = '';
                        let emailSubject = '';
                        let emailBody = '';
                        
                        if (action === 'approved') {
                            waText = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nGreat news! Your booking at Beekke Villa (Ref: ${booking.booking_ref}) for ${checkInDate} has been ACCEPTED. 🎉\n\nWe look forward to hosting you!`);
                            emailSubject = encodeURIComponent(`Booking ACCEPTED - Beekke Villa (${booking.booking_ref})`);
                            emailBody = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nGreat news! Your booking at Beekke Villa (Ref: ${booking.booking_ref}) for ${checkInDate} has been ACCEPTED.\n\nWe look forward to hosting you!`);
                        } else if (action === 'rejected') {
                            waText = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nThank you for choosing Beekke Villa. Unfortunately, the dates you requested (from ${checkInDate}) are already fully booked. 😔\n\nWould you like to book for another date? Please let us know!`);
                            emailSubject = encodeURIComponent(`Booking Update - Beekke Villa (${booking.booking_ref})`);
                            emailBody = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nThank you for choosing Beekke Villa. Unfortunately, the dates you requested (from ${checkInDate}) are already fully booked.\n\nWould you like to book for another date? Please reply to this email and let us know!`);
                        }
                        
                        window.open(`https://wa.me/${customerPhone}?text=${waText}`, '_blank');
                        if (booking.email) {
                            setTimeout(() => {
                                window.location.href = `mailto:${booking.email}?subject=${emailSubject}&body=${emailBody}`;
                            }, 500);
                        }
                    }

                    modal.classList.add('hidden');
                    fetchBookings();
                } catch (err) { alert('Error updating status: ' + err.message); }
            }
        });
    });
}

function attachActionListeners() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const targetBtn = e.target.closest('button');
            if (!targetBtn) return;

            const id = targetBtn.dataset.id;
            const action = targetBtn.dataset.action;

            if (action === 'thankyou') {
                const booking = allBookings.find(b => b.id === id);
                if (booking) sendCheckoutWhatsApp(booking);
                return;
            }

            if (action === 'delete') {
                if (confirm("Are you sure you want to delete this booking?")) {
                    try {
                        await deleteDoc(doc(db, "bookings", id));
                        fetchBookings();
                    } catch (err) { alert('Error deleting: ' + err.message); }
                }
            } else {
                try {
                    await updateDoc(doc(db, "bookings", id), { status: action });
                    
                    const booking = allBookings.find(b => b.id === id);
                    if (booking && booking.phone) {
                        const customerPhone = formatWhatsAppPhone(booking.phone);
                        const checkInDate = formatDateDisplay(booking.check_in);
                        
                        let waText = '';
                        let emailSubject = '';
                        let emailBody = '';
                        
                        if (action === 'approved') {
                            waText = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nGreat news! Your booking at Beekke Villa (Ref: ${booking.booking_ref}) for ${checkInDate} has been ACCEPTED. 🎉\n\nWe look forward to hosting you!`);
                            emailSubject = encodeURIComponent(`Booking ACCEPTED - Beekke Villa (${booking.booking_ref})`);
                            emailBody = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nGreat news! Your booking at Beekke Villa (Ref: ${booking.booking_ref}) for ${checkInDate} has been ACCEPTED.\n\nWe look forward to hosting you!`);
                        } else if (action === 'rejected') {
                            waText = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nThank you for choosing Beekke Villa. Unfortunately, the dates you requested (from ${checkInDate}) are already fully booked. 😔\n\nWould you like to book for another date? Please let us know!`);
                            emailSubject = encodeURIComponent(`Booking Update - Beekke Villa (${booking.booking_ref})`);
                            emailBody = encodeURIComponent(`Hello ${booking.first_name || booking.full_name},\n\nThank you for choosing Beekke Villa. Unfortunately, the dates you requested (from ${checkInDate}) are already fully booked.\n\nWould you like to book for another date? Please reply to this email and let us know!`);
                        }
                        
                        window.open(`https://wa.me/${customerPhone}?text=${waText}`, '_blank');
                        if (booking.email) {
                            setTimeout(() => {
                                window.location.href = `mailto:${booking.email}?subject=${emailSubject}&body=${emailBody}`;
                            }, 500);
                        }
                    }

                    fetchBookings();
                } catch (err) { alert('Error updating status: ' + err.message); }
            }
        });
    });
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

// View Switcher: Table vs Calendar
const viewTableBtn = document.getElementById('viewTableBtn');
const viewCalendarBtn = document.getElementById('viewCalendarBtn');
const tableViewContainer = document.getElementById('tableViewContainer');
const calendarViewContainer = document.getElementById('calendarViewContainer');

if (viewTableBtn && viewCalendarBtn) {
    viewTableBtn.addEventListener('click', () => {
        activeView = 'table';
        viewTableBtn.className = "flex items-center gap-2 font-classic text-xs tracking-widest uppercase px-4 py-2 rounded bg-gold text-woods font-bold transition-all cursor-pointer";
        viewCalendarBtn.className = "flex items-center gap-2 font-classic text-xs tracking-widest uppercase px-4 py-2 rounded text-parchment/60 hover:text-gold transition-all cursor-pointer";
        tableViewContainer?.classList.remove('hidden');
        calendarViewContainer?.classList.add('hidden');
    });

    viewCalendarBtn.addEventListener('click', () => {
        activeView = 'calendar';
        viewCalendarBtn.className = "flex items-center gap-2 font-classic text-xs tracking-widest uppercase px-4 py-2 rounded bg-gold text-woods font-bold transition-all cursor-pointer";
        viewTableBtn.className = "flex items-center gap-2 font-classic text-xs tracking-widest uppercase px-4 py-2 rounded text-parchment/60 hover:text-gold transition-all cursor-pointer";
        calendarViewContainer?.classList.remove('hidden');
        tableViewContainer?.classList.add('hidden');
        renderCalendar();
    });
}

// Calendar Month Navigation
document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    calendarMonth--;
    if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
    }
    renderCalendar();
});

document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    calendarMonth++;
    if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
    }
    renderCalendar();
});

document.getElementById('todayBtn')?.addEventListener('click', () => {
    const today = new Date();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();
    renderCalendar();
});

// Close Modal
document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    document.getElementById('bookingModal')?.classList.add('hidden');
});
document.getElementById('bookingModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bookingModal') {
        document.getElementById('bookingModal').classList.add('hidden');
    }
});

// Setup Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('button');
        if (!targetBtn) return;

        document.querySelectorAll('.filter-btn').forEach(b => {
            b.className = "filter-btn font-classic text-xs tracking-widest uppercase px-4 py-2 rounded border transition-all border-parchment/10 text-parchment/40 hover:border-gold/40 hover:text-parchment/70";
        });
        targetBtn.className = "filter-btn font-classic text-xs tracking-widest uppercase px-4 py-2 rounded border transition-all border-gold text-gold";
        
        currentFilter = targetBtn.dataset.status;
        updateUI();
    });
});

// Setup Search
document.getElementById('searchBtn')?.addEventListener('click', () => {
    currentSearch = document.getElementById('searchInput').value;
    updateUI();
});
document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        currentSearch = e.target.value;
        updateUI();
    }
});

// Init
onAuthStateChanged(auth, (user) => {
    if (user) {
        fetchBookings();
    }
});
