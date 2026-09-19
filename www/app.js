const API_BASE = 'https://nss-digital-management-system.onrender.com/api';

// IN-MEMORY STATE VARIABLE
let state = {
    role: 'volunteer',
    activeTab: 'dashboard',
    announcement: '',
    volunteers: [],
    events: [],
    attendanceQueue: []
};

// INITIALIZE APP ON DOM CONTENT LOADED
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    startLiveClock();
    fetchInitialData();
});

async function fetchInitialData() {
    try {
        const [stateRes, volRes, evtRes, attRes] = await Promise.all([
            fetch(`${API_BASE}/state`),
            fetch(`${API_BASE}/volunteers`),
            fetch(`${API_BASE}/events`),
            fetch(`${API_BASE}/attendance`)
        ]);

        const appState = await stateRes.json();
        state.role = appState.role || 'volunteer';
        state.announcement = appState.announcement || '';
        state.volunteers = await volRes.json();
        state.events = await evtRes.json();
        state.attendanceQueue = await attRes.json();

        renderApp();
        if (state.volunteers.length >= 0) {
            generateNextNSSID();
        }
    } catch (e) {
        console.error("Failed to load backend data:", e);
        showToast("Error connecting to backend server", "error");
    }
}

// LIVE DIGITAL CLOCK
function startLiveClock() {
    const clockEl = document.getElementById('live-clock');
    function update() {
        const now = new Date();
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }
    update();
    setInterval(update, 1000);
}

// RENDER ENTIRE APPLICATION UI BASED ON STATE
function renderApp() {
    renderRoleUI();
    renderAnnouncement();
    renderMetrics();
    renderRecentActivities();
    renderDeptBreakdown();
    renderDirectoryTable();
    renderEventsGrid();
    renderAttendanceQueue();
    populateIDCardDropdown();
}

// TAB SWITCHING LOGIC
function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
    const target = document.getElementById(`view-${tabId}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('text-slate-300');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-slate-800', 'text-white');
        activeBtn.classList.remove('text-slate-300');
    }

    // Refresh icons in visible tab
    setTimeout(() => lucide.createIcons(), 50);
}

// ROLE SWITCHER (VOLUNTEER VS ADMIN)
async function setRole(newRole) {
    try {
        await fetch(`${API_BASE}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'role', value: newRole })
        });
        state.role = newRole;
        renderApp();
        showToast(`Switched to ${newRole === 'admin' ? 'Program Officer / Admin' : 'Volunteer'} View`, 'info');
    } catch(e) {
        showToast("Failed to switch role", "error");
    }
}

function renderRoleUI() {
    const isAdmin = state.role === 'admin';
    const vBtn = document.getElementById('role-btn-volunteer');
    const aBtn = document.getElementById('role-btn-admin');
    const roleBadge = document.getElementById('current-role-badge');

    if (isAdmin) {
        if(aBtn) aBtn.className = 'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-amber-600 text-white shadow-sm';
        if(vBtn) vBtn.className = 'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 text-slate-400 hover:text-white';
        if (roleBadge) {
            roleBadge.textContent = 'Program Officer (PO) View';
            roleBadge.className = 'bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider';
        }
    } else {
        if(vBtn) vBtn.className = 'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-amber-600 text-white shadow-sm';
        if(aBtn) aBtn.className = 'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 text-slate-400 hover:text-white';
        if (roleBadge) {
            roleBadge.textContent = 'Volunteer View';
            roleBadge.className = 'bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider';
        }
    }

    // Toggle navigation buttons based on role
    const toggleNav = (id, show) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = ''; // Clear inline styles that might override hidden
            el.classList.toggle('hidden', !show);
        }
    };

    // Admin-only tabs & UI elements
    toggleNav('nav-admin', isAdmin);
    toggleNav('nav-directory', isAdmin);
    toggleNav('mobile-nav-admin', isAdmin);
    toggleNav('mobile-nav-directory', isAdmin);
    toggleNav('enrol-volunteer-btn', isAdmin);
    toggleNav('admin-dashboard-right-col', isAdmin);
    
    // Volunteer-only tabs
    toggleNav('nav-idcard', !isAdmin);
    toggleNav('mobile-nav-idcard', !isAdmin);
    
    // Switch to Dashboard if current tab becomes hidden
    if ((!isAdmin && (state.activeTab === 'admin' || state.activeTab === 'directory')) ||
        (isAdmin && state.activeTab === 'idcard')) {
        switchTab('dashboard');
    }

    // Pending badge count
    const pendingCount = state.attendanceQueue.length;
    const badge = document.getElementById('pending-badge');
    const mBadge = document.getElementById('mobile-pending-badge');
    if (badge) {
        badge.textContent = pendingCount;
        badge.classList.toggle('hidden', pendingCount === 0);
    }
    if (mBadge) {
        mBadge.textContent = pendingCount;
        mBadge.classList.toggle('hidden', pendingCount === 0);
    }
}

