// Global State Management
const API_BASE = ''; // Same origin
let currentUser = null;
let currentLoginRole = 'user';
let activeView = 'auth';
let activeAdminTab = 'analytics';

// Pagination and Filtering State
let currentPage = 1;
let currentCity = '';
let currentSearch = '';
let currentSort = 'rating';

// Admin listings state
let adminCurrentPage = 1;
let currentUserBookings = [];

// Chart.js Instances
let chartMostBooked = null;
let chartTopRated = null;
let chartRatingsDist = null;
let chartBookingStatus = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    loadCities();
    
    // Set default dates in booking forms (tomorrow & day after)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    document.getElementById('book-check-in').value = formatDate(tomorrow);
    document.getElementById('book-check-out').value = formatDate(dayAfter);
});

// Helper: Format Date as YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

// Show toast notifications
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
        <i class="fa-solid fa-xmark toast-close" onclick="this.parentElement.remove()"></i>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
        toast.remove();
    }, 4500);
}

// Check Active Session
async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/api/auth/session`);
        const data = await res.json();
        
        if (data.logged_in) {
            currentUser = data.user;
            onLoginSuccess();
        } else {
            switchView('auth');
        }
    } catch (err) {
        console.error("Session check failed", err);
        switchView('auth');
    }
}

// Toggle Register/Login Card Flip
function toggleAuthCard(registerMode) {
    const card = document.getElementById('auth-card');
    if (registerMode) {
        card.classList.add('flipped');
    } else {
        card.classList.remove('flipped');
    }
}

// Set Active Role (User vs Admin) for Login
function setLoginRole(role) {
    currentLoginRole = role;
    document.getElementById('role-user-login').classList.toggle('active', role === 'user');
    document.getElementById('role-admin-login').classList.toggle('active', role === 'admin');
}

// Handle Login Form Submit
async function handleLogin(e) {
    if (e) e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role: currentLoginRole })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            currentUser = data.user;
            showToast("Login successful!", "success");
            onLoginSuccess();
        } else {
            showToast(data.error || "Authentication failed.", "error");
        }
    } catch (err) {
        showToast("Server connection error.", "error");
    }
}

// Handle Register Form Submit
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role: 'user' })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast("Registration successful! Please login.", "success");
            toggleAuthCard(false);
            // Pre-fill username
            document.getElementById('login-username').value = username;
        } else {
            showToast(data.error || "Registration failed.", "error");
        }
    } catch (err) {
        showToast("Server connection error.", "error");
    }
}

// Handle Logout
async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
        currentUser = null;
        document.getElementById('welcome-message').textContent = '';
        
        // Hide nav items
        document.getElementById('nav-btn-dashboard').classList.add('hidden');
        document.getElementById('nav-btn-history').classList.add('hidden');
        document.getElementById('nav-btn-admin').classList.add('hidden');
        document.getElementById('nav-btn-logout').classList.add('hidden');
        
        showToast("Logged out successfully.", "info");
        switchView('auth');
    } catch (err) {
        showToast("Logout failed.", "error");
    }
}

// Switch SPA Page Views
function switchView(viewName) {
    activeView = viewName;
    
    // Hide all sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    
    // Update nav active tags
    document.querySelectorAll('.nav-link-btn').forEach(btn => btn.classList.remove('active'));
    
    if (viewName === 'auth') {
        document.getElementById('view-auth').classList.remove('hidden');
        return;
    }
    
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // Configure Active Navigation State
    if (viewName === 'user-dashboard') {
        document.getElementById('nav-btn-dashboard').classList.add('active');
        loadHotels();
        loadPersonalizedRecommendations();
    } else if (viewName === 'booking-history') {
        document.getElementById('nav-btn-history').classList.add('active');
        loadBookingHistory();
    } else if (viewName === 'admin-dashboard') {
        document.getElementById('nav-btn-admin').classList.add('active');
        switchAdminTab(activeAdminTab);
    }
}

// On Successful Login
function onLoginSuccess() {
    document.getElementById('welcome-message').textContent = `Hi, ${currentUser.username}`;
    
    // Clear forms
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    
    // Display appropriate navigation elements
    document.getElementById('nav-btn-logout').classList.remove('hidden');
    
    if (currentUser.role === 'admin') {
        document.getElementById('nav-btn-admin').classList.remove('hidden');
        document.getElementById('nav-btn-dashboard').classList.remove('hidden');
        switchView('admin-dashboard');
    } else {
        document.getElementById('nav-btn-dashboard').classList.remove('hidden');
        document.getElementById('nav-btn-history').classList.remove('hidden');
        switchView('user-dashboard');
    }
}

// ----------------- USER DISCOVERY: HOTELS BROWSE & FILTER -----------------

// Fetch Cities for Filter Option
async function loadCities() {
    try {
        const res = await fetch(`${API_BASE}/api/hotels/cities`);
        const cities = await res.json();
        
        const filterCitySelect = document.getElementById('filter-city');
        // Clear except first option
        filterCitySelect.innerHTML = '<option value="">All Locations</option>';
        
        cities.forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            filterCitySelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load cities", err);
    }
}

// Filter inputs with debounce
let filterTimeout;
function triggerFilterSearch() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        currentPage = 1;
        applyFilters();
    }, 400);
}

function applyFilters() {
    currentSearch = document.getElementById('filter-search').value.trim();
    currentCity = document.getElementById('filter-city').value;
    currentSort = document.getElementById('sort-by').value;
    loadHotels();
}

// Load Hotels Listing
async function loadHotels() {
    const grid = document.getElementById('hotels-list-grid');
    grid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading premium hotels...</div>';
    
    try {
        const url = `${API_BASE}/api/hotels?search=${encodeURIComponent(currentSearch)}&city=${encodeURIComponent(currentCity)}&sort_by=${currentSort}&page=${currentPage}&per_page=12`;
        const res = await fetch(url);
        const data = await res.json();
        
        document.getElementById('results-count').textContent = `${data.total} stays found`;
        
        grid.innerHTML = '';
        if (data.hotels.length === 0) {
            grid.innerHTML = '<div class="no-results"><i class="fa-regular fa-folder-open"></i> No hotels match your criteria. Try adjusting filters.</div>';
            document.getElementById('pagination-controls').innerHTML = '';
            return;
        }
        
        data.hotels.forEach(hotel => {
            const card = document.createElement('div');
            card.className = 'hotel-card';
            card.onclick = () => openHotelDetail(hotel.id);
            
            const ratingClass = getRatingClass(hotel.aggregate_rating);
            
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${hotel.image_url}" alt="${hotel.name}" loading="lazy">
                    <span class="city-badge">${hotel.city}</span>
                </div>
                <div class="card-body">
                    <h3 class="card-title" title="${hotel.name}">${hotel.name}</h3>
                    <div class="card-rating-row">
                        <span class="rating-badge ${ratingClass}">
                            <i class="fa-solid fa-star"></i> ${hotel.aggregate_rating.toFixed(1)}
                        </span>
                        <span class="votes-count">(${hotel.votes} reviews)</span>
                    </div>
                    <p class="card-cuisines" title="${hotel.cuisines || 'Luxury standard amenities'}">
                        <i class="fa-solid fa-bell-concierge"></i> ${hotel.cuisines || 'Wifi, Room Service, AC, Gym'}
                    </p>
                    <div class="card-footer">
                        <div class="card-price">
                            <span class="price-label">Rates Per Night</span>
                            <span class="price-amount">${hotel.currency} ${(hotel.average_cost / 2).toLocaleString()}</span>
                        </div>
                        <button class="card-btn"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        
        renderPagination(data.page, data.pages);
    } catch (err) {
        grid.innerHTML = '<div class="no-results error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading listings. Please refresh.</div>';
    }
}

// Render dynamic pagination buttons
function renderPagination(page, totalPages) {
    const container = document.getElementById('pagination-controls');
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = `page-btn ${page === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.onclick = () => { if (page > 1) { currentPage--; loadHotels(); } };
    container.appendChild(prevBtn);
    
    // Page range logic
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, page + 2);
    
    if (start > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'page-btn';
        firstBtn.textContent = '1';
        firstBtn.onclick = () => { currentPage = 1; loadHotels(); };
        container.appendChild(firstBtn);
        
        if (start > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.alignSelf = 'center';
            dots.style.color = 'var(--text-muted)';
            container.appendChild(dots);
        }
    }
    
    for (let i = start; i <= end; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === page ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; loadHotels(); };
        container.appendChild(btn);
    }
    
    if (end < totalPages) {
        if (end < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.alignSelf = 'center';
            dots.style.color = 'var(--text-muted)';
            container.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.className = 'page-btn';
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => { currentPage = totalPages; loadHotels(); };
        container.appendChild(lastBtn);
    }
    
    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = `page-btn ${page === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.onclick = () => { if (page < totalPages) { currentPage++; loadHotels(); } };
    container.appendChild(nextBtn);
}

// Help map styles based on rating numbers
function getRatingClass(rating) {
    if (rating >= 4.5) return 'excellent';
    if (rating >= 4.0) return 'very-good';
    if (rating >= 3.5) return 'good';
    if (rating >= 2.5) return 'average';
    if (rating > 0) return 'poor';
    return 'unrated';
}

// ----------------- INTELLIGENT PERSONALIZED RECOMMENDATIONS -----------------
async function loadPersonalizedRecommendations() {
    const container = document.getElementById('personalized-recommendations-section');
    const grid = document.getElementById('recommendations-grid');
    
    try {
        const res = await fetch(`${API_BASE}/api/recommendations/personalized`);
        const data = await res.json();
        
        grid.innerHTML = '';
        
        if (data.hotels && data.hotels.length > 0) {
            container.classList.remove('hidden');
            
            const subtitle = document.getElementById('rec-section-subtitle');
            if (data.type === 'personalized') {
                subtitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Based on your recent approved booking at <strong>${data.base_hotel}</strong>:`;
            } else if (data.type === 'popular') {
                subtitle.innerHTML = `<i class="fa-solid fa-fire"></i> Trending Popular Hotels (Log in to see tailored recommendations):`;
            } else {
                subtitle.innerHTML = `<i class="fa-solid fa-star"></i> Featured Premium Stays:`;
            }
            
            data.hotels.forEach(hotel => {
                const card = document.createElement('div');
                card.className = 'hotel-card';
                card.onclick = () => openHotelDetail(hotel.id);
                
                const ratingClass = getRatingClass(hotel.aggregate_rating);
                
                card.innerHTML = `
                    <div class="card-img-container">
                        <img src="${hotel.image_url}" alt="${hotel.name}" loading="lazy">
                        <span class="city-badge">${hotel.city}</span>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title" title="${hotel.name}">${hotel.name}</h3>
                        <div class="card-rating-row">
                            <span class="rating-badge ${ratingClass}">
                                <i class="fa-solid fa-star"></i> ${hotel.aggregate_rating.toFixed(1)}
                            </span>
                        </div>
                        <p class="card-cuisines" title="${hotel.cuisines || 'High-end amenities'}">
                            <i class="fa-solid fa-bell-concierge"></i> ${hotel.cuisines || 'Wifi, Pool, Spa'}
                        </p>
                        <div class="card-footer">
                            <div class="card-price">
                                <span class="price-amount">${hotel.currency} ${(hotel.average_cost / 2).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        } else {
            container.classList.add('hidden');
        }
    } catch (err) {
        console.error("Personalized recommendations failed", err);
        container.classList.add('hidden');
    }
}

// ----------------- HOTEL DETAILS & RESERVATION BOOKING -----------------
let activeHotelDetail = null;

async function openHotelDetail(hotelId) {
    try {
        const res = await fetch(`${API_BASE}/api/hotels/${hotelId}`);
        if (!res.ok) throw new Error();
        
        const hotel = await res.json();
        activeHotelDetail = hotel;
        
        // Populate modal data
        document.getElementById('modal-hotel-img').src = hotel.image_url;
        document.getElementById('modal-hotel-city').textContent = hotel.city;
        document.getElementById('modal-hotel-name').textContent = hotel.name;
        
        const badge = document.getElementById('modal-hotel-rating');
        badge.className = `rating-badge ${getRatingClass(hotel.aggregate_rating)}`;
        badge.innerHTML = `<i class="fa-solid fa-star"></i> ${hotel.aggregate_rating.toFixed(1)} (${hotel.rating_text})`;
        
        document.getElementById('modal-hotel-votes').textContent = `based on ${hotel.votes} user votes`;
        document.getElementById('modal-hotel-address').textContent = hotel.address || 'Central Locality, Address details available upon reservation';
        document.getElementById('modal-hotel-cuisines').textContent = hotel.cuisines || 'Standard Resort Amenities, Free Wifi, Mini-Bar, Parking, Central Location';
        document.getElementById('modal-hotel-cost').textContent = `${hotel.currency} ${(hotel.average_cost / 2).toLocaleString()} / night`;
        
        // Calculate booking price initially
        calculateBookingPrice();
        
        // Load content-based recommendations (similarity.pkl output)
        loadSimilarHotelRecommendations(hotelId);
        
        // Show Modal
        document.getElementById('modal-detail').classList.remove('hidden');
    } catch (err) {
        showToast("Failed to load hotel details.", "error");
    }
}

// Close Modals
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    if (modalId === 'modal-add-hotel') {
        document.getElementById('admin-hotel-form').reset();
        document.getElementById('edit-hotel-id').value = '';
        document.getElementById('predicted-rating-result').classList.add('hidden');
    }
}

function closeModalOnOverlay(e, modalId) {
    if (e.target.id === modalId) {
        closeModal(modalId);
    }
}

// Load content-based recommendations
async function loadSimilarHotelRecommendations(hotelId) {
    const grid = document.getElementById('modal-rec-grid');
    grid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Finding similar hotels...</div>';
    
    try {
        const res = await fetch(`${API_BASE}/api/hotels/${hotelId}/recommendations`);
        const recs = await res.json();
        
        grid.innerHTML = '';
        if (recs.length === 0) {
            grid.innerHTML = '<div class="no-results-small">No similar hotels found.</div>';
            return;
        }
        
        recs.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'modal-rec-card';
            card.onclick = (e) => {
                e.stopPropagation(); // Avoid modal close issues
                openHotelDetail(rec.id);
            };
            
            card.innerHTML = `
                <img class="modal-rec-img" src="${rec.image_url}" alt="${rec.name}">
                <div class="modal-rec-info">
                    <h5 class="modal-rec-name" title="${rec.name}">${rec.name}</h5>
                    <div class="modal-rec-rating">
                        <i class="fa-solid fa-star"></i> ${rec.aggregate_rating.toFixed(1)}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = '<div class="no-results-small">Failed to load suggestions.</div>';
    }
}

