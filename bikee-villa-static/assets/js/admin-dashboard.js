import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function initDashboard() {
    try {
        const q = query(collection(db, "bookings"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);

        let total = 0;
        let pending = 0;
        let approved = 0;
        let revenue = 0;
        
        let recentRowsHTML = '';
        let rowCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            total++;

            if (data.status === 'pending') pending++;
            if (data.status === 'approved') {
                approved++;
                revenue += (data.total_price || 0);
            }

            // Get first 5 rows for the table
            if (rowCount < 5) {
                const dateStr = new Date(data.check_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const statusBadge = `<span class="badge badge-${data.status}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span>`;
                
                recentRowsHTML += `
                <tr class="table-row border-b border-gold/5">
                  <td class="px-6 py-3 font-classic text-gold text-sm">${data.booking_ref || '-'}</td>
                  <td class="px-6 py-3">
                    <p class="text-parchment text-sm">${data.first_name} ${data.last_name}</p>
                    <p class="text-parchment/30 text-xs">${data.email}</p>
                  </td>
                  <td class="px-6 py-3 text-parchment/60 text-sm">${data.package || 'Standard'}</td>
                  <td class="px-6 py-3 text-parchment/60 text-sm">${dateStr}</td>
                  <td class="px-6 py-3 font-display text-gold text-sm font-semibold">LKR ${data.total_price ? data.total_price.toLocaleString() : '0'}</td>
                  <td class="px-6 py-3">${statusBadge}</td>
                </tr>
                `;
                rowCount++;
            }
        });

        // Update Stats UI
        document.getElementById('statTotalBookings').textContent = total;
        document.getElementById('statPendingBookings').textContent = pending;
        document.getElementById('statApprovedBookings').textContent = approved;
        document.getElementById('statTotalRevenue').textContent = 'LKR ' + revenue.toLocaleString();

        // Update Table UI
        const tbody = document.getElementById('recentBookingsTable');
        if (rowCount > 0) {
            tbody.innerHTML = recentRowsHTML;
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-parchment/30 font-classic tracking-wider">No bookings yet</td></tr>`;
        }

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