// BROADCAST ANNOUNCEMENT
function renderAnnouncement() {
    const el = document.getElementById('announcement-text');
    if (el && state.announcement) {
        el.textContent = state.announcement;
    }
}

function dismissAnnouncement() {
    const banner = document.getElementById('announcement-banner');
    if (banner) banner.classList.add('hidden');
}

async function handlePublishAnnouncement(e) {
    e.preventDefault();
    const input = document.getElementById('admin-announcement-input');
    if (input && input.value.trim()) {
        const newAnnouncement = input.value.trim();
        try {
            await fetch(`${API_BASE}/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'announcement', value: newAnnouncement })
            });
            state.announcement = newAnnouncement;
            const banner = document.getElementById('announcement-banner');
            if (banner) banner.classList.remove('hidden');
            renderApp();
            input.value = '';
            showToast('Broadcast Announcement Banner Updated!', 'success');
        } catch(err) {
             showToast('Failed to broadcast announcement', 'error');
        }
    }
}

// METRICS CALCULATION & RENDERING
function renderMetrics() {
    const isAdmin = state.role === 'admin';
    const adminMetrics = document.getElementById('admin-dashboard-metrics');
    const volMetrics = document.getElementById('volunteer-dashboard-metrics');
    
    if (adminMetrics) adminMetrics.style.display = isAdmin ? 'grid' : 'none';
    if (volMetrics) volMetrics.style.display = !isAdmin ? 'grid' : 'none';

    if (isAdmin) {
        const totalVolunteers = state.volunteers.length;
        const totalHours = state.volunteers.reduce((acc, v) => acc + (v.hours || 0), 0);
        const totalCamps = state.events.length;

        animateValue('metric-volunteers', parseInt(document.getElementById('metric-volunteers')?.textContent || '0'), totalVolunteers, 500);
        animateValue('metric-hours', parseInt(document.getElementById('metric-hours')?.textContent || '0'), totalHours, 500);
        animateValue('metric-camps', parseInt(document.getElementById('metric-camps')?.textContent || '0'), totalCamps, 500);
    } else {
        // Volunteer Personal Metrics (Mock Logged in Volunteer: First volunteer in DB)
        const myProfile = state.volunteers.length > 0 ? state.volunteers[0] : null;
        const myHours = myProfile ? myProfile.hours : 0;
        const myEventsCount = myProfile ? myProfile.registeredEvents.length : 0;
        
        let myStatus = 'Novice';
        if (myHours >= 120) myStatus = 'Gold Certified';
        else if (myHours >= 60) myStatus = 'Silver Verified';
        else if (myHours >= 20) myStatus = 'Active Member';

        animateValue('metric-my-hours', parseInt(document.getElementById('metric-my-hours')?.textContent || '0'), myHours, 500);
        animateValue('metric-my-events', parseInt(document.getElementById('metric-my-events')?.textContent || '0'), myEventsCount, 500);
        
        const statusEl = document.getElementById('metric-my-status');
        if (statusEl) statusEl.textContent = myStatus;

        const progressEl = document.getElementById('progress-my-hours');
        if (progressEl) {
            const percentage = Math.min((myHours / 120) * 100, 100);
            progressEl.style.width = percentage + '%';
            if (percentage === 100) progressEl.classList.replace('bg-amber-500', 'bg-emerald-500');
        }

        // Certificate UI Logic
        const certLocked = document.getElementById('cert-locked');
        const certUnlocked = document.getElementById('cert-unlocked');
        const certHoursNeeded = document.getElementById('cert-hours-needed');
        
        if (certLocked && certUnlocked && certHoursNeeded) {
            if (myHours >= 120) {
                certLocked.classList.add('hidden');
                certUnlocked.classList.remove('hidden');
            } else {
                certLocked.classList.remove('hidden');
                certUnlocked.classList.add('hidden');
                certHoursNeeded.textContent = 120 - myHours;
            }
        }
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (start === end) {
        obj.textContent = end.toLocaleString();
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// RECENT ACTIVITIES LIST
function renderRecentActivities() {
    const container = document.getElementById('recent-activities-list');
    if (!container) return;

    container.innerHTML = state.events.map(evt => {
        const statusColor = evt.status === 'Active Today' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                           evt.status === 'Upcoming' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                           'bg-slate-100 text-slate-700 border-slate-200';

        return `
            <div class="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-slate-900 text-sm sm:text-base">${evt.title}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}">${evt.status}</span>
                        <span class="text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded">${evt.category}</span>
                    </div>
                    <div class="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${evt.date}</span>
                        <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i> ${evt.venue}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0 sm:border-l sm:border-slate-200 sm:pl-4">
                    <div class="text-right">
                        <span class="text-xs font-bold text-slate-900 block">${evt.hours} Hrs Credit</span>
                        <span class="text-[11px] text-slate-500">${evt.registered}/${evt.target} Enrolled</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

// DEPARTMENT BREAKDOWN
function renderDeptBreakdown() {
    const container = document.getElementById('dept-breakdown-list');
    if (!container) return;

    const counts = {};
    state.volunteers.forEach(v => {
        counts[v.dept] = (counts[v.dept] || 0) + 1;
    });
    const total = state.volunteers.length || 1;

    const depts = [
        'Computer Science (CSE)',
        'Electronics (ECE)',
        'Mechanical (MECH)',
        'Civil Engineering',
        'Biotechnology',
        'Arts & Humanities'
    ];

    container.innerHTML = depts.map(dept => {
        const count = counts[dept] || 0;
        const pct = Math.round((count / total) * 100);
        const shortName = dept.split('(')[0].trim();

        return `
            <div>
                <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="text-slate-800">${shortName}</span>
                    <span class="text-slate-500">${count} (${pct}%)</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div class="bg-amber-600 h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// VOLUNTEER DIRECTORY TABLE
function renderDirectoryTable(filteredList = null) {
    const container = document.getElementById('volunteers-table-body');
    if (!container) return;

    const list = filteredList || state.volunteers;
    const countText = document.getElementById('directory-count-text');
    if (countText) countText.textContent = `Showing ${list.length} of ${state.volunteers.length} Volunteers`;

    if (list.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-slate-500">
                    <i data-lucide="users-xs" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                    No volunteer records found matching filters.
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = list.map(v => {
        const bloodBadgeClass = v.blood.includes('+') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-rose-50 text-rose-800 border-rose-200';

        return `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3.5 px-4 font-mono font-bold text-amber-800">${v.id}</td>
                <td class="py-3.5 px-4">
                    <div class="font-bold text-slate-900">${v.name}</div>
                    <div class="text-[11px] text-slate-500">${v.email} • ${v.phone}</div>
                </td>
                <td class="py-3.5 px-4">
                    <div class="font-medium text-slate-800">${v.dept}</div>
                    <div class="text-[11px] text-slate-500">${v.year} (Roll: ${v.roll})</div>
                </td>
                <td class="py-3.5 px-4">
                    <span class="inline-block px-2.5 py-0.5 font-bold text-xs rounded border ${bloodBadgeClass}">
                        ${v.blood}
                    </span>
                </td>
                <td class="py-3.5 px-4 text-center">
                    <span class="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                        ${v.hours} Hrs
                    </span>
                </td>
                <td class="py-3.5 px-4">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> ${v.status}
                    </span>
                </td>
                <td class="py-3.5 px-4 text-right">
                    <button onclick="previewVolunteerID('${v.id}')" class="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded transition">
                        View ID Card
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// DIRECTORY SEARCH & FILTERS
function filterDirectory() {
    const query = document.getElementById('dir-search')?.value.toLowerCase().trim() || '';
    const dept = document.getElementById('dir-filter-dept')?.value || 'ALL';
    const blood = document.getElementById('dir-filter-blood')?.value || 'ALL';

    const filtered = state.volunteers.filter(v => {
        const matchesQuery = v.name.toLowerCase().includes(query) || v.id.toLowerCase().includes(query) || v.roll.toLowerCase().includes(query);
        const matchesDept = dept === 'ALL' || v.dept === dept;
        const matchesBlood = blood === 'ALL' || v.blood === blood;
        return matchesQuery && matchesDept && matchesBlood;
    });

    renderDirectoryTable(filtered);
}

function resetDirectoryFilters() {
    if (document.getElementById('dir-search')) document.getElementById('dir-search').value = '';
    if (document.getElementById('dir-filter-dept')) document.getElementById('dir-filter-dept').value = 'ALL';
    if (document.getElementById('dir-filter-blood')) document.getElementById('dir-filter-blood').value = 'ALL';
    renderDirectoryTable();
}

// EVENT HUB RENDERING & REGISTRATION
let currentEventFilter = 'ALL';

function filterEvents(category) {
    currentEventFilter = category;
    document.querySelectorAll('.evt-filter-btn').forEach(btn => {
        btn.className = 'evt-filter-btn px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900';
    });
    const active = document.getElementById(`evt-filter-${category}`);
    if (active) {
        active.className = 'evt-filter-btn px-3 py-1.5 rounded-md text-xs font-semibold bg-white text-slate-900 shadow-sm border border-slate-200';
    }
    renderEventsGrid();
}

function renderEventsGrid() {
    const container = document.getElementById('events-grid');
    if (!container) return;

    const filtered = state.events.filter(e => {
        if (currentEventFilter === 'ALL') return true;
        return e.status === currentEventFilter;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
                No service drives found for category filter: <strong>${currentEventFilter}</strong>.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(e => {
        const isRegistered = state.volunteers[0]?.registeredEvents?.includes(e.id);
        const pct = Math.min(100, Math.round((e.registered / e.target) * 100));

        let btnHtml = '';
        if (e.status === 'Completed') {
            btnHtml = `<span class="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg block text-center">Drive Concluded</span>`;
        } else if (isRegistered) {
            btnHtml = `
                <button disabled class="w-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5">
                    <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i> Registered for Drive
                </button>
            `;
        } else {
            btnHtml = `
                <button onclick="registerForEvent('${e.id}')" class="w-full bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 text-xs font-bold px-3 py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm">
                    <i data-lucide="user-plus" class="w-4 h-4"></i> Register for Drive
                </button>
            `;
        }

        return `
            <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition">
                <div class="space-y-3">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider">${e.category}</span>
                        <span class="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold px-2.5 py-0.5 rounded">${e.hours} Credit Hours</span>
                    </div>

                    <div>
                        <h3 class="font-heading font-bold text-lg text-slate-900">${e.title}</h3>
                        <p class="text-xs text-slate-500 mt-1">In-Charge Officer: ${e.inCharge}</p>
                    </div>

                    <div class="space-y-1.5 text-xs text-slate-600 pt-1">
                        <div class="flex items-center gap-2">
                            <i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i> ${e.date}
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="map-pin" class="w-4 h-4 text-slate-400"></i> ${e.venue}
                        </div>
                    </div>
                </div>

                <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                        <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                            <span>Volunteer Enrolment Capacity</span>
                            <span>${e.registered} / ${e.target} (${pct}%)</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-2 border border-slate-200 overflow-hidden">
                            <div class="bg-amber-600 h-2 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>

                    ${btnHtml}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

async function registerForEvent(eventId) {
    const evt = state.events.find(e => e.id === eventId);
    if (!evt) return;

    // Register for first volunteer in demo
    const volunteer = state.volunteers[0];
    if (volunteer) {
        try {
            const res = await fetch(`${API_BASE}/events/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: eventId, volunteerId: volunteer.id })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh data
                await fetchInitialData();
                showToast(`Successfully registered for "${evt.title}"! Attendance pending PO approval.`, 'success');
            } else {
                showToast(data.message || 'Failed to register', 'error');
            }
        } catch (e) {
            showToast('Error registering for event', 'error');
        }
    }
}

// DIGITAL ID CARD PREVIEW & SELECTION
function populateIDCardDropdown() {
    const select = document.getElementById('id-select-volunteer');
    if (!select) return;

    select.innerHTML = state.volunteers.map(v => `
        <option value="${v.id}">${v.name} (${v.id} - ${v.dept})</option>
    `).join('');

    if (state.volunteers.length > 0) {
        updateIDCardView(state.volunteers[0].id);
    }
}

function previewVolunteerID(volunteerId) {
    switchTab('idcard');
    const select = document.getElementById('id-select-volunteer');
    if (select) {
        select.value = volunteerId;
        updateIDCardView(volunteerId);
    }
}

function updateIDCardView(volunteerId) {
    const v = state.volunteers.find(x => x.id === volunteerId);
    if (!v) return;

    document.getElementById('card-name').textContent = v.name;
    document.getElementById('card-id').textContent = v.id;
    document.getElementById('card-dept').textContent = `${v.dept} • ${v.year}`;
    document.getElementById('card-blood').textContent = `${v.blood} Positive`;
    document.getElementById('card-phone').textContent = v.phone;
    document.getElementById('card-hours').textContent = `${v.hours} Hrs Credit`;
}

// ADMIN ATTENDANCE APPROVAL QUEUE
function renderAttendanceQueue() {
    const container = document.getElementById('attendance-queue-body');
    const badge = document.getElementById('queue-count-badge');
    if (!container) return;

    if (badge) badge.textContent = `${state.attendanceQueue.length} Pending`;

    if (state.attendanceQueue.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-500">
                    No pending event attendance approvals. All clear!
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = state.attendanceQueue.map(item => `
        <tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-bold text-slate-900">${item.volunteerName}</td>
            <td class="py-3 px-4 font-mono font-bold text-amber-800 text-xs">${item.volunteerId}</td>
            <td class="py-3 px-4 font-medium text-slate-800">${item.eventTitle}</td>
            <td class="py-3 px-4 text-center">
                <span class="font-extrabold text-slate-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded">
                    +${item.hours} Hrs
                </span>
            </td>
            <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="approveAttendance('${item.id}')" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded transition border border-emerald-800 shadow-sm">
                        Approve Hours
                    </button>
                    <button onclick="rejectAttendance('${item.id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-300">
                        Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function approveAttendance(attendanceId) {
    try {
        const res = await fetch(`${API_BASE}/attendance/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: attendanceId })
        });
        const data = await res.json();
        if (data.success) {
            await fetchInitialData();
            showToast(`Approved +${data.addedHours} Service Credit Hours!`, 'success');
        } else {
            showToast('Failed to approve attendance', 'error');
        }
    } catch(e) {
        showToast('Error approving attendance', 'error');
    }
}

async function rejectAttendance(attendanceId) {
    try {
        const res = await fetch(`${API_BASE}/attendance/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: attendanceId })
        });
        const data = await res.json();
        if (data.success) {
            await fetchInitialData();
            showToast('Attendance request rejected.', 'info');
        } else {
            showToast('Failed to reject attendance', 'error');
        }
    } catch(e) {
        showToast('Error rejecting attendance', 'error');
    }
}

// CSV ACCREDITATION REPORT EXPORTER
function exportCSVReport() {
    const headers = ['NSS ID', 'Volunteer Name', 'Roll Number', 'Department', 'Year', 'Blood Group', 'Mobile Phone', 'Email', 'Verified Hours Logged', 'Enrolment Status'];
    
    const rows = state.volunteers.map(v => [
        `"${v.id}"`,
        `"${v.name}"`,
        `"${v.roll}"`,
        `"${v.dept}"`,
        `"${v.year}"`,
        `"${v.blood}"`,
        `"${v.phone}"`,
        `"${v.email}"`,
        v.hours,
        `"${v.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
        + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nss_volunteer_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported official NSS Accreditation Audit Report (CSV)!', 'success');
}

// VOLUNTEER REGISTRATION MODAL & SUBMISSION
function openRegistrationModal() {
    generateNextNSSID();
    document.getElementById('modal-register')?.classList.remove('hidden');
}

function closeRegistrationModal() {
    document.getElementById('modal-register')?.classList.add('hidden');
}

function generateNextNSSID() {
    const nextNum = 1001 + state.volunteers.length;
    const newId = `NSS-2026-${nextNum}`;
    const preview = document.getElementById('auto-nss-id-preview');
    if (preview) preview.textContent = newId;
    return newId;
}

async function handleRegistrationSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const roll = document.getElementById('reg-roll').value.trim();
    const year = document.getElementById('reg-year').value;
    const dept = document.getElementById('reg-dept').value;
    const blood = document.getElementById('reg-blood').value;
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();

    if (!name || !roll || !phone || !email) {
        showToast('Please fill in all required registration fields.', 'error');
        return;
    }

    const id = generateNextNSSID();

    try {
        const res = await fetch(`${API_BASE}/volunteers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, roll, dept, year, blood, phone, email })
        });
        
        if (res.ok) {
            await fetchInitialData();
            closeRegistrationModal();
            e.target.reset();
            showToast(`Volunteer ${name} successfully enrolled! NSS ID: ${id}`, 'success');
            switchTab('directory');
        } else {
            showToast('Failed to enroll volunteer.', 'error');
        }
    } catch(e) {
        showToast('Error submitting registration', 'error');
    }
}

// CREATE EVENT SUBMISSION
async function handleCreateEvent(e) {
    e.preventDefault();
    if (state.role !== 'admin') return;

    const title = document.getElementById('create-event-title').value.trim();
    const date = document.getElementById('create-event-date').value;
    const status = document.getElementById('create-event-status').value;
    const hours = parseInt(document.getElementById('create-event-hours').value);

    if (!title || !date || isNaN(hours) || hours <= 0) {
        showToast('Please fill all event fields correctly.', 'error');
        return;
    }

    const newEvent = {
        title,
        date,
        type: 'Community Drive',
        status,
        hours
    };

    try {
        const res = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEvent)
        });
        
        if (res.ok) {
            await fetchInitialData();
            e.target.reset();
            showToast(`Event "${title}" successfully created!`, 'success');
        } else {
            showToast('Failed to create event.', 'error');
        }
    } catch(err) {
        showToast('Error creating event', 'error');
    }
}

// MOBILE MENU TOGGLE
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const bgClass = type === 'success' ? 'bg-slate-900 border-emerald-500 text-white' :
                    type === 'error' ? 'bg-slate-900 border-red-500 text-white' :
                    'bg-slate-900 border-amber-500 text-white';

    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';

    const toast = document.createElement('div');
    toast.className = `toast-animate pointer-events-auto border-l-4 p-4 rounded-xl shadow-lg border border-slate-800 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${bgClass}`;
    toast.innerHTML = `
        <div class="flex items-center gap-2.5">
            <i data-lucide="${iconName}" class="w-5 h-5 shrink-0 ${type === 'success' ? 'text-emerald-400' : type === 'error' ? 'text-red-400' : 'text-amber-400'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white p-1">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