// Interactive Room Price Estimator Calculator
function calculateBookingPrice() {
    if (!activeHotelDetail) return;
    
    const checkInVal = document.getElementById('book-check-in').value;
    const checkOutVal = document.getElementById('book-check-out').value;
    const roomType = document.getElementById('book-room-type').value;
    
    if (!checkInVal || !checkOutVal) return;
    
    const d1 = new Date(checkInVal);
    const d2 = new Date(checkOutVal);
    
    if (d2 <= d1) {
        document.getElementById('booking-pricing-box').classList.add('hidden');
        return;
    }
    
    document.getElementById('booking-pricing-box').classList.remove('hidden');
    
    const timeDiff = Math.abs(d2.getTime() - d1.getTime());
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    const baseCost = activeHotelDetail.average_cost / 2.0 || 300.0;
    let multiplier = 1.0;
    if (roomType === 'Deluxe') multiplier = 1.6;
    if (roomType === 'Suite') multiplier = 2.5;
    
    const total = baseCost * multiplier * nights;
    
    document.getElementById('price-nights').textContent = `${nights} night(s)`;
    document.getElementById('price-total').textContent = `${activeHotelDetail.currency} ${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Create Hotel Reservation Booking Request
async function handleCreateBooking(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showToast("Please log in to reserve hotel rooms.", "error");
        closeModal('modal-detail');
        switchView('auth');
        return;
    }
    
    const hotel_id = activeHotelDetail.id;
    const room_type = document.getElementById('book-room-type').value;
    const check_in_date = document.getElementById('book-check-in').value;
    const check_out_date = document.getElementById('book-check-out').value;
    
    const d1 = new Date(check_in_date);
    const d2 = new Date(check_out_date);
    
    if (d2 <= d1) {
        showToast("Check-out date must be after Check-in date.", "error");
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_id, room_type, check_in_date, check_out_date })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast("Booking request submitted! Pending approval.", "success");
            closeModal('modal-detail');
            switchView('booking-history');
        } else {
            showToast(data.error || "Booking failed.", "error");
        }
    } catch (err) {
        showToast("Failed to book room.", "error");
    }
}

// ----------------- USER BOOKING HISTORY & CANCELLATIONS -----------------
async function loadBookingHistory() {
    const list = document.getElementById('booking-history-list');
    list.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading your booking history...</div>';
    
    try {
        const res = await fetch(`${API_BASE}/api/bookings/history`);
        const bookings = await res.json();
        currentUserBookings = bookings; // Cache globally for PDF download lookup
        
        list.innerHTML = '';
        if (bookings.length === 0) {
            list.innerHTML = '<div class="no-results"><i class="fa-regular fa-calendar-times"></i> You have no bookings yet. Go explore available stays!</div>';
            return;
        }
        
        bookings.forEach(b => {
            const ticket = document.createElement('div');
            ticket.className = 'booking-ticket';
            
            const cancelBtn = (b.status === 'pending' || b.status === 'approved') 
                ? `<button class="btn-cancel" onclick="cancelBooking(${b.id})">Cancel Booking</button>` 
                : '';
                
            const downloadBtn = (b.status === 'approved')
                ? `<button class="btn-primary" style="padding: 8px 16px; font-size: 0.9rem;" onclick="downloadBookingPdf(${b.id})"><i class="fa-solid fa-file-pdf"></i> Download Voucher</button>`
                : '';
                
            ticket.innerHTML = `
                <img class="ticket-img" src="${b.hotel_image}" alt="hotel stay">
                <div class="ticket-content">
                    <div class="ticket-header">
                        <div>
                            <h3 class="ticket-title">${b.hotel_name}</h3>
                            <span class="ticket-subtitle"><i class="fa-solid fa-location-dot"></i> ${b.hotel_city}</span>
                        </div>
                        <span class="status-badge ${b.status}">${b.status}</span>
                    </div>
                    <div class="ticket-details">
                        <div class="detail-item">
                            <span class="detail-label">Room Class</span>
                            <span class="detail-val">${b.room_type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Check In</span>
                            <span class="detail-val">${b.check_in_date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Check Out</span>
                            <span class="detail-val">${b.check_out_date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Booked On</span>
                            <span class="detail-val">${b.created_at}</span>
                        </div>
                    </div>
                    <div class="ticket-footer">
                        <span class="ticket-price">$ ${b.total_price.toLocaleString()}</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${downloadBtn}
                            ${cancelBtn}
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(ticket);
        });
    } catch (err) {
        list.innerHTML = '<div class="no-results error"><i class="fa-solid fa-triangle-exclamation"></i> Error loading bookings history.</div>';
    }
}

// Cancel Booking
async function cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/cancel`, { method: 'POST' });
        const data = await res.json();
        
        if (res.ok) {
            showToast("Booking cancelled successfully.", "success");
            loadBookingHistory();
        } else {
            showToast(data.error || "Cancellation failed.", "error");
        }
    } catch (err) {
        showToast("Server connection error.", "error");
    }
}

// ----------------- ADMINISTRATOR CONTROL PORTAL -----------------

// Admin views switcher
function switchAdminTab(tabName) {
    activeAdminTab = tabName;
    
    // Toggle active sidebar btns
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`admin-tab-${tabName}`).classList.add('active');
    
    // Hide all admin tabs
    document.querySelectorAll('.admin-tab-content').forEach(cont => cont.classList.add('hidden'));
    document.getElementById(`admin-content-${tabName}`).classList.remove('hidden');
    
    if (tabName === 'analytics') {
        loadAdminAnalytics();
    } else if (tabName === 'reservations') {
        loadAdminReservations();
    } else if (tabName === 'listings') {
        loadAdminListings();
    }
}

// A. Admin Analytics & Charts Rendering
async function loadAdminAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/analytics`);
        const data = await res.json();
        
        // Set stats cards text values
        document.getElementById('stat-users').textContent = data.summary.total_users;
        document.getElementById('stat-bookings').textContent = data.summary.total_bookings;
        document.getElementById('stat-hotels').textContent = data.summary.total_hotels;
        document.getElementById('stat-recommendations').textContent = `${data.summary.rec_coverage_pct}%`;
        
        // Destory previous charts if redrawn
        if (chartMostBooked) chartMostBooked.destroy();
        if (chartTopRated) chartTopRated.destroy();
        if (chartRatingsDist) chartRatingsDist.destroy();
        if (chartBookingStatus) chartBookingStatus.destroy();
        
        const fontColor = '#9ca3af';
        const gridColor = 'rgba(255, 255, 255, 0.05)';
        
        // 1. Most Booked Hotels
        chartMostBooked = new Chart(document.getElementById('chart-most-booked'), {
            type: 'bar',
            data: {
                labels: data.most_booked.labels,
                datasets: [{
                    label: 'Reservations Count',
                    data: data.most_booked.values,
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: fontColor }, grid: { color: gridColor } },
                    y: { ticks: { color: fontColor, stepSize: 1 }, grid: { color: gridColor } }
                }
            }
        });

        // 2. Top Rated Hotels
        chartTopRated = new Chart(document.getElementById('chart-top-rated'), {
            type: 'bar',
            data: {
                labels: data.top_rated.labels,
                datasets: [{
                    label: 'Aggregate Rating',
                    data: data.top_rated.values,
                    backgroundColor: 'rgba(139, 92, 246, 0.75)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y', // Horizontal bars
                plugins: { legend: { display: false } },
                scales: {
                    x: { min: 3.5, max: 5.0, ticks: { color: fontColor }, grid: { color: gridColor } },
                    y: { ticks: { color: fontColor }, grid: { color: gridColor } }
                }
            }
        });

        // 3. Hotel Ratings Distribution (Polar / Pie)
        chartRatingsDist = new Chart(document.getElementById('chart-ratings-dist'), {
            type: 'pie',
            data: {
                labels: data.rating_distribution.labels,
                datasets: [{
                    data: data.rating_distribution.values,
                    backgroundColor: [
                        '#047857', // Dark Green
                        '#059669', // Green
                        '#10b981', // Light Green
                        '#f59e0b', // Orange
                        '#ef4444', // Red
                        '#6b7280'  // Grey
                    ],
                    borderWidth: 1,
                    borderColor: '#111827'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: fontColor, boxWidth: 12, font: { size: 10 } }
                    }
                }
            }
        });

        // 4. Booking Request Status Distribution (Doughnut)
        chartBookingStatus = new Chart(document.getElementById('chart-booking-status'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(data.booking_status).map(k => k.toUpperCase()),
                datasets: [{
                    data: Object.values(data.booking_status),
                    backgroundColor: [
                        '#f59e0b', // Pending (Orange)
                        '#10b981', // Approved (Green)
                        '#ef4444', // Rejected (Red)
                        '#9ca3af'  // Cancelled (Grey)
                    ],
                    borderWidth: 1,
                    borderColor: '#111827'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: fontColor, boxWidth: 12, font: { size: 10 } }
                    }
                }
            }
        });

    } catch (err) {
        showToast("Error rendering analytics charts.", "error");
    }
}

// B. Admin Reservation requests approval/rejection list
async function loadAdminReservations() {
    const tbody = document.getElementById('admin-bookings-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading reservation lists...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/bookings`);
        const bookings = await res.json();
        
        tbody.innerHTML = '';
        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No booking requests submitted yet.</td></tr>';
            return;
        }
        
        bookings.forEach(b => {
            const tr = document.createElement('tr');
            
            const actions = (b.status === 'pending')
                ? `<button class="btn-action-small btn-approve" onclick="manageBookingAction(${b.id}, 'approve')"><i class="fa-solid fa-check"></i> Approve</button>
                   <button class="btn-action-small btn-reject" onclick="manageBookingAction(${b.id}, 'reject')"><i class="fa-solid fa-xmark"></i> Reject</button>`
                : '<span class="text-muted">None</span>';
                
            tr.innerHTML = `
                <td><strong>#${b.id}</strong></td>
                <td>${b.username}</td>
                <td>${b.hotel_name} <br><small class="text-muted"><i class="fa-solid fa-location-dot"></i> ${b.hotel_city}</small></td>
                <td>${b.room_type}</td>
                <td>${b.check_in_date} to <br>${b.check_out_date}</td>
                <td><strong>$ ${b.total_price.toLocaleString()}</strong></td>
                <td><span class="status-badge ${b.status}">${b.status}</span></td>
                <td>${actions}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load reservations list.</td></tr>';
    }
}

// Approve / Reject Reservation Actions
async function manageBookingAction(bookingId, action) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/bookings/${bookingId}/${action}`, { method: 'POST' });
        const data = await res.json();
        
        if (res.ok) {
            showToast(`Reservation request ${action}d successfully.`, "success");
            loadAdminReservations();
        } else {
            showToast(data.error || "Operation failed.", "error");
        }
    } catch (err) {
        showToast("Server connection failure.", "error");
    }
}

// C. Admin Listings CRUD Management
async function loadAdminListings() {
    const tbody = document.getElementById('admin-hotels-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading listings...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/api/hotels?page=${adminCurrentPage}&per_page=10`);
        const data = await res.json();
        
        tbody.innerHTML = '';
        
        data.hotels.forEach(h => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td><strong>#${h.id}</strong></td>
                <td><strong>${h.name}</strong></td>
                <td>${h.city}</td>
                <td title="${h.cuisines}"><small class="text-muted">${h.cuisines || 'N/A'}</small></td>
                <td>$ ${h.average_cost.toLocaleString()}</td>
                <td><span class="rating-badge ${getRatingClass(h.aggregate_rating)}"><i class="fa-solid fa-star"></i> ${h.aggregate_rating.toFixed(1)}</span></td>
                <td>${h.available_rooms} rooms</td>
                <td>
                    <button class="btn-action-small" onclick="openEditHotelModal(${h.id})"><i class="fa-solid fa-pencil"></i> Edit</button>
                    <button class="btn-action-small btn-action-danger" onclick="deleteHotelListing(${h.id})"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        renderAdminPagination(data.page, data.pages);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load listings table.</td></tr>';
    }
}

// Listings table pagination
function renderAdminPagination(page, totalPages) {
    const container = document.getElementById('admin-hotels-pagination');
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const prevBtn = document.createElement('button');
    prevBtn.className = `page-btn ${page === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.onclick = () => { if (page > 1) { adminCurrentPage--; loadAdminListings(); } };
    container.appendChild(prevBtn);
    
    const info = document.createElement('span');
    info.textContent = `Page ${page} of ${totalPages}`;
    info.style.alignSelf = 'center';
    info.style.color = 'var(--text-muted)';
    info.style.fontWeight = '600';
    info.style.margin = '0 15px';
    container.appendChild(info);
    
    const nextBtn = document.createElement('button');
    nextBtn.className = `page-btn ${page === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.onclick = () => { if (page < totalPages) { adminCurrentPage++; loadAdminListings(); } };
    container.appendChild(nextBtn);
}

// Delete Hotel listing (Soft delete)
async function deleteHotelListing(hotelId) {
    if (!confirm("Are you sure you want to delete this hotel listing?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/hotels/${hotelId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (res.ok) {
            showToast("Hotel listing deleted successfully.", "success");
            loadAdminListings();
        } else {
            showToast(data.error || "Delete failed.", "error");
        }
    } catch (err) {
        showToast("Server connection error.", "error");
    }
}

// Open Form Modal to create New Hotel
function openAddHotelModal() {
    document.getElementById('listing-modal-title').textContent = 'Add New Hotel Listing';
    document.getElementById('admin-hotel-form').reset();
    document.getElementById('edit-hotel-id').value = '';
    
    // Set predictable random lat/lng placeholders
    document.getElementById('hotel-lat').value = (28.5 + Math.random() * 0.2).toFixed(4);
    document.getElementById('hotel-lng').value = (77.1 + Math.random() * 0.3).toFixed(4);
    
    document.getElementById('predicted-rating-result').classList.add('hidden');
    document.getElementById('modal-add-hotel').classList.remove('hidden');
}

// Open Form Modal to edit existing Hotel details
async function openEditHotelModal(hotelId) {
    try {
        const res = await fetch(`${API_BASE}/api/hotels/${hotelId}`);
        const h = await res.json();
        
        document.getElementById('listing-modal-title').textContent = 'Edit Hotel Details';
        document.getElementById('edit-hotel-id').value = h.id;
        document.getElementById('hotel-name').value = h.name;
        document.getElementById('hotel-city').value = h.city;
        document.getElementById('hotel-locality').value = h.locality || '';
        document.getElementById('hotel-address').value = h.address || '';
        document.getElementById('hotel-cuisines').value = h.cuisines || '';
        document.getElementById('hotel-cost').value = h.average_cost;
        document.getElementById('hotel-rooms').value = h.available_rooms;
        document.getElementById('hotel-lat').value = h.latitude;
        document.getElementById('hotel-lng').value = h.longitude;
        
        // Fill prediction helpers just in case
        document.getElementById('pred-votes').value = h.votes;
        document.getElementById('pred-price-range').value = h.price_range || 2;
        
        document.getElementById('predicted-rating-result').classList.add('hidden');
        document.getElementById('modal-add-hotel').classList.remove('hidden');
    } catch (err) {
        showToast("Failed to fetch hotel details.", "error");
    }
}

// Integrated AI rating prediction model execution (Decision Tree rating_model.pkl)
async function runAiRatingPrediction() {
    const city = document.getElementById('hotel-city').value.trim() || 'New Delhi';
    const cuisines = document.getElementById('hotel-cuisines').value.trim() || 'North Indian';
    const cost = parseFloat(document.getElementById('hotel-cost').value) || 500;
    const lat = parseFloat(document.getElementById('hotel-lat').value) || 28.61;
    const lng = parseFloat(document.getElementById('hotel-lng').value) || 77.20;
    const price_range = parseInt(document.getElementById('pred-price-range').value) || 2;
    const votes = parseInt(document.getElementById('pred-votes').value) || 100;
    
    // Show loading text in output box
    const outputBox = document.getElementById('predicted-rating-result');
    const valueTag = document.getElementById('pred-rating-value');
    const textTag = document.getElementById('pred-rating-text');
    
    outputBox.classList.remove('hidden');
    valueTag.textContent = '...';
    textTag.textContent = '(Estimating rating...)';
    
    try {
        const res = await fetch(`${API_BASE}/api/hotels/predict-rating`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                city,
                cuisines,
                average_cost: cost,
                latitude: lat,
                longitude: lng,
                price_range,
                votes
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            valueTag.textContent = data.predicted_rating.toFixed(1);
            textTag.textContent = `(${data.rating_text})`;
        } else {
            showToast(data.error || "Model prediction failed.", "error");
            outputBox.classList.add('hidden');
        }
    } catch (err) {
        showToast("Server connection error during prediction.", "error");
        outputBox.classList.add('hidden');
    }
}

// Create or Save Hotel listing
async function handleSaveHotel(e) {
    e.preventDefault();
    
    const hotelId = document.getElementById('edit-hotel-id').value;
    const name = document.getElementById('hotel-name').value.trim();
    const city = document.getElementById('hotel-city').value.trim();
    const locality = document.getElementById('hotel-locality').value.trim();
    const address = document.getElementById('hotel-address').value.trim();
    const cuisines = document.getElementById('hotel-cuisines').value.trim();
    const average_cost = parseFloat(document.getElementById('hotel-cost').value);
    const available_rooms = parseInt(document.getElementById('hotel-rooms').value);
    const latitude = parseFloat(document.getElementById('hotel-lat').value);
    const longitude = parseFloat(document.getElementById('hotel-lng').value);
    
    // Rating prediction integration - run model first to pre-fill rating if it's a new hotel
    let aggregate_rating = 0.0;
    let rating_text = 'Not rated';
    let rating_color = 'White';
    let votes = 0;
    
    const isEdit = !!hotelId;
    
    // If saving a new hotel and model output is visible, use it!
    const predVal = parseFloat(document.getElementById('pred-rating-value').textContent);
    if (!isEdit && !isNaN(predVal)) {
        aggregate_rating = predVal;
        votes = parseInt(document.getElementById('pred-votes').value) || 50;
        rating_text = document.getElementById('pred-rating-text').textContent.replace(/[()]/g, '');
        rating_color = aggregate_rating >= 4.5 ? 'Dark Green' : aggregate_rating >= 4.0 ? 'Green' : aggregate_rating >= 3.5 ? 'Yellow' : 'Orange';
    }
    
    const url = isEdit ? `${API_BASE}/api/admin/hotels/${hotelId}` : `${API_BASE}/api/admin/hotels`;
    const method = isEdit ? 'PUT' : 'POST';
    
    const payload = {
        name, city, locality, address, cuisines, average_cost, available_rooms, latitude, longitude
    };
    
    if (!isEdit) {
        payload.aggregate_rating = aggregate_rating;
        payload.rating_text = rating_text;
        payload.rating_color = rating_color;
        payload.votes = votes;
        payload.price_range = parseInt(document.getElementById('pred-price-range').value) || 2;
    }
    
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast(isEdit ? "Hotel details updated!" : "New Hotel listing created!", "success");
            closeModal('modal-add-hotel');
            loadAdminListings();
        } else {
            showToast(data.error || "Save operation failed.", "error");
        }
    } catch (err) {
        showToast("Server connection error while saving.", "error");
    }
}

// client-side PDF Booking Voucher generator (jsPDF Integration)
function downloadBookingPdf(bookingId) {
    const booking = currentUserBookings.find(b => b.id === bookingId);
    if (!booking) {
        showToast("Booking details not found.", "error");
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });
        
        // Brand Styles & Colors
        const primaryColor = [99, 102, 241];   // Indigo
        const secondaryColor = [139, 92, 246]; // Purple
        const darkColor = [11, 15, 25];        // Charcoal
        
        // Banner Top Background Rectangle
        doc.setFillColor(...darkColor);
        doc.rect(0, 0, 210, 48, "F");
        
        // Horizontal Accent Line
        doc.setFillColor(...primaryColor);
        doc.rect(0, 48, 210, 2, "F");
        
        // Logo Title Text
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text("AETHERIA STAYS", 20, 26);
        
        // Subtitle
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("INTELLIGENT HOTEL RESERVATION & RECOMMENDATION SYSTEM", 20, 34);
        
        // Contact details header
        doc.setTextColor(156, 163, 175);
        doc.setFontSize(8);
        doc.text("support@aetheriastays.com  |  aetheriastays.com", 130, 26);
        doc.text("Reservation Service Desk  |  Direct Line: +1-800-AETHERIA", 115, 32);
        
        // Document Voucher Title Section
        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("BOOKING CONFIRMATION VOUCHER", 20, 68);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("Approved & Confirmed Voucher Proof", 20, 74);
        
        // Horizontal divider
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.4);
        doc.line(20, 78, 190, 78);
        
        // Info Section Left: Guest and Reservation details
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("GUEST & RESERVATION DETAILS", 20, 92);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        
        // Labels
        doc.text("Booking Reference:", 20, 102);
        doc.text("Registered Guest:", 20, 110);
        doc.text("Selected Room Class:", 20, 118);
        doc.text("Check-In Date:", 20, 126);
        doc.text("Check-Out Date:", 20, 134);
        doc.text("Booking Status:", 20, 142);
        
        // Values (Bold)
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "bold");
        doc.text(`#AE-BK-${booking.id}`, 65, 102);
        doc.text(currentUser ? currentUser.username.toUpperCase() : "GUEST", 65, 110);
        doc.text(booking.room_type, 65, 118);
        doc.text(booking.check_in_date, 65, 126);
        doc.text(booking.check_out_date, 65, 134);
        
        // Status Badge text
        doc.setTextColor(16, 185, 129); // Confirmed green
        doc.text("APPROVED & CONFIRMED", 65, 142);
        
        // Info Section Right: Hotel & Property details
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("PROPERTY INFORMATION", 115, 92);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text("Hotel Name:", 115, 102);
        doc.text("Destination City:", 115, 110);
        doc.text("Amenities:", 115, 118);
        
        // Property values
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "bold");
        doc.text(booking.hotel_name, 115, 106);
        doc.text(booking.hotel_city, 148, 110);
        
        // Cuisines/Amenities paragraph wrap
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        const amenitiesText = booking.hotel_cuisines || "Standard Luxury Suite, High-Speed Wifi, Concierge Services, Access to Pool, Air Conditioning";
        const splitAmenities = doc.splitTextToSize(amenitiesText, 75);
        doc.text(splitAmenities, 115, 124);
        
        // Dynamic Price summary block
        doc.setFillColor(243, 244, 246);
        doc.rect(20, 160, 170, 32, "F");
        
        // Check outline border for total block
        doc.setDrawColor(209, 213, 219);
        doc.rect(20, 160, 170, 32, "S");
        
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("BILLING & PAYMENT SUMMARY", 26, 168);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(75, 85, 99);
        doc.text("Transaction Status: Fully Processed", 26, 176);
        doc.text("Method: Guaranteed Reservation Booking", 26, 182);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...darkColor);
        doc.text("Total Paid Amount:", 115, 178);
        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text(`$ ${booking.total_price.toLocaleString()}`, 154, 178);
        
        // Important Notice section
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.text("IMPORTANT INSTRUCTIONS", 20, 208);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text("1. Verification Check: Please bring a copy of this printed/digital voucher and a valid photo ID upon check-in.", 20, 216);
        doc.text("2. Check-In & Check-Out: Standard Check-In time is 14:00 (2:00 PM), Check-Out time is 12:00 (12:00 PM) local property time.", 20, 223);
        doc.text("3. Cancellation Guidelines: Cancel requests can be requested directly inside the booking portal up to 24 hours prior.", 20, 230);
        doc.text("4. Additional Charges: Room service charges, mini-bar consumption, and laundry charges are subject to checkout settlement.", 20, 237);
        
        // Accent separator line
        doc.setDrawColor(229, 231, 235);
        doc.line(20, 248, 190, 248);
        
        // Signature area
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(10);
        doc.setTextColor(...primaryColor);
        doc.text("AETHERIA STAYS", 20, 258);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text("Intelligent Reservation Booking Voucher. Generated & Signed by Aetheria AI Core.", 20, 263);
        
        // Generation Date
        doc.setFontSize(8);
        doc.text(`Voucher Date: ${new Date().toLocaleString()}`, 140, 258);
        
        // QR Code Placeholder box
        doc.setDrawColor(...primaryColor);
        doc.rect(170, 252, 20, 20, "S");
        doc.setFontSize(6);
        doc.text("VERIFIED", 174, 260);
        doc.text("VOUCHER", 174, 264);
        
        // Download Trigger
        doc.save(`Aetheria_Booking_Voucher_BK-${booking.id}.pdf`);
        showToast("Voucher PDF downloaded successfully!", "success");
        
    } catch (err) {
        console.error("PDF generation failed:", err);
        showToast("Voucher generation failed. Please try again.", "error");
    }
}

