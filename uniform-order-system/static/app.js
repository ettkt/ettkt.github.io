// === API Helper ===
async function api(path, options = {}) {
    const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

// === State ===
let currentPage = 'dashboard';

// === Router ===
const pages = {
    dashboard: renderDashboard,
    departments: renderDepartments,
    officers: renderOfficers,
    products: renderProducts,
    orders: renderOrders,
    lookup: renderLookup,
    inventory: renderInventory,
    notifications: renderNotifications,
    embroidery: renderEmbroidery,
    appointments: renderAppointments,
};

function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === page);
    });
    pages[page]();
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            navigate(a.dataset.page);
        });
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Create toast container
    if (!document.getElementById('toast-container')) {
        const tc = document.createElement('div');
        tc.id = 'toast-container';
        tc.className = 'toast-container';
        document.body.appendChild(tc);
    }

    navigate('dashboard');
});

// === Toast Notifications ===
function toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icons[type] || ''}${message}`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-exit');
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

// === Modal ===
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// === CSV Export ===
function downloadCSV(filename, headers, rows) {
    const escape = v => {
        const s = String(v == null ? '' : v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} rows to ${filename}`, 'success');
}

function exportPersonnel() {
    const data = window._allPersonnel || [];
    downloadCSV('personnel.csv',
        ['Badge #', 'First Name', 'Last Name', 'Rank', 'Department', 'Chest', 'Waist', 'Hips', 'Neck', 'Sleeve', 'Inseam', 'Shoulder', 'Notes'],
        data.map(o => [o.badge_number, o.first_name, o.last_name, o.rank, o.department_name, o.chest, o.waist, o.hips, o.neck, o.sleeve, o.inseam, o.shoulder, o.notes])
    );
}

function exportProducts() {
    const data = window._allProducts || [];
    downloadCSV('products.csv',
        ['Code', 'Name', 'Category', 'Base Price', 'Description', 'Sizes', 'Colors'],
        data.map(p => [p.code, p.name, p.category, p.base_price, p.description, p.sizes.join('; '), p.colors.join('; ')])
    );
}

function exportOrders() {
    const data = window._allOrders || [];
    downloadCSV('orders.csv',
        ['Order #', 'Department', 'Items', 'Total Value', 'Status', 'Date', 'Notes'],
        data.map(o => [o.order_number, o.department_name, o.item_count, o.total_value.toFixed(2), o.status, o.created_at, o.notes])
    );
}

// === Render Helpers ===
const main = () => document.getElementById('main-content');

const SERVICE_TYPES = ['Law Enforcement', 'Fire/EMS', 'Corrections', 'Security', 'Other'];
const SERVICE_COLORS = {
    'Law Enforcement': { bg: '#dbeafe', color: '#1e40af' },
    'Fire/EMS': { bg: '#fee2e2', color: '#b91c1c' },
    'Corrections': { bg: '#f3e8ff', color: '#6b21a8' },
    'Security': { bg: '#fef3c7', color: '#92400e' },
    'Other': { bg: '#f1f5f9', color: '#475569' },
};

function serviceBadge(type) {
    const c = SERVICE_COLORS[type] || SERVICE_COLORS['Other'];
    return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${type}</span>`;
}

const STATUS_LIST = ['pending', 'confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'];
const STATUS_LABELS = {
    pending: 'Pending', confirmed: 'Confirmed', in_production: 'In Production',
    quality_check: 'Quality Check', shipped: 'Shipped', delivered: 'Delivered',
};
const STATUS_COLORS = {
    pending: '#d97706', confirmed: '#2563eb', in_production: '#7c3aed',
    quality_check: '#b45309', shipped: '#2563eb', delivered: '#16a34a',
};

function statusBadge(status) {
    return `<span class="badge badge-${status}">${STATUS_LABELS[status] || status}</span>`;
}

function statusTimeline(currentStatus) {
    const idx = STATUS_LIST.indexOf(currentStatus);
    let html = '<div class="status-timeline">';
    STATUS_LIST.forEach((s, i) => {
        const cls = i < idx ? 'completed' : i === idx ? 'active' : '';
        html += `<div class="timeline-step ${cls}">
            <div class="timeline-dot">${i < idx ? '&#10003;' : i + 1}</div>
            <div class="timeline-label">${STATUS_LABELS[s]}</div>
        </div>`;
        if (i < STATUS_LIST.length - 1) {
            html += `<div class="timeline-line ${i < idx ? 'completed' : ''}"></div>`;
        }
    });
    html += '</div>';
    return html;
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n) {
    return '$' + Number(n).toFixed(2);
}

function daysAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return diff;
}

function ageBadge(iso, status) {
    if (status === 'delivered') return '';
    const days = daysAgo(iso);
    if (days <= 3) return `<span class="age-badge age-ok">${days}d</span>`;
    if (days <= 7) return `<span class="age-badge age-warn">${days}d</span>`;
    return `<span class="age-badge age-urgent">${days}d</span>`;
}

function copySku(sku) {
    navigator.clipboard.writeText(sku).then(() => toast('SKU copied to clipboard', 'info'));
}

function renderAllBarcodes() {
    document.querySelectorAll('.sku-barcode[data-sku]').forEach(svg => {
        if (svg.dataset.rendered) return;
        svg.dataset.rendered = '1';
        if (typeof JsBarcode !== 'undefined') {
            try {
                JsBarcode(svg, svg.dataset.sku, {
                    format: 'CODE128',
                    width: 1.5,
                    height: 40,
                    displayValue: true,
                    fontSize: 11,
                    margin: 4,
                    textMargin: 2,
                });
            } catch (e) { /* silent */ }
        }
    });
}

function renderAllQRCodes() {
    document.querySelectorAll('.sku-qr[data-sku]').forEach(canvas => {
        if (canvas.dataset.rendered) return;
        canvas.dataset.rendered = '1';
        if (typeof QRCode !== 'undefined') {
            try {
                QRCode.toCanvas(canvas, canvas.dataset.sku, { width: 100, margin: 1 });
            } catch (e) { /* silent */ }
        }
    });
}

function toggleCodes(wrapperId, sku) {
    const wrap = document.getElementById(wrapperId);
    if (!wrap) return;
    const isHidden = wrap.style.display === 'none';
    wrap.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
        const svg = wrap.querySelector('.sku-barcode');
        if (svg && !svg.dataset.rendered) {
            svg.dataset.rendered = '1';
            try { JsBarcode(svg, sku, { format: 'CODE128', width: 1.5, height: 40, displayValue: true, fontSize: 11, margin: 4, textMargin: 2 }); } catch (e) { /* silent */ }
        }
        const canvas = wrap.querySelector('.sku-qr');
        if (canvas && !canvas.dataset.rendered) {
            canvas.dataset.rendered = '1';
            try { QRCode.toCanvas(canvas, sku, { width: 100, margin: 1 }); } catch (e) { /* silent */ }
        }
    }
}

function measurementCount(officer) {
    return ['chest', 'waist', 'hips', 'neck', 'sleeve', 'inseam', 'shoulder'].filter(k => officer[k]).length;
}

function measurementAge(officer) {
    if (!officer.measurements_updated_at) return null;
    const ms = Date.now() - new Date(officer.measurements_updated_at).getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 month ago';
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    return years === 1 ? '1 year ago' : `${years} years ago`;
}

function isMeasurementStale(officer) {
    if (measurementCount(officer) === 0) return false;
    if (!officer.measurements_updated_at) return true;
    const ms = Date.now() - new Date(officer.measurements_updated_at).getTime();
    return ms > 180 * 86400000;
}

function measurementStaleBadge(officer) {
    const count = measurementCount(officer);
    if (count === 0) return '<span class="measure-badge measure-none">0/7</span>';
    if (isMeasurementStale(officer)) {
        const age = measurementAge(officer);
        return `<span class="measure-badge measure-stale">Stale${age ? ' · ' + age : ''}</span>`;
    }
    const age = measurementAge(officer);
    if (count === 7) return `<span class="measure-badge measure-complete">${count}/7${age ? ' · ' + age : ''}</span>`;
    return `<span class="measure-badge measure-partial">${count}/7${age ? ' · ' + age : ''}</span>`;
}

function stockStatusBadge(product) {
    const qty = product.stock_quantity;
    const threshold = product.reorder_threshold;
    if (qty <= 0) return '<span class="stock-badge stock-out">Out of Stock</span>';
    if (qty <= threshold) return `<span class="stock-badge stock-low">${qty} left</span>`;
    if (qty <= threshold * 1.5) return `<span class="stock-badge stock-warn">${qty} in stock</span>`;
    return `<span class="stock-badge stock-good">${qty} in stock</span>`;
}

// ============================================================
//  DASHBOARD
// ============================================================
async function renderDashboard() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    try {
        const data = await api('/dashboard');
        const maxRevenue = Math.max(...data.revenue_by_department.map(d => d.revenue), 1);

        main().innerHTML = `
            <div class="page-header">
                <h1>Dashboard</h1>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="showCreateOrder()">+ New Order</button>
                    <button class="btn btn-secondary btn-sm" onclick="showDepartmentForm()">+ Department</button>
                    <button class="btn btn-secondary btn-sm" onclick="navigate('lookup')">SKU Lookup</button>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Departments</div>
                    <div class="value">${data.total_departments}</div>
                    <div class="sub">Active agencies</div>
                </div>
                <div class="stat-card">
                    <div class="label">Personnel</div>
                    <div class="value">${data.total_officers}</div>
                    <div class="sub">Registered members</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Revenue</div>
                    <div class="value">${formatCurrency(data.total_revenue)}</div>
                    <div class="sub">Avg ${formatCurrency(data.avg_order_value)} per order</div>
                </div>
                <div class="stat-card">
                    <div class="label">Pending Items</div>
                    <div class="value">${data.pending_items}</div>
                    <div class="sub">${data.pending_orders} order${data.pending_orders !== 1 ? 's' : ''} awaiting fulfillment</div>
                </div>
                <div class="stat-card ${data.measurements_due > 0 ? 'stat-card-warning' : ''}">
                    <div class="label">Measurements Due</div>
                    <div class="value">${data.measurements_due}</div>
                    <div class="sub">Personnel needing re-measurement</div>
                </div>
                <div class="stat-card ${data.low_stock_count > 0 ? 'stat-card-danger' : ''}">
                    <div class="label">Low Stock Alerts</div>
                    <div class="value">${data.low_stock_count}</div>
                    <div class="sub"><a href="#" onclick="event.preventDefault();navigate('inventory')" style="color:var(--primary);text-decoration:none">View inventory</a></div>
                </div>
                <div class="stat-card">
                    <div class="label">Notifications Sent</div>
                    <div class="value">${data.notification_count}</div>
                    <div class="sub"><a href="#" onclick="event.preventDefault();navigate('notifications')" style="color:var(--primary);text-decoration:none">View log</a></div>
                </div>
                <div class="stat-card ${data.embroidery_pending > 0 ? 'stat-card-warning' : ''}" style="cursor:pointer" onclick="navigate('embroidery')">
                    <div class="label">Embroidery Queue</div>
                    <div class="value">${data.embroidery_pending}</div>
                    <div class="sub"><a href="#" onclick="event.preventDefault();navigate('embroidery')" style="color:var(--primary);text-decoration:none">View production queue</a></div>
                </div>
                <div class="stat-card" style="cursor:pointer" onclick="navigate('appointments')">
                    <div class="label">Today's Appointments</div>
                    <div class="value">${data.appointments_today}</div>
                    <div class="sub"><a href="#" onclick="event.preventDefault();navigate('appointments')" style="color:var(--primary);text-decoration:none">View schedule</a></div>
                </div>
            </div>

            <div class="dashboard-grid-2">
                <div class="card">
                    <div class="card-header"><h2>Revenue by Department</h2></div>
                    <div class="card-body">
                        ${data.revenue_by_department.length > 0 ? `<div class="bar-chart">
                            ${data.revenue_by_department.map(d => `
                                <div class="bar-row">
                                    <div class="bar-label">${d.code}</div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width:${(d.revenue / maxRevenue * 100).toFixed(1)}%;background:var(--primary)"></div>
                                    </div>
                                    <div class="bar-value">${formatCurrency(d.revenue)}</div>
                                </div>
                            `).join('')}
                        </div>` : '<p class="text-secondary text-sm">No revenue data yet</p>'}
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h2>Orders by Status</h2></div>
                    <div class="card-body">
                        <div class="bar-chart">
                            ${STATUS_LIST.map(s => {
                                const count = data.orders_by_status[s] || 0;
                                const pct = data.total_orders > 0 ? (count / data.total_orders * 100) : 0;
                                return `<div class="bar-row">
                                    <div class="bar-label">${STATUS_LABELS[s]}</div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${STATUS_COLORS[s]}"></div>
                                    </div>
                                    <div class="bar-value">${count}</div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>

            ${data.low_stock_items && data.low_stock_items.length > 0 ? `
            <div class="card">
                <div class="card-header">
                    <h2>Low Stock Items</h2>
                    <button class="btn btn-secondary btn-sm" onclick="navigate('inventory')">View All</button>
                </div>
                <div class="card-body table-wrap">
                    <table>
                        <thead><tr><th>Code</th><th>Product</th><th>In Stock</th><th>Threshold</th><th>Status</th></tr></thead>
                        <tbody>
                            ${data.low_stock_items.map(item => `
                                <tr>
                                    <td class="font-mono">${item.code}</td>
                                    <td>${item.name}</td>
                                    <td><strong>${item.stock_quantity}</strong></td>
                                    <td class="text-secondary">${item.reorder_threshold}</td>
                                    <td>${item.stock_quantity <= 0
                                        ? '<span class="stock-badge stock-out">Out of Stock</span>'
                                        : '<span class="stock-badge stock-low">Low Stock</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}

            <div class="card">
                <div class="card-header"><h2>Recent Orders</h2></div>
                <div class="card-body table-wrap">
                    <table>
                        <thead><tr>
                            <th>Order #</th><th>Department</th><th>Items</th><th>Value</th><th>Status</th><th>Date</th>
                        </tr></thead>
                        <tbody>
                            ${data.recent_orders.map(o => `
                                <tr style="cursor:pointer" onclick="viewOrder(${o.id})">
                                    <td class="font-mono">${o.order_number}</td>
                                    <td>${o.department_name}</td>
                                    <td>${o.item_count}</td>
                                    <td>${formatCurrency(o.total_value)}</td>
                                    <td>${statusBadge(o.status)} ${ageBadge(o.created_at, o.status)}</td>
                                    <td class="text-secondary">${formatDate(o.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        main().innerHTML = `<div class="empty-state">Error loading dashboard: ${e.message}</div>`;
    }
}

// ============================================================
//  DEPARTMENTS
// ============================================================
async function renderDepartments() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    const depts = await api('/departments');
    window._allDepartments = depts;

    main().innerHTML = `
        <div class="page-header">
            <h1>Departments</h1>
            <button class="btn btn-primary" onclick="showDepartmentForm()">+ Add Department</button>
        </div>
        <div class="card">
            <div class="card-body" style="padding:12px 20px;border-bottom:1px solid var(--border)">
                <input type="text" id="dept-search" placeholder="Search by name, code, service type, or contact..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px" oninput="filterDepartmentsTable(this.value)">
            </div>
            <div class="card-body table-wrap" style="padding-top:0">
                <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Service</th><th>Contact</th><th>Personnel</th><th>Orders</th><th></th></tr></thead>
                    <tbody id="departments-tbody"></tbody>
                </table>
                <p class="text-xs text-secondary mt-2" id="departments-count" style="display:none"></p>
            </div>
        </div>
    `;
    filterDepartmentsTable('');
}

function filterDepartmentsTable(searchTerm) {
    const depts = window._allDepartments || [];
    const filtered = searchTerm
        ? depts.filter(d => `${d.name} ${d.code} ${d.service_type} ${d.contact_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
        : depts;

    document.getElementById('departments-tbody').innerHTML = filtered.length > 0
        ? filtered.map(d => `
            <tr>
                <td><span class="font-mono" style="background:var(--primary-light);padding:2px 8px;border-radius:4px;font-weight:600;color:var(--primary)">${d.code}</span></td>
                <td><strong>${d.name}</strong></td>
                <td>${serviceBadge(d.service_type)}</td>
                <td class="text-sm text-secondary">${d.contact_name || '-'}</td>
                <td>${d.personnel_count}</td>
                <td>${d.order_count}</td>
                <td class="flex gap-2">
                    <button class="btn btn-secondary btn-sm" onclick="viewDepartment(${d.id})">View</button>
                    <button class="btn btn-secondary btn-sm" onclick="showDepartmentForm(${d.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')">Delete</button>
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="7" class="text-secondary text-sm" style="text-align:center;padding:20px">${searchTerm ? 'No matches found' : 'No departments registered'}</td></tr>`;

    const countEl = document.getElementById('departments-count');
    if (searchTerm) {
        countEl.textContent = `${filtered.length} of ${depts.length} departments shown`;
        countEl.style.display = 'block';
    } else {
        countEl.style.display = 'none';
    }
}

async function showDepartmentForm(id) {
    let dept = { name: '', code: '', service_type: 'Law Enforcement', contact_name: '', contact_email: '', contact_phone: '', address: '' };
    const isEdit = !!id;
    if (isEdit) dept = await api(`/departments/${id}`);

    openModal(isEdit ? 'Edit Department' : 'Add Department', `
        <form onsubmit="submitDepartment(event, ${id || 'null'})">
            <div class="form-row">
                <div class="form-group"><label>Department Name *</label><input id="dept-name" required value="${dept.name}"></div>
                <div class="form-group"><label>Code * (e.g., MPD)</label><input id="dept-code" required maxlength="10" style="text-transform:uppercase" value="${dept.code}"></div>
            </div>
            <div class="form-group"><label>Service Type *</label>
                <select id="dept-service" required>
                    ${SERVICE_TYPES.map(s => `<option value="${s}" ${s === dept.service_type ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Contact Name</label><input id="dept-contact" value="${dept.contact_name}"></div>
                <div class="form-group"><label>Contact Email</label><input id="dept-email" type="email" value="${dept.contact_email}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Phone</label><input id="dept-phone" value="${dept.contact_phone}"></div>
                <div class="form-group"><label>Address</label><input id="dept-address" value="${dept.address}"></div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Department'}</button>
            </div>
        </form>
    `);
}

async function submitDepartment(e, id) {
    e.preventDefault();
    const body = JSON.stringify({
        name: document.getElementById('dept-name').value,
        code: document.getElementById('dept-code').value.toUpperCase(),
        service_type: document.getElementById('dept-service').value,
        contact_name: document.getElementById('dept-contact').value,
        contact_email: document.getElementById('dept-email').value,
        contact_phone: document.getElementById('dept-phone').value,
        address: document.getElementById('dept-address').value,
    });
    try {
        if (id) {
            await api(`/departments/${id}`, { method: 'PUT', body });
            toast('Department updated successfully');
        } else {
            await api('/departments', { method: 'POST', body });
            toast('Department created successfully');
        }
        closeModal();
        renderDepartments();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteDepartment(id, name) {
    if (!confirm(`Delete "${name}"? This will also remove all personnel in this department.`)) return;
    try {
        await api(`/departments/${id}`, { method: 'DELETE' });
        toast('Department deleted');
        renderDepartments();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function viewDepartment(id) {
    const dept = await api(`/departments/${id}`);
    const officers = await api(`/officers?department_id=${id}`);
    openModal(dept.name, `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <span class="font-mono" style="background:var(--primary-light);padding:3px 10px;border-radius:4px;font-weight:700;color:var(--primary);font-size:16px">${dept.code}</span>
                ${serviceBadge(dept.service_type)}
                <span class="text-secondary text-sm">${dept.contact_name} | ${dept.contact_email || 'No email'}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="closeModal(); showDepartmentForm(${dept.id})">Edit</button>
        </div>
        ${dept.contact_phone ? `<p class="text-sm text-secondary mb-4">${dept.contact_phone} ${dept.address ? '| ' + dept.address : ''}</p>` : ''}
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Personnel (${officers.length})</h3>
        <table>
            <thead><tr><th>Badge</th><th>Name</th><th>Rank</th></tr></thead>
            <tbody>
                ${officers.map(o => `<tr><td class="font-mono">${o.badge_number}</td><td>${o.first_name} ${o.last_name}</td><td>${o.rank}</td></tr>`).join('')}
                ${officers.length === 0 ? '<tr><td colspan="3" class="text-secondary text-sm" style="text-align:center;padding:20px">No personnel registered</td></tr>' : ''}
            </tbody>
        </table>
    `);
}

// ============================================================
//  OFFICERS / PERSONNEL
// ============================================================
async function renderOfficers() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    const [officers, depts] = await Promise.all([api('/officers'), api('/departments')]);
    window._depts = depts;
    window._allPersonnel = officers;

    main().innerHTML = `
        <div class="page-header">
            <h1>Personnel</h1>
            <div class="flex gap-2">
                <button class="btn btn-export btn-sm" onclick="exportPersonnel()">Export CSV</button>
                <button class="btn btn-secondary btn-sm" onclick="showCSVImport()">Import CSV</button>
                <button class="btn btn-primary" onclick="showOfficerForm()">+ Add Personnel</button>
            </div>
        </div>
        <div class="card">
            <div class="card-body" style="padding:12px 20px;border-bottom:1px solid var(--border)">
                <input type="text" id="personnel-search" placeholder="Search by name, ID, rank, or department..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px" oninput="filterPersonnelTable(this.value)">
            </div>
            <div class="card-body table-wrap" style="padding-top:0">
                <table>
                    <thead><tr><th>ID #</th><th>Name</th><th>Rank / Title</th><th>Department</th><th>Measurements</th><th></th></tr></thead>
                    <tbody id="personnel-tbody"></tbody>
                </table>
                <p class="text-xs text-secondary mt-2" id="personnel-count" style="display:none"></p>
            </div>
        </div>
    `;
    filterPersonnelTable('');
}

function filterPersonnelTable(searchTerm) {
    const officers = window._allPersonnel || [];
    const filtered = searchTerm
        ? officers.filter(o => `${o.first_name} ${o.last_name} ${o.badge_number} ${o.rank} ${o.department_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
        : officers;

    document.getElementById('personnel-tbody').innerHTML = filtered.length > 0
        ? filtered.map(o => `
            <tr>
                <td class="font-mono">${o.badge_number}</td>
                <td><strong>${o.first_name} ${o.last_name}</strong></td>
                <td>${o.rank || '-'}</td>
                <td>${o.department_name}</td>
                <td>${measurementStaleBadge(o)}</td>
                <td class="flex gap-2">
                    <button class="btn btn-secondary btn-sm" onclick="viewOfficer(${o.id})">View</button>
                    <button class="btn btn-secondary btn-sm" onclick="showOfficerForm(${o.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteOfficer(${o.id}, '${(o.first_name + ' ' + o.last_name).replace(/'/g, "\\'")}')">Delete</button>
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="6" class="text-secondary text-sm" style="text-align:center;padding:20px">${searchTerm ? 'No matches found' : 'No personnel registered'}</td></tr>`;

    const countEl = document.getElementById('personnel-count');
    if (searchTerm) {
        countEl.textContent = `${filtered.length} of ${officers.length} personnel shown`;
        countEl.style.display = 'block';
    } else {
        countEl.style.display = 'none';
    }
}

// === CSV Import ===
function showCSVImport() {
    const depts = window._depts || [];
    openModal('Import Personnel from CSV', `
        <div class="form-group">
            <label>Target Department *</label>
            <select id="import-dept" required>
                <option value="">Select department...</option>
                ${depts.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('')}
            </select>
        </div>
        <div class="csv-dropzone" id="csv-dropzone" onclick="document.getElementById('csv-file').click()"
             ondragover="event.preventDefault(); this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="event.preventDefault(); this.classList.remove('drag-over'); handleCSVDrop(event)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p>Drag & drop a CSV file here, or click to browse</p>
            <p class="csv-hint">Required columns: first_name, last_name, badge_number<br>Optional: rank, chest, waist, hips, neck, sleeve, inseam, shoulder, notes</p>
        </div>
        <input type="file" id="csv-file" accept=".csv" style="display:none" onchange="handleCSVFile(this.files[0])">
        <div id="csv-preview" style="display:none">
            <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px">Preview</h3>
            <div class="csv-preview-table" id="csv-preview-table"></div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="submitCSVImport()" id="csv-import-btn">Import 0 Personnel</button>
            </div>
        </div>
    `);
}

function handleCSVDrop(event) {
    const file = event.dataTransfer.files[0];
    if (file) handleCSVFile(file);
}

function handleCSVFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
        toast('Please select a CSV file', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target.result);
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    if (lines.length < 2) { toast('CSV must have a header row and at least one data row', 'error'); return; }

    const headers = lines[0].map(h => h.toLowerCase().replace(/[^a-z_]/g, ''));
    const required = ['first_name', 'last_name', 'badge_number'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) { toast(`Missing required columns: ${missing.join(', ')}`, 'error'); return; }

    const rows = lines.slice(1).filter(r => r.length >= 3 && r.some(c => c.length > 0));
    window._csvParsed = rows.map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i] || ''; });
        return obj;
    });

    document.getElementById('csv-preview').style.display = 'block';
    document.getElementById('csv-dropzone').style.display = 'none';
    document.getElementById('csv-import-btn').textContent = `Import ${window._csvParsed.length} Personnel`;

    const previewRows = window._csvParsed.slice(0, 10);
    document.getElementById('csv-preview-table').innerHTML = `
        <table>
            <thead><tr><th>Badge #</th><th>Name</th><th>Rank</th><th>Measurements</th></tr></thead>
            <tbody>
                ${previewRows.map(r => `<tr>
                    <td class="font-mono">${r.badge_number}</td>
                    <td>${r.first_name} ${r.last_name}</td>
                    <td>${r.rank || '-'}</td>
                    <td class="text-sm text-secondary">${r.chest ? 'Yes' : 'None'}</td>
                </tr>`).join('')}
                ${window._csvParsed.length > 10 ? `<tr><td colspan="4" class="text-secondary text-sm" style="text-align:center">...and ${window._csvParsed.length - 10} more</td></tr>` : ''}
            </tbody>
        </table>
    `;
}

async function submitCSVImport() {
    const deptId = document.getElementById('import-dept').value;
    if (!deptId) { toast('Please select a department', 'error'); return; }

    const data = (window._csvParsed || []).map(r => ({
        department_id: parseInt(deptId),
        first_name: r.first_name,
        last_name: r.last_name,
        badge_number: r.badge_number,
        rank: r.rank || '',
        chest: parseFloat(r.chest) || null,
        waist: parseFloat(r.waist) || null,
        hips: parseFloat(r.hips) || null,
        neck: parseFloat(r.neck) || null,
        sleeve: parseFloat(r.sleeve) || null,
        inseam: parseFloat(r.inseam) || null,
        shoulder: parseFloat(r.shoulder) || null,
        notes: r.notes || '',
    }));

    try {
        await api('/officers/bulk', { method: 'POST', body: JSON.stringify(data) });
        toast(`Successfully imported ${data.length} personnel`, 'success');
        closeModal();
        renderOfficers();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function showOfficerForm(id) {
    const depts = window._depts || [];
    let o = { department_id: '', first_name: '', last_name: '', badge_number: '', rank: '', chest: '', waist: '', hips: '', neck: '', sleeve: '', inseam: '', shoulder: '', notes: '' };
    const isEdit = !!id;
    if (isEdit) o = await api(`/officers/${id}`);

    const nv = v => (v === null || v === undefined) ? '' : v;

    openModal(isEdit ? 'Edit Personnel' : 'Add Personnel', `
        <form onsubmit="submitOfficer(event, ${id || 'null'})">
            <div class="form-group"><label>Department *</label>
                <select id="off-dept" required>
                    <option value="">Select department...</option>
                    ${depts.map(d => `<option value="${d.id}" ${d.id === o.department_id ? 'selected' : ''}>${d.name} (${d.code})</option>`).join('')}
                </select>
            </div>
            <div class="form-row-3">
                <div class="form-group"><label>First Name *</label><input id="off-first" required value="${o.first_name}"></div>
                <div class="form-group"><label>Last Name *</label><input id="off-last" required value="${o.last_name}"></div>
                <div class="form-group"><label>ID / Badge # *</label><input id="off-badge" required value="${o.badge_number}"></div>
            </div>
            <div class="form-group"><label>Rank / Title</label><input id="off-rank" value="${o.rank}"></div>
            <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:var(--text-secondary)">Measurements (inches)</h3>
            <div class="form-row-3">
                <div class="form-group"><label>Chest</label><input id="off-chest" type="number" step="0.5" value="${nv(o.chest)}"></div>
                <div class="form-group"><label>Waist</label><input id="off-waist" type="number" step="0.5" value="${nv(o.waist)}"></div>
                <div class="form-group"><label>Hips</label><input id="off-hips" type="number" step="0.5" value="${nv(o.hips)}"></div>
            </div>
            <div class="form-row-3">
                <div class="form-group"><label>Neck</label><input id="off-neck" type="number" step="0.5" value="${nv(o.neck)}"></div>
                <div class="form-group"><label>Sleeve</label><input id="off-sleeve" type="number" step="0.5" value="${nv(o.sleeve)}"></div>
                <div class="form-group"><label>Inseam</label><input id="off-inseam" type="number" step="0.5" value="${nv(o.inseam)}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Shoulder</label><input id="off-shoulder" type="number" step="0.5" value="${nv(o.shoulder)}"></div>
                <div class="form-group"></div>
            </div>
            <div class="form-group"><label>Custom Notes</label><textarea id="off-notes" rows="2" placeholder="e.g., Badge placement 2 inches from top seam">${o.notes}</textarea></div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Personnel'}</button>
            </div>
        </form>
    `);
}

async function submitOfficer(e, id) {
    e.preventDefault();
    const val = fid => document.getElementById(fid).value;
    const num = fid => { const v = document.getElementById(fid).value; return v ? parseFloat(v) : null; };
    const body = JSON.stringify({
        department_id: parseInt(val('off-dept')),
        first_name: val('off-first'),
        last_name: val('off-last'),
        badge_number: val('off-badge'),
        rank: val('off-rank'),
        chest: num('off-chest'), waist: num('off-waist'), hips: num('off-hips'),
        neck: num('off-neck'), sleeve: num('off-sleeve'), inseam: num('off-inseam'),
        shoulder: num('off-shoulder'),
        notes: val('off-notes'),
    });
    try {
        if (id) {
            await api(`/officers/${id}`, { method: 'PUT', body });
            toast('Personnel updated successfully');
        } else {
            await api('/officers', { method: 'POST', body });
            toast('Personnel added successfully');
        }
        closeModal();
        renderOfficers();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteOfficer(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
        await api(`/officers/${id}`, { method: 'DELETE' });
        toast('Personnel deleted');
        renderOfficers();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function viewOfficer(id) {
    const o = await api(`/officers/${id}`);
    const measurements = [
        { label: 'Chest', val: o.chest },
        { label: 'Waist', val: o.waist },
        { label: 'Hips', val: o.hips },
        { label: 'Neck', val: o.neck },
        { label: 'Sleeve', val: o.sleeve },
        { label: 'Inseam', val: o.inseam },
        { label: 'Shoulder', val: o.shoulder },
    ].filter(m => m.val);

    openModal(`${o.first_name} ${o.last_name}`, `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <span class="font-mono" style="background:var(--primary-light);padding:3px 10px;border-radius:4px;font-weight:700;color:var(--primary)">${o.badge_number}</span>
                <span>${o.rank || 'Member'}</span>
                <span class="text-secondary">|</span>
                <span class="text-secondary">${o.department_name}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="closeModal(); showOfficerForm(${o.id})">Edit</button>
        </div>
        ${measurements.length > 0 ? `
            <div class="flex items-center justify-between" style="margin-bottom:10px">
                <h3 style="font-size:14px;font-weight:600">Body Measurements</h3>
                <span class="text-xs text-secondary">${o.measurements_updated_at
                    ? 'Last measured: ' + measurementAge(o) + (isMeasurementStale(o) ? ' <span class="measure-badge measure-stale">Stale</span>' : '')
                    : '<span class="measure-badge measure-stale">No measurement date</span>'}</span>
            </div>
            <div class="measurement-grid">
                ${measurements.map(m => `
                    <div class="measurement-item">
                        <div class="m-label">${m.label}</div>
                        <div class="m-value">${m.val}<span class="m-unit">"</span></div>
                    </div>
                `).join('')}
            </div>
        ` : '<p class="text-secondary text-sm mb-4">No measurements recorded</p>'}
        ${o.notes ? `
            <div class="mt-4">
                <h3 style="font-size:14px;font-weight:600;margin-bottom:4px">Custom Notes</h3>
                <p class="text-sm" style="background:var(--bg);padding:10px 14px;border-radius:6px">${o.notes}</p>
            </div>
        ` : ''}
    `);
}

// ============================================================
//  PRODUCTS
// ============================================================
async function renderProducts() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    const products = await api('/products');
    window._allProducts = products;

    main().innerHTML = `
        <div class="page-header">
            <h1>Products</h1>
            <div class="flex gap-2">
                <button class="btn btn-export btn-sm" onclick="exportProducts()">Export CSV</button>
                <button class="btn btn-primary" onclick="showProductForm()">+ Add Product</button>
            </div>
        </div>
        <div class="card">
            <div class="card-body" style="padding:12px 20px;border-bottom:1px solid var(--border)">
                <input type="text" id="product-search" placeholder="Search by name, code, category, or description..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px" oninput="filterProductsTable(this.value)">
            </div>
            <div class="card-body table-wrap" style="padding-top:0">
                <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Base Price</th><th>Stock</th><th>Sizes</th><th>Colors</th><th></th></tr></thead>
                    <tbody id="products-tbody"></tbody>
                </table>
                <p class="text-xs text-secondary mt-2" id="products-count" style="display:none"></p>
            </div>
        </div>
    `;
    filterProductsTable('');
}

function filterProductsTable(searchTerm) {
    const products = window._allProducts || [];
    const filtered = searchTerm
        ? products.filter(p => `${p.name} ${p.code} ${p.category} ${p.description} ${p.colors.join(' ')}`.toLowerCase().includes(searchTerm.toLowerCase()))
        : products;

    document.getElementById('products-tbody').innerHTML = filtered.length > 0
        ? filtered.map(p => `
            <tr>
                <td><span class="font-mono" style="background:#f0fdf4;padding:2px 8px;border-radius:4px;font-weight:600;color:var(--success)">${p.code}</span></td>
                <td><strong>${p.name}</strong><br><span class="text-xs text-secondary">${p.description}</span></td>
                <td>${p.category}</td>
                <td>${formatCurrency(p.base_price)}</td>
                <td>${stockStatusBadge(p)}</td>
                <td class="text-sm">${p.sizes.length} options</td>
                <td class="text-sm">${p.colors.join(', ')}</td>
                <td class="flex gap-2">
                    <button class="btn btn-secondary btn-sm" onclick="showProductForm(${p.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Delete</button>
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="8" class="text-secondary text-sm" style="text-align:center;padding:20px">${searchTerm ? 'No matches found' : 'No products registered'}</td></tr>`;

    const countEl = document.getElementById('products-count');
    if (searchTerm) {
        countEl.textContent = `${filtered.length} of ${products.length} products shown`;
        countEl.style.display = 'block';
    } else {
        countEl.style.display = 'none';
    }
}

async function showProductForm(id) {
    let p = { name: '', code: '', category: 'Shirts', description: '', base_price: 0, sizes: [], colors: [], stock_quantity: 0, reorder_threshold: 10 };
    const isEdit = !!id;
    if (isEdit) p = await api(`/products`).then(prods => prods.find(x => x.id === id));

    openModal(isEdit ? 'Edit Product' : 'Add Product', `
        <form onsubmit="submitProduct(event, ${id || 'null'})">
            <div class="form-row">
                <div class="form-group"><label>Product Name *</label><input id="prod-name" required value="${p.name}"></div>
                <div class="form-group"><label>Code * (e.g., CAS)</label><input id="prod-code" required maxlength="10" style="text-transform:uppercase" value="${p.code}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Category *</label>
                    <select id="prod-cat" required>
                        ${['Shirts','Pants','Outerwear','Accessories','Footwear'].map(c => `<option value="${c}" ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Base Price ($)</label><input id="prod-price" type="number" step="0.01" value="${p.base_price}"></div>
            </div>
            <div class="form-group"><label>Description</label><textarea id="prod-desc" rows="2">${p.description}</textarea></div>
            <div class="form-group"><label>Sizes (comma-separated)</label><input id="prod-sizes" placeholder="S, M, L, XL, 2XL" value="${p.sizes.join(', ')}"></div>
            <div class="form-group"><label>Colors (comma-separated)</label><input id="prod-colors" placeholder="Navy, Black, White" value="${p.colors.join(', ')}"></div>
            <div class="form-row">
                <div class="form-group"><label>Stock Quantity</label><input id="prod-stock" type="number" min="0" value="${p.stock_quantity || 0}"></div>
                <div class="form-group"><label>Reorder Threshold</label><input id="prod-threshold" type="number" min="0" value="${p.reorder_threshold || 10}"></div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Product'}</button>
            </div>
        </form>
    `);
}

async function submitProduct(e, id) {
    e.preventDefault();
    const val = fid => document.getElementById(fid).value;
    const body = JSON.stringify({
        name: val('prod-name'),
        code: val('prod-code').toUpperCase(),
        category: val('prod-cat'),
        description: val('prod-desc'),
        base_price: parseFloat(val('prod-price')) || 0,
        sizes: val('prod-sizes').split(',').map(s => s.trim()).filter(Boolean),
        colors: val('prod-colors').split(',').map(s => s.trim()).filter(Boolean),
        stock_quantity: parseInt(val('prod-stock')) || 0,
        reorder_threshold: parseInt(val('prod-threshold')) || 10,
    });
    try {
        if (id) {
            await api(`/products/${id}`, { method: 'PUT', body });
            toast('Product updated successfully');
        } else {
            await api('/products', { method: 'POST', body });
            toast('Product created successfully');
        }
        closeModal();
        renderProducts();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Delete product "${name}"?`)) return;
    try {
        await api(`/products/${id}`, { method: 'DELETE' });
        toast('Product deleted');
        renderProducts();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================
//  ORDERS
// ============================================================
async function renderOrders() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    const orders = await api('/orders');
    window._allOrders = orders;

    main().innerHTML = `
        <div class="page-header">
            <h1>Orders</h1>
            <div class="flex gap-2">
                <button class="btn btn-export btn-sm" onclick="exportOrders()">Export CSV</button>
                <button class="btn btn-primary" onclick="showCreateOrder()">+ Create Order</button>
            </div>
        </div>
        <div class="card">
            <div class="card-body" style="padding:12px 20px;border-bottom:1px solid var(--border)">
                <input type="text" id="orders-search" placeholder="Search by order #, department, or status..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px" oninput="filterOrdersTable(this.value)">
            </div>
            <div class="card-body table-wrap" style="padding-top:0">
                <table>
                    <thead><tr><th>Order #</th><th>Department</th><th>Items</th><th>Value</th><th>Status</th><th>Date</th><th></th></tr></thead>
                    <tbody id="orders-tbody"></tbody>
                </table>
                <p class="text-xs text-secondary mt-2" id="orders-count" style="display:none"></p>
            </div>
        </div>
    `;
    filterOrdersTable('');
}

function filterOrdersTable(searchTerm) {
    const orders = window._allOrders || [];
    const filtered = searchTerm
        ? orders.filter(o => `${o.order_number} ${o.department_name} ${o.status} ${STATUS_LABELS[o.status] || ''}`.toLowerCase().includes(searchTerm.toLowerCase()))
        : orders;

    document.getElementById('orders-tbody').innerHTML = filtered.length > 0
        ? filtered.map(o => `
            <tr>
                <td class="font-mono">${o.order_number}</td>
                <td>${o.department_name}</td>
                <td>${o.item_count}</td>
                <td>${formatCurrency(o.total_value)}</td>
                <td>${statusBadge(o.status)} ${ageBadge(o.created_at, o.status)}</td>
                <td class="text-secondary text-sm">${formatDate(o.created_at)}</td>
                <td class="flex gap-2">
                    <button class="btn btn-secondary btn-sm" onclick="viewOrder(${o.id})">View</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteOrder(${o.id}, '${o.order_number}')">Delete</button>
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="7" class="text-secondary text-sm" style="text-align:center;padding:20px">${searchTerm ? 'No matches found' : 'No orders yet'}</td></tr>`;

    const countEl = document.getElementById('orders-count');
    if (searchTerm) {
        countEl.textContent = `${filtered.length} of ${orders.length} orders shown`;
        countEl.style.display = 'block';
    } else {
        countEl.style.display = 'none';
    }
}

async function showCreateOrder() {
    const [depts, products] = await Promise.all([api('/departments'), api('/products')]);
    window._products = products;
    window._orderOfficers = [];

    openModal('Create Bulk Order', `
        <form onsubmit="submitOrder(event)" id="order-form">
            <div class="form-group"><label>Department *</label>
                <select id="order-dept" required onchange="loadDeptOfficers(this.value)">
                    <option value="">Select department...</option>
                    ${depts.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('')}
                </select>
            </div>
            <div id="officer-selection" style="display:none">
                <div class="form-group">
                    <label>Select Personnel</label>
                    <div id="officer-list" class="officer-select-list"></div>
                </div>
            </div>
            <div id="items-config" style="display:none">
                <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px">Configure Items per Person</h3>
                <div id="items-list"></div>
            </div>
            <div class="form-group mt-4"><label>Order Notes</label><textarea id="order-notes" rows="2" placeholder="e.g., Annual uniform refresh"></textarea></div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="order-submit-btn" disabled>Create Order</button>
            </div>
        </form>
    `);
}

async function loadDeptOfficers(deptId) {
    if (!deptId) return;
    const officers = await api(`/officers?department_id=${deptId}`);
    window._deptOfficers = officers;

    document.getElementById('officer-selection').style.display = 'block';
    document.getElementById('officer-list').innerHTML = officers.map(o => `
        <label class="officer-select-item" id="osel-${o.id}">
            <input type="checkbox" value="${o.id}" onchange="toggleOfficerSelect(${o.id})">
            <div style="flex:1">
                <strong>${o.first_name} ${o.last_name}</strong>
                <span class="text-xs text-secondary" style="margin-left:8px">${o.badge_number} | ${o.rank || 'Member'}</span>
            </div>
            <div>${measurementStaleBadge(o)}</div>
        </label>
    `).join('') || '<p class="text-secondary text-sm">No personnel in this department</p>';
}

function toggleOfficerSelect(officerId) {
    const el = document.getElementById(`osel-${officerId}`);
    el.classList.toggle('selected');
    updateItemsConfig();
}

function updateItemsConfig() {
    const checked = document.querySelectorAll('#officer-list input:checked');
    const officers = window._deptOfficers || [];
    const products = window._products || [];

    if (checked.length === 0) {
        document.getElementById('items-config').style.display = 'none';
        document.getElementById('order-submit-btn').disabled = true;
        return;
    }

    document.getElementById('items-config').style.display = 'block';
    document.getElementById('order-submit-btn').disabled = false;

    const html = Array.from(checked).map(cb => {
        const o = officers.find(off => off.id === parseInt(cb.value));
        if (!o) return '';
        const staleWarn = isMeasurementStale(o)
            ? '<div style="background:var(--warning-bg);color:var(--warning);padding:6px 12px;border-radius:6px;font-size:12px;margin-bottom:8px;font-weight:500">Measurements are stale or missing. Consider re-measuring before ordering.</div>'
            : '';
        return `
            <div class="order-item-config">
                <h4>${o.first_name} ${o.last_name} <span class="text-secondary text-xs">${o.badge_number}</span></h4>
                ${staleWarn}
                <div class="form-row-3">
                    <div class="form-group"><label>Product *</label>
                        <select class="item-product" data-officer="${o.id}" onchange="updateSizeColor(this)" required>
                            <option value="">Select...</option>
                            ${products.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Size *</label>
                        <select class="item-size" data-officer="${o.id}" required>
                            <option value="">Select product first</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Color *</label>
                        <select class="item-color" data-officer="${o.id}" required>
                            <option value="">Select product first</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Qty</label><input class="item-qty" data-officer="${o.id}" type="number" min="1" value="1"></div>
                    <div class="form-group"><label>Custom Notes</label><input class="item-notes" data-officer="${o.id}" value="${o.notes || ''}" placeholder="Special instructions..."></div>
                </div>
                <div class="mt-2" style="border-top:1px dashed var(--border);padding-top:8px;margin-top:8px">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase">Embroidery / Custom Work</span>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="addEmbSpec(${o.id})" style="padding:2px 10px;font-size:11px">+ Add Job</button>
                    </div>
                    <div id="emb-specs-${o.id}" class="mt-2"></div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('items-list').innerHTML = html;
}

function updateSizeColor(select) {
    const productId = parseInt(select.value);
    const officerId = select.dataset.officer;
    const product = (window._products || []).find(p => p.id === productId);

    const sizeSelect = document.querySelector(`.item-size[data-officer="${officerId}"]`);
    const colorSelect = document.querySelector(`.item-color[data-officer="${officerId}"]`);

    if (product) {
        sizeSelect.innerHTML = product.sizes.map(s => `<option value="${s}">${s}</option>`).join('');
        colorSelect.innerHTML = product.colors.map(c => `<option value="${c}">${c}</option>`).join('');
    } else {
        sizeSelect.innerHTML = '<option value="">Select product first</option>';
        colorSelect.innerHTML = '<option value="">Select product first</option>';
    }
}

async function submitOrder(e) {
    e.preventDefault();
    const deptId = parseInt(document.getElementById('order-dept').value);
    const notes = document.getElementById('order-notes').value;

    const items = [];
    document.querySelectorAll('.order-item-config').forEach(config => {
        const officerId = parseInt(config.querySelector('.item-product').dataset.officer);
        const productId = parseInt(config.querySelector('.item-product').value);
        const size = config.querySelector('.item-size').value;
        const color = config.querySelector('.item-color').value;
        const qty = parseInt(config.querySelector('.item-qty').value) || 1;
        const customNotes = config.querySelector('.item-notes').value;

        // Collect embroidery specs for this officer
        const embSpecs = [];
        const embContainer = document.getElementById(`emb-specs-${officerId}`);
        if (embContainer) {
            embContainer.querySelectorAll('.emb-spec-row').forEach(row => {
                embSpecs.push({
                    job_type: row.querySelector('.emb-type').value,
                    placement: row.querySelector('.emb-placement').value,
                    content: row.querySelector('.emb-content').value,
                    thread_color: row.querySelector('.emb-thread').value,
                    font_style: row.querySelector('.emb-font').value,
                    special_instructions: row.querySelector('.emb-instructions').value,
                });
            });
        }

        if (productId && size && color) {
            items.push({
                officer_id: officerId,
                product_id: productId,
                size, color,
                custom_notes: customNotes,
                quantity: qty,
                embroidery_specs: embSpecs,
            });
        }
    });

    if (items.length === 0) {
        toast('Please configure at least one item', 'error');
        return;
    }

    try {
        await api('/orders', {
            method: 'POST',
            body: JSON.stringify({ department_id: deptId, notes, items }),
        });
        toast('Order created successfully');
        closeModal();
        renderOrders();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function viewOrder(id) {
    const order = await api(`/orders/${id}`);

    openModal(`Order ${order.order_number}`, `
        ${statusTimeline(order.status)}
        <div class="flex items-center justify-between mb-4">
            <div>
                ${statusBadge(order.status)}
                <span class="text-secondary text-sm" style="margin-left:8px">${order.department_name}</span>
                <span class="text-secondary text-sm" style="margin-left:8px">| ${formatDate(order.created_at)}</span>
            </div>
            <div class="flex gap-2">
                <select id="status-select" class="btn btn-secondary btn-sm" style="font-size:12px">
                    ${STATUS_LIST.map(s => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
                </select>
                <button class="btn btn-primary btn-sm" onclick="changeOrderStatus(${order.id})">Update</button>
            </div>
        </div>
        ${order.notes ? `<p class="text-sm mb-4" style="background:var(--bg);padding:10px 14px;border-radius:6px">${order.notes}</p>` : ''}
        <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Items (${order.items.length})</h3>
        <div class="table-wrap">
            <table>
                <thead><tr><th>SKU</th><th>Personnel</th><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Notes</th><th>Measurements</th></tr></thead>
                <tbody>
                    ${order.items.map(item => {
                        const m = item.officer_measurements || {};
                        const mList = Object.entries(m).filter(([,v]) => v !== null && v !== undefined);
                        return `
                        <tr>
                            <td class="font-mono text-sm" style="color:var(--primary);font-weight:600;cursor:pointer" onclick="copySku('${item.sku}')" title="Click to copy">${item.sku}</td>
                            <td>${item.officer_name}</td>
                            <td>${item.product_name}</td>
                            <td>${item.size}</td>
                            <td>${item.color}</td>
                            <td>${item.quantity}</td>
                            <td class="text-xs text-secondary">${item.custom_notes || '-'}</td>
                            <td class="text-xs">${mList.length > 0
                                ? mList.map(([k,v]) => `<span class="lookup-m-chip" style="display:inline-flex;margin:1px">${k}: ${v}"</span>`).join(' ')
                                : '<span class="text-secondary">None</span>'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div class="flex justify-between items-center mt-4" style="padding-top:12px;border-top:1px solid var(--border)">
            <span class="text-sm text-secondary">Total value: <strong>${formatCurrency(order.total_value)}</strong></span>
            <div class="flex gap-2">
                <button class="btn btn-success btn-sm" onclick="duplicateOrder(${order.id})">Reorder</button>
                <button class="btn btn-secondary btn-sm" onclick="printPackingSlip(${order.id})">Print Packing Slip</button>
                <button class="btn btn-secondary btn-sm" onclick="printBarcodeSheet(${order.id})">Print Scan Codes</button>
                <button class="btn btn-secondary btn-sm" onclick="closeModal(); navigate('lookup'); setTimeout(() => { const el = document.getElementById('lookup-input'); if(el) { el.value = '${order.order_number}'; handleLookup(); } }, 200)">Lookup SKUs</button>
            </div>
        </div>
    `);
}

async function changeOrderStatus(orderId) {
    const status = document.getElementById('status-select').value;
    try {
        await api(`/orders/${orderId}/status?status=${status}`, { method: 'PUT' });
        toast(`Status updated to ${STATUS_LABELS[status]}`);
        viewOrder(orderId);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function duplicateOrder(id) {
    if (!confirm('Create a new order with the same items? This is useful for annual reorders.')) return;
    try {
        const newOrder = await api(`/orders/${id}/duplicate`, { method: 'POST' });
        toast('Reorder created successfully');
        closeModal();
        renderOrders();
        setTimeout(() => viewOrder(newOrder.id), 300);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteOrder(id, orderNum) {
    if (!confirm(`Delete order "${orderNum}"? This will remove all items and generated SKUs.`)) return;
    try {
        await api(`/orders/${id}`, { method: 'DELETE' });
        toast('Order deleted');
        renderOrders();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// === Packing Slip ===
async function printPackingSlip(orderId) {
    const order = await api(`/orders/${orderId}`);
    closeModal();

    main().innerHTML = `
        <div class="packing-slip" style="max-width:800px;margin:0 auto;padding:32px">
            <div class="no-print" style="margin-bottom:20px">
                <button class="btn btn-primary" onclick="window.print()">Print Packing Slip</button>
                <button class="btn btn-secondary" style="margin-left:8px" onclick="renderOrders()">Back to Orders</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
                <div>
                    <h1 style="font-size:22px;font-weight:700;margin-bottom:4px">Packing Slip</h1>
                    <p style="font-size:14px;color:var(--text-secondary)">Order ${order.order_number}</p>
                </div>
                <div style="text-align:right">
                    <p style="font-size:13px;font-weight:600">${order.department_name}</p>
                    <p style="font-size:12px;color:var(--text-secondary)">${formatDate(order.created_at)}</p>
                    <p style="margin-top:4px">${statusBadge(order.status)}</p>
                </div>
            </div>
            ${order.notes ? `<div style="background:var(--bg);padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:13px"><strong>Notes:</strong> ${order.notes}</div>` : ''}
            <table style="margin-bottom:24px">
                <thead><tr>
                    <th style="width:30px">#</th>
                    <th>Personnel</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th>Qty</th>
                    <th>Custom Notes</th>
                </tr></thead>
                <tbody>
                    ${order.items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><strong>${item.officer_name}</strong></td>
                            <td>${item.product_name}</td>
                            <td class="font-mono text-sm">${item.sku}</td>
                            <td>${item.size}</td>
                            <td>${item.color}</td>
                            <td>${item.quantity}</td>
                            <td class="text-sm" style="max-width:180px">${item.custom_notes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display:flex;justify-content:space-between;border-top:2px solid var(--border);padding-top:16px">
                <div>
                    <p style="font-size:13px;color:var(--text-secondary)">Total Items: <strong>${order.items.reduce((s, i) => s + i.quantity, 0)}</strong></p>
                    <p style="font-size:13px;color:var(--text-secondary)">Total Value: <strong>${formatCurrency(order.total_value)}</strong></p>
                </div>
                <div style="text-align:right">
                    <p style="font-size:12px;color:var(--text-light)">Packed by: ___________________</p>
                    <p style="font-size:12px;color:var(--text-light);margin-top:8px">Date: ___________________</p>
                </div>
            </div>
        </div>
    `;
}

// === Barcode Sheet ===
async function printBarcodeSheet(orderId) {
    const order = await api(`/orders/${orderId}`);
    closeModal();

    main().innerHTML = `
        <div class="barcode-sheet" style="max-width:800px;margin:0 auto;padding:32px">
            <div class="no-print" style="margin-bottom:20px">
                <button class="btn btn-primary" onclick="window.print()">Print Scan Codes</button>
                <button class="btn btn-secondary" style="margin-left:8px" onclick="renderOrders()">Back to Orders</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
                <div>
                    <h1 style="font-size:22px;font-weight:700;margin-bottom:4px">Scan Code Sheet</h1>
                    <p style="font-size:14px;color:var(--text-secondary)">Order ${order.order_number} &mdash; ${order.department_name}</p>
                </div>
                <div style="text-align:right">
                    <p style="font-size:12px;color:var(--text-secondary)">${formatDate(order.created_at)}</p>
                    <p style="margin-top:4px">${statusBadge(order.status)}</p>
                </div>
            </div>
            <div class="barcode-grid">
                ${order.items.map(item => `
                    <div class="barcode-label">
                        <div class="barcode-label-info">
                            <span class="barcode-label-name">${item.officer_name}</span>
                            <span class="barcode-label-detail">${item.product_name} &middot; ${item.size} &middot; ${item.color}</span>
                        </div>
                        <div class="barcode-label-codes">
                            <svg class="sku-barcode" data-sku="${item.sku}"></svg>
                            <canvas class="sku-qr" data-sku="${item.sku}"></canvas>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    setTimeout(() => { renderAllBarcodes(); renderAllQRCodes(); }, 100);
}

// ============================================================
//  SKU LOOKUP
// ============================================================
let lookupTimer = null;

async function renderLookup() {
    main().innerHTML = `
        <div class="page-header">
            <h1>SKU Lookup</h1>
        </div>
        <div class="card mb-4">
            <div class="card-body" style="padding:12px 20px;background:#f0f9ff;border-radius:var(--radius)">
                <p class="text-sm" style="color:#1e40af">
                    <strong>Quick Find:</strong> Type a SKU, order number, badge number, or officer name to instantly pull up item details, measurements, and order status.
                </p>
            </div>
        </div>
        <div class="lookup-search-wrap">
            <svg class="lookup-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="lookup-input" class="lookup-search" placeholder="Search by SKU, order number, name, or badge..." oninput="handleLookup()" autofocus>
        </div>
        <div id="lookup-results">
            <div class="empty-state" style="padding:60px 20px">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p style="margin-top:12px;font-size:15px">Start typing to search across all orders</p>
                <p class="text-xs" style="margin-top:4px">Try a SKU like <span class="font-mono" style="color:var(--primary)">SPD-DSU</span> or a name</p>
            </div>
        </div>
    `;
}

function handleLookup() {
    clearTimeout(lookupTimer);
    const q = document.getElementById('lookup-input')?.value?.trim() || '';
    if (!q) {
        document.getElementById('lookup-results').innerHTML = `
            <div class="empty-state" style="padding:60px 20px">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p style="margin-top:12px;font-size:15px">Start typing to search across all orders</p>
                <p class="text-xs" style="margin-top:4px">Try a SKU like <span class="font-mono" style="color:var(--primary)">SPD-DSU</span> or a name</p>
            </div>`;
        return;
    }
    lookupTimer = setTimeout(() => runLookup(q), 250);
}

async function runLookup(query) {
    const resultsDiv = document.getElementById('lookup-results');
    if (!resultsDiv) return;

    try {
        const results = await api(`/lookup?q=${encodeURIComponent(query)}`);
        if (!results.length) {
            resultsDiv.innerHTML = `
                <div class="empty-state" style="padding:60px 20px">
                    <p style="font-size:15px">No results for "<strong>${query}</strong>"</p>
                    <p class="text-xs" style="margin-top:4px">Try a different SKU, order number, or name</p>
                </div>`;
            return;
        }

        // Separate items from officer-only profiles
        const itemResults = results.filter(r => r.result_type === 'item');
        const officerResults = results.filter(r => r.result_type === 'officer');

        // Group items by order
        const byOrder = {};
        itemResults.forEach(r => {
            if (!byOrder[r.order_number]) {
                byOrder[r.order_number] = {
                    order_number: r.order_number,
                    order_id: r.order_id,
                    order_status: r.order_status,
                    department_name: r.department_name,
                    items: [],
                };
            }
            byOrder[r.order_number].items.push(r);
        });

        const orderCount = Object.keys(byOrder).length;
        const summaryParts = [];
        if (itemResults.length) summaryParts.push(`${itemResults.length} item${itemResults.length !== 1 ? 's' : ''} across ${orderCount} order${orderCount !== 1 ? 's' : ''}`);
        if (officerResults.length) summaryParts.push(`${officerResults.length} personnel profile${officerResults.length !== 1 ? 's' : ''}`);

        resultsDiv.innerHTML = `
            <p class="text-sm text-secondary" style="margin-bottom:16px">${summaryParts.join(' + ')}</p>
            ${Object.values(byOrder).map(group => `
                <div class="lookup-order-group">
                    <div class="lookup-order-header">
                        <div>
                            <span class="font-mono" style="font-weight:700;font-size:15px">${group.order_number}</span>
                            <span class="text-secondary text-sm" style="margin-left:8px">${group.department_name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${statusBadge(group.order_status)}
                            <button class="btn btn-secondary btn-sm" onclick="viewOrder(${group.order_id})">View Order</button>
                        </div>
                    </div>
                    <div class="lookup-items">
                        ${group.items.map(item => lookupCard(item)).join('')}
                    </div>
                </div>
            `).join('')}
            ${officerResults.length ? `
                <div class="lookup-order-group">
                    <div class="lookup-order-header">
                        <div>
                            <span style="font-weight:700;font-size:15px">Personnel Profiles</span>
                            <span class="text-secondary text-sm" style="margin-left:8px">No active orders</span>
                        </div>
                    </div>
                    <div class="lookup-items">
                        ${officerResults.map(o => officerProfileCard(o)).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="empty-state"><p>Search error: ${e.message}</p></div>`;
    }
}

function lookupCard(item) {
    const measurements = item.measurements || {};
    const hasMeasurements = Object.values(measurements).some(v => v !== null);
    const bcId = 'bc-' + item.sku.replace(/[^a-zA-Z0-9]/g, '_');
    return `
        <div class="lookup-card">
            <div class="lookup-card-top">
                <div class="flex items-center gap-2">
                    <div class="lookup-sku font-mono" style="cursor:pointer" onclick="copySku('${item.sku}')" title="Click to copy">${item.sku}</div>
                    <button class="btn-icon" onclick="toggleCodes('${bcId}', '${item.sku}')" title="Show barcode & QR">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="2" height="16"/><rect x="6" y="4" width="1" height="16"/><rect x="9" y="4" width="2" height="16"/><rect x="13" y="4" width="3" height="16"/><rect x="18" y="4" width="1" height="16"/><rect x="21" y="4" width="1" height="16"/></svg>
                    </button>
                </div>
                <div class="lookup-price">$${item.unit_price.toFixed(2)} x ${item.quantity}</div>
            </div>
            <div id="${bcId}" class="codes-wrap" style="display:none"><svg class="sku-barcode"></svg><canvas class="sku-qr" data-sku="${item.sku}"></canvas></div>
            <div class="lookup-card-body">
                <div class="lookup-detail-col">
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Product</span>
                        <span>${item.product_name}</span>
                    </div>
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Size / Color</span>
                        <span>${item.size} / ${item.color}</span>
                    </div>
                    ${item.custom_notes ? `
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Notes</span>
                        <span style="color:var(--warning);font-style:italic">${item.custom_notes}</span>
                    </div>` : ''}
                </div>
                <div class="lookup-detail-col">
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Officer</span>
                        <span><strong>${item.officer_name}</strong></span>
                    </div>
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Badge #</span>
                        <span class="font-mono">${item.badge_number}</span>
                    </div>
                    ${item.rank ? `
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Rank</span>
                        <span>${item.rank}</span>
                    </div>` : ''}
                </div>
            </div>
            ${hasMeasurements ? `
            <div class="lookup-measurements">
                ${Object.entries(measurements).filter(([,v]) => v !== null).map(([k, v]) => `
                    <div class="lookup-m-chip">
                        <span class="lookup-m-label">${k}</span>
                        <span class="lookup-m-value">${v}"</span>
                    </div>
                `).join('')}
            </div>` : ''}
        </div>
    `;
}

function officerProfileCard(item) {
    const measurements = item.measurements || {};
    const hasMeasurements = Object.values(measurements).some(v => v !== null);
    const measCount = Object.values(measurements).filter(v => v !== null).length;
    const measBadge = measCount >= 5
        ? `<span class="measure-badge measure-complete">${measCount}/7 measurements</span>`
        : measCount > 0
            ? `<span class="measure-badge measure-partial">${measCount}/7 measurements</span>`
            : `<span class="measure-badge measure-none">No measurements</span>`;
    return `
        <div class="lookup-card">
            <div class="lookup-card-top">
                <div class="flex items-center gap-2">
                    <span style="background:var(--bg);padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;color:var(--text-secondary)">No active orders</span>
                    ${measBadge}
                </div>
                <button class="btn btn-primary btn-sm" onclick="navigate('orders'); setTimeout(() => showCreateOrder(), 200)">Create Order</button>
            </div>
            <div class="lookup-card-body">
                <div class="lookup-detail-col">
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Name</span>
                        <span><strong>${item.officer_name}</strong></span>
                    </div>
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Badge #</span>
                        <span class="font-mono">${item.badge_number}</span>
                    </div>
                    ${item.rank ? `<div class="lookup-detail-row">
                        <span class="lookup-label">Rank</span>
                        <span>${item.rank}</span>
                    </div>` : ''}
                </div>
                <div class="lookup-detail-col">
                    <div class="lookup-detail-row">
                        <span class="lookup-label">Department</span>
                        <span>${item.department_name}</span>
                    </div>
                </div>
            </div>
            ${hasMeasurements ? `
            <div class="lookup-measurements">
                ${Object.entries(measurements).filter(([,v]) => v !== null).map(([k, v]) => `
                    <div class="lookup-m-chip">
                        <span class="lookup-m-label">${k}</span>
                        <span class="lookup-m-value">${v}"</span>
                    </div>
                `).join('')}
            </div>` : ''}
        </div>
    `;
}

// ============================================================
//  INVENTORY
// ============================================================
async function renderInventory() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    try {
        const items = await api('/inventory');
        window._allInventory = items;

        const lowCount = items.filter(i => i.stock_status === 'low' || i.stock_status === 'out_of_stock').length;

        main().innerHTML = `
            <div class="page-header">
                <h1>Inventory</h1>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="generateReorderReport()">Generate Reorder Report</button>
                </div>
            </div>
            ${lowCount > 0 ? `
                <div class="card mb-4" style="border-left:4px solid var(--danger)">
                    <div class="card-body" style="padding:12px 20px;background:#fef2f2">
                        <p class="text-sm" style="color:var(--danger);font-weight:600">${lowCount} product${lowCount !== 1 ? 's' : ''} below reorder threshold</p>
                    </div>
                </div>
            ` : ''}
            <div class="card">
                <div class="card-body table-wrap">
                    <table>
                        <thead><tr>
                            <th>Code</th><th>Product</th><th>Category</th>
                            <th>In Stock</th><th>Threshold</th><th>Status</th><th>Suggested Reorder</th>
                        </tr></thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td class="font-mono">${item.code}</td>
                                    <td><strong>${item.name}</strong></td>
                                    <td>${item.category}</td>
                                    <td>
                                        <div class="stock-bar-wrap">
                                            <div class="stock-bar">
                                                <div class="stock-bar-fill stock-bar-${item.stock_status}"
                                                     style="width:${Math.min(100, (item.stock_quantity / Math.max(item.reorder_threshold * 3, 1)) * 100)}%"></div>
                                            </div>
                                            <span class="text-sm" style="font-weight:600">${item.stock_quantity}</span>
                                        </div>
                                    </td>
                                    <td class="text-secondary">${item.reorder_threshold}</td>
                                    <td>${item.stock_status === 'out_of_stock' ? '<span class="stock-badge stock-out">Out of Stock</span>'
                                        : item.stock_status === 'low' ? '<span class="stock-badge stock-low">Low Stock</span>'
                                        : item.stock_status === 'warning' ? '<span class="stock-badge stock-warn">Approaching</span>'
                                        : '<span class="stock-badge stock-good">Good</span>'}</td>
                                    <td>${item.suggested_reorder > 0
                                        ? '<span style="font-weight:600;color:var(--danger)">+' + item.suggested_reorder + ' units</span>'
                                        : '<span class="text-secondary">-</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        main().innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
    }
}

function generateReorderReport() {
    const items = (window._allInventory || []).filter(i => i.suggested_reorder > 0);
    if (items.length === 0) {
        toast('No items need reordering', 'info');
        return;
    }
    const totalCost = items.reduce((s, i) => s + (i.suggested_reorder * i.base_price), 0);
    openModal('Reorder Suggestion Report', `
        <div style="margin-bottom:16px">
            <p class="text-sm text-secondary">Auto-generated purchase order suggestion based on current inventory levels and reorder thresholds.</p>
            <p class="text-xs text-secondary mt-2">Generated: ${new Date().toLocaleString()}</p>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Code</th><th>Product</th><th>Current</th><th>Threshold</th><th>Order Qty</th><th>Est. Cost</th></tr></thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td class="font-mono">${item.code}</td>
                            <td><strong>${item.name}</strong></td>
                            <td>${item.stock_quantity}</td>
                            <td>${item.reorder_threshold}</td>
                            <td style="font-weight:600;color:var(--primary)">${item.suggested_reorder}</td>
                            <td>${formatCurrency(item.suggested_reorder * item.base_price)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="border-top:2px solid var(--border);margin-top:16px;padding-top:12px;text-align:right">
            <p class="text-sm"><strong>Total Est. Cost: ${formatCurrency(totalCost)}</strong></p>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn btn-primary" onclick="exportReorderCSV()">Export CSV</button>
        </div>
    `);
}

function exportReorderCSV() {
    const items = (window._allInventory || []).filter(i => i.suggested_reorder > 0);
    downloadCSV('reorder_report.csv',
        ['Code', 'Product', 'Current Stock', 'Threshold', 'Suggested Qty', 'Est Cost'],
        items.map(i => [i.code, i.name, i.stock_quantity, i.reorder_threshold, i.suggested_reorder, (i.suggested_reorder * i.base_price).toFixed(2)])
    );
    closeModal();
}

// ============================================================
//  NOTIFICATIONS
// ============================================================
async function renderNotifications() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    try {
        const notifications = await api('/notifications');
        window._allNotifications = notifications;

        main().innerHTML = `
            <div class="page-header">
                <h1>Notifications</h1>
                <p class="text-secondary text-sm">Automated notification log -- alerts triggered by order status changes</p>
            </div>
            <div class="card mb-4" style="border-left:4px solid var(--info)">
                <div class="card-body" style="padding:12px 20px;background:#f0f9ff">
                    <p class="text-sm" style="color:#1e40af">
                        <strong>How it works:</strong> When an order status changes to Confirmed, Shipped, or Delivered, the system automatically sends a notification to the department contact. This demonstrates webhook-style automation.
                    </p>
                </div>
            </div>
            <div class="card">
                <div class="card-body table-wrap">
                    <table>
                        <thead><tr>
                            <th>Time</th><th>Type</th><th>Recipient</th><th>Subject</th><th>Status</th><th></th>
                        </tr></thead>
                        <tbody>
                            ${notifications.length > 0 ? notifications.map(n => `
                                <tr>
                                    <td class="text-sm text-secondary">${formatDate(n.created_at)}</td>
                                    <td>${n.type === 'email'
                                        ? '<span class="notif-type-badge notif-email">Email</span>'
                                        : '<span class="notif-type-badge notif-sms">SMS</span>'}</td>
                                    <td class="text-sm">${n.recipient}</td>
                                    <td>
                                        <strong class="text-sm">${n.subject}</strong>
                                        <br><span class="text-xs text-secondary">${n.body}</span>
                                        ${n.order_number ? '<br><span class="text-xs font-mono" style="color:var(--primary)">' + n.order_number + '</span>' : ''}
                                    </td>
                                    <td>${n.status === 'sent'
                                        ? '<span class="badge badge-delivered">Sent</span>'
                                        : n.status === 'failed'
                                            ? '<span class="badge badge-pending">Failed</span>'
                                            : '<span class="badge badge-confirmed">Queued</span>'}</td>
                                    <td>
                                        ${n.status === 'failed'
                                            ? '<button class="btn btn-primary btn-sm" onclick="resendNotification(' + n.id + ')">Resend</button>'
                                            : ''}
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" class="text-secondary text-sm" style="text-align:center;padding:20px">No notifications yet. Change an order status to Confirmed, Shipped, or Delivered to trigger one.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        main().innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
    }
}

async function resendNotification(id) {
    try {
        await api('/notifications/' + id + '/resend', { method: 'POST' });
        toast('Notification resent (mock)', 'success');
        renderNotifications();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================
//  EMBROIDERY & CUSTOM WORK
// ============================================================
const EMB_JOB_TYPES = ['embroidery', 'screen_print', 'patch', 'name_tape'];
const EMB_JOB_LABELS = { embroidery: 'Embroidery', screen_print: 'Screen Print', patch: 'Patch', name_tape: 'Name Tape' };
const EMB_PLACEMENTS = ['left_chest', 'right_chest', 'back', 'left_sleeve', 'right_sleeve', 'collar'];
const EMB_PLACEMENT_LABELS = { left_chest: 'Left Chest', right_chest: 'Right Chest', back: 'Back', left_sleeve: 'Left Sleeve', right_sleeve: 'Right Sleeve', collar: 'Collar' };
const EMB_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'];
const EMB_STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', rejected: 'Rejected' };
const EMB_STATUS_COLORS = {
    pending: { bg: '#fef3c7', color: '#92400e' },
    in_progress: { bg: '#dbeafe', color: '#1e40af' },
    completed: { bg: '#dcfce7', color: '#166534' },
    rejected: { bg: '#fee2e2', color: '#991b1b' },
};
const EMB_FONT_STYLES = ['block', 'script', 'serif', 'sans_serif'];
const EMB_THREAD_COLORS = ['Gold', 'Silver', 'White', 'Black', 'Navy', 'Red', 'Royal Blue'];

function embStatusBadge(status) {
    const c = EMB_STATUS_COLORS[status] || EMB_STATUS_COLORS.pending;
    return `<span style="background:${c.bg};color:${c.color};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">${EMB_STATUS_LABELS[status] || status}</span>`;
}

function embTypeBadge(type) {
    const colors = {
        embroidery: { bg: '#f3e8ff', color: '#7c3aed' },
        screen_print: { bg: '#fef3c7', color: '#92400e' },
        patch: { bg: '#dbeafe', color: '#1e40af' },
        name_tape: { bg: '#f0fdf4', color: '#166534' },
    };
    const c = colors[type] || { bg: '#f1f5f9', color: '#475569' };
    return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${EMB_JOB_LABELS[type] || type}</span>`;
}

function addEmbSpec(officerId) {
    const container = document.getElementById(`emb-specs-${officerId}`);
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'emb-spec-row';
    div.style.cssText = 'margin-top:8px;padding:10px;background:#f8fafc;border:1px solid var(--border);border-radius:6px';
    div.innerHTML = `
        <div class="flex items-center justify-between" style="margin-bottom:8px">
            <span class="text-xs" style="font-weight:600">Custom Job #${idx + 1}</span>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()" style="padding:2px 8px;font-size:11px">Remove</button>
        </div>
        <div class="form-row-3">
            <div class="form-group"><label>Job Type</label>
                <select class="emb-type">${EMB_JOB_TYPES.map(t => `<option value="${t}">${EMB_JOB_LABELS[t]}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Placement</label>
                <select class="emb-placement">${EMB_PLACEMENTS.map(p => `<option value="${p}">${EMB_PLACEMENT_LABELS[p]}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Content</label>
                <input class="emb-content" placeholder="Text or design name...">
            </div>
        </div>
        <div class="form-row-3">
            <div class="form-group"><label>Thread Color</label>
                <select class="emb-thread"><option value="">N/A</option>${EMB_THREAD_COLORS.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Font Style</label>
                <select class="emb-font"><option value="">N/A</option>${EMB_FONT_STYLES.map(f => `<option value="${f}">${f}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Special Instructions</label>
                <input class="emb-instructions" placeholder="Placement details...">
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function renderEmbroidery() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    try {
        const [jobs, stats] = await Promise.all([api('/embroidery'), api('/embroidery/stats')]);
        window._allEmbroideryJobs = jobs;

        main().innerHTML = `
            <div class="page-header">
                <h1>Embroidery & Custom Work</h1>
                <p class="text-secondary text-sm">Production queue for embroidery, screen printing, patches, and name tapes</p>
            </div>
            <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                <div class="stat-card ${stats.pending > 0 ? 'stat-card-warning' : ''}">
                    <div class="label">Pending</div>
                    <div class="value">${stats.pending}</div>
                    <div class="sub">Awaiting assignment</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--primary)">
                    <div class="label">In Progress</div>
                    <div class="value">${stats.in_progress}</div>
                    <div class="sub">Currently being worked</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--success)">
                    <div class="label">Completed</div>
                    <div class="value">${stats.completed}</div>
                    <div class="sub">Finished jobs</div>
                </div>
                <div class="stat-card ${stats.rejected > 0 ? 'stat-card-danger' : ''}">
                    <div class="label">Rejected</div>
                    <div class="value">${stats.rejected}</div>
                    <div class="sub">Needs redo</div>
                </div>
            </div>
            <div class="card">
                <div class="card-body" style="padding:12px 20px;border-bottom:1px solid var(--border)">
                    <div class="flex items-center gap-2" style="flex-wrap:wrap">
                        <button class="btn btn-sm ${!window._embFilter ? 'btn-primary' : 'btn-secondary'}" onclick="filterEmbroidery(null)">All (${stats.total})</button>
                        ${EMB_STATUSES.map(s => `<button class="btn btn-sm ${window._embFilter === s ? 'btn-primary' : 'btn-secondary'}" onclick="filterEmbroidery('${s}')">${EMB_STATUS_LABELS[s]} (${stats[s]})</button>`).join('')}
                        <div style="flex:1"></div>
                        <input type="text" id="emb-search" placeholder="Search by name, order, or content..." style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;width:250px" oninput="filterEmbroideryTable(this.value)">
                    </div>
                </div>
                <div class="card-body table-wrap" style="padding-top:0">
                    <table>
                        <thead><tr>
                            <th>Type</th><th>Content</th><th>Placement</th><th>Officer</th>
                            <th>Order</th><th>Status</th><th>Assigned To</th><th></th>
                        </tr></thead>
                        <tbody id="embroidery-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;
        filterEmbroideryTable('');
    } catch (e) {
        main().innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
}

function filterEmbroidery(status) {
    window._embFilter = status;
    renderEmbroidery();
}

function filterEmbroideryTable(searchTerm) {
    let jobs = window._allEmbroideryJobs || [];
    if (window._embFilter) jobs = jobs.filter(j => j.status === window._embFilter);
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        jobs = jobs.filter(j => `${j.content} ${j.officer_name} ${j.order_number} ${j.assigned_to} ${j.product_name}`.toLowerCase().includes(term));
    }
    document.getElementById('embroidery-tbody').innerHTML = jobs.length > 0
        ? jobs.map(j => `
            <tr>
                <td>${embTypeBadge(j.job_type)}</td>
                <td>
                    <strong class="text-sm">${j.content || '(no text)'}</strong>
                    ${j.thread_color ? `<br><span class="text-xs text-secondary">Thread: ${j.thread_color}</span>` : ''}
                    ${j.font_style ? ` <span class="text-xs text-secondary">| ${j.font_style}</span>` : ''}
                </td>
                <td><span class="text-sm">${EMB_PLACEMENT_LABELS[j.placement] || j.placement}</span></td>
                <td>
                    <strong class="text-sm">${j.officer_name}</strong>
                    <br><span class="text-xs text-secondary font-mono">${j.sku}</span>
                </td>
                <td><span class="text-xs font-mono">${j.order_number}</span></td>
                <td>${embStatusBadge(j.status)}</td>
                <td>${j.assigned_to ? `<span class="text-sm">${j.assigned_to}</span>` : '<span class="text-xs text-secondary">Unassigned</span>'}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm" onclick="showEmbroideryDetail(${j.id})">Detail</button>
                        ${j.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="quickAssignEmb(${j.id})">Assign</button>` : ''}
                        ${j.status === 'in_progress' ? `<button class="btn btn-success btn-sm" onclick="quickCompleteEmb(${j.id})">Done</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="8" class="text-secondary text-sm" style="text-align:center;padding:20px">No embroidery jobs found</td></tr>';
}

function showEmbroideryDetail(jobId) {
    const job = (window._allEmbroideryJobs || []).find(j => j.id === jobId);
    if (!job) return;
    openModal('Embroidery Job Detail', `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">${embTypeBadge(job.job_type)} ${embStatusBadge(job.status)}</div>
            <span class="text-xs font-mono text-secondary">${job.sku}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Content</p><p class="text-sm"><strong>${job.content || '(none)'}</strong></p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Placement</p><p class="text-sm">${EMB_PLACEMENT_LABELS[job.placement] || job.placement}</p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Thread Color</p><p class="text-sm">${job.thread_color || '-'}</p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Font Style</p><p class="text-sm">${job.font_style || '-'}</p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Officer</p><p class="text-sm"><strong>${job.officer_name}</strong></p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Order</p><p class="text-sm font-mono">${job.order_number}</p></div>
        </div>
        ${job.special_instructions ? `<div style="background:var(--bg);padding:10px 14px;border-radius:6px;margin-bottom:16px"><p class="text-xs text-secondary" style="font-weight:600;margin-bottom:2px">SPECIAL INSTRUCTIONS</p><p class="text-sm">${job.special_instructions}</p></div>` : ''}
        <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Update Job</h3>
        <div class="form-row-3">
            <div class="form-group"><label>Status</label>
                <select id="emb-status">${EMB_STATUSES.map(s => `<option value="${s}" ${s === job.status ? 'selected' : ''}>${EMB_STATUS_LABELS[s]}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Assigned To</label>
                <input id="emb-assigned" value="${job.assigned_to}" placeholder="Tailor name...">
            </div>
            <div class="form-group" style="display:flex;align-items:flex-end">
                <button class="btn btn-primary" onclick="updateEmbroideryJob(${job.id})" style="width:100%">Save Changes</button>
            </div>
        </div>
    `);
}

async function updateEmbroideryJob(jobId) {
    try {
        await api(`/embroidery/${jobId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: document.getElementById('emb-status').value,
                assigned_to: document.getElementById('emb-assigned').value,
            }),
        });
        toast('Embroidery job updated');
        closeModal();
        renderEmbroidery();
    } catch (e) { toast(e.message, 'error'); }
}

async function quickAssignEmb(jobId) {
    const name = prompt('Assign to (tailor name):');
    if (!name) return;
    try {
        await api(`/embroidery/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'in_progress', assigned_to: name }) });
        toast(`Assigned to ${name} and started`);
        renderEmbroidery();
    } catch (e) { toast(e.message, 'error'); }
}

async function quickCompleteEmb(jobId) {
    try {
        await api(`/embroidery/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) });
        toast('Job marked as completed');
        renderEmbroidery();
    } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  APPOINTMENTS
// ============================================================
const APPT_TYPES = ['fitting', 'alteration', 'pickup', 'consultation'];
const APPT_TYPE_LABELS = { fitting: 'Fitting', alteration: 'Alteration', pickup: 'Pickup', consultation: 'Consultation' };
const APPT_TYPE_COLORS = {
    fitting: { bg: '#dbeafe', color: '#1e40af' },
    alteration: { bg: '#f3e8ff', color: '#7c3aed' },
    pickup: { bg: '#dcfce7', color: '#166534' },
    consultation: { bg: '#fef3c7', color: '#92400e' },
};
const APPT_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
const APPT_STATUS_LABELS = { scheduled: 'Scheduled', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show' };
const APPT_STATUS_COLORS = {
    scheduled: { bg: '#dbeafe', color: '#1e40af' },
    confirmed: { bg: '#dcfce7', color: '#166534' },
    completed: { bg: '#f1f5f9', color: '#475569' },
    cancelled: { bg: '#fee2e2', color: '#991b1b' },
    no_show: { bg: '#fef3c7', color: '#92400e' },
};

function apptTypeBadge(type) {
    const c = APPT_TYPE_COLORS[type] || { bg: '#f1f5f9', color: '#475569' };
    return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${APPT_TYPE_LABELS[type] || type}</span>`;
}

function apptStatusBadge(status) {
    const c = APPT_STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' };
    return `<span style="background:${c.bg};color:${c.color};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">${APPT_STATUS_LABELS[status] || status}</span>`;
}

async function renderAppointments() {
    main().innerHTML = '<div class="empty-state">Loading...</div>';
    const viewDate = window._apptDate || new Date().toISOString().split('T')[0];
    const viewMode = window._apptMode || 'day';
    window._apptDate = viewDate;
    window._apptMode = viewMode;

    try {
        let dateFrom, dateTo;
        if (viewMode === 'day') {
            dateFrom = viewDate;
            dateTo = viewDate;
        } else {
            const d = new Date(viewDate + 'T00:00:00');
            const day = d.getDay();
            const monday = new Date(d);
            monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            dateFrom = monday.toISOString().split('T')[0];
            dateTo = sunday.toISOString().split('T')[0];
        }

        const appts = await api(`/appointments?date_from=${dateFrom}&date_to=${dateTo}`);
        window._allAppointments = appts;

        const dateLabel = viewMode === 'day'
            ? new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
            : `Week of ${new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(dateTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        const todayStr = new Date().toISOString().split('T')[0];
        const todayCount = appts.filter(a => a.date === todayStr && a.status !== 'cancelled').length;

        main().innerHTML = `
            <div class="page-header">
                <h1>Appointments</h1>
                <div class="flex gap-2">
                    <button class="btn btn-primary" onclick="showAppointmentForm()">+ Book Appointment</button>
                </div>
            </div>
            <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                <div class="stat-card">
                    <div class="label">Today</div>
                    <div class="value">${todayCount}</div>
                    <div class="sub">Appointments scheduled</div>
                </div>
                <div class="stat-card">
                    <div class="label">This View</div>
                    <div class="value">${appts.filter(a => a.status !== 'cancelled').length}</div>
                    <div class="sub">${viewMode === 'day' ? 'Today' : 'This week'}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Fittings</div>
                    <div class="value">${appts.filter(a => a.appointment_type === 'fitting' && a.status !== 'cancelled').length}</div>
                    <div class="sub">Most common type</div>
                </div>
                <div class="stat-card">
                    <div class="label">Walk-ins</div>
                    <div class="value">${appts.filter(a => !a.officer_id).length}</div>
                    <div class="sub">No linked officer</div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <div class="flex items-center gap-2">
                        <button class="btn btn-sm btn-secondary" onclick="navigateApptDate(-1)">&#9664;</button>
                        <h2 style="min-width:280px;text-align:center">${dateLabel}</h2>
                        <button class="btn btn-sm btn-secondary" onclick="navigateApptDate(1)">&#9654;</button>
                        <button class="btn btn-sm btn-secondary" onclick="goToApptToday()">Today</button>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}" onclick="setApptMode('day')">Day</button>
                        <button class="btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}" onclick="setApptMode('week')">Week</button>
                    </div>
                </div>
                <div class="card-body" id="appt-schedule">
                    ${viewMode === 'day' ? renderDayView(appts, viewDate) : renderWeekView(appts, dateFrom)}
                </div>
            </div>
        `;
    } catch (e) {
        main().innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
}

function renderDayView(appts, date) {
    const hours = [];
    for (let h = 8; h <= 17; h++) hours.push(h);
    const dayAppts = appts.filter(a => a.date === date && a.status !== 'cancelled');

    if (dayAppts.length === 0) {
        return `<div class="empty-state" style="padding:40px"><p>No appointments scheduled for this day</p>
            <button class="btn btn-primary btn-sm mt-2" onclick="showAppointmentForm()">Book an Appointment</button></div>`;
    }

    return `<div class="appt-timeline">${hours.map(h => {
        const hourAppts = dayAppts.filter(a => parseInt(a.time_start.split(':')[0]) === h);
        return `<div class="appt-hour-row">
            <div class="appt-hour-label">${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}</div>
            <div class="appt-hour-slots">
                ${hourAppts.length > 0 ? hourAppts.map(a => `
                    <div class="appt-block appt-block-${a.appointment_type}" onclick="showAppointmentDetail(${a.id})" style="cursor:pointer">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">${apptTypeBadge(a.appointment_type)} ${apptStatusBadge(a.status)}</div>
                            <span class="text-xs text-secondary">${a.time_start} - ${a.time_end}</span>
                        </div>
                        <div style="margin-top:6px">
                            <strong class="text-sm">${a.customer_name || a.officer_name || 'Walk-in'}</strong>
                            ${a.department_name ? `<span class="text-xs text-secondary" style="margin-left:6px">${a.department_name}</span>` : ''}
                        </div>
                        ${a.notes ? `<p class="text-xs text-secondary" style="margin-top:4px">${a.notes}</p>` : ''}
                    </div>
                `).join('') : '<div class="appt-empty-slot"></div>'}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function renderWeekView(appts, mondayStr) {
    const days = [];
    const monday = new Date(mondayStr + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d.toISOString().split('T')[0]);
    }
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date().toISOString().split('T')[0];

    return `<div class="appt-week-grid">${days.map((dateStr, i) => {
        const dayAppts = appts.filter(a => a.date === dateStr && a.status !== 'cancelled');
        const isToday = dateStr === today;
        const dateObj = new Date(dateStr + 'T00:00:00');
        return `<div class="appt-week-day ${isToday ? 'appt-week-today' : ''}">
            <div class="appt-week-day-header">
                <span class="text-xs" style="font-weight:600">${dayNames[i]}</span>
                <span class="text-sm" style="font-weight:700">${dateObj.getDate()}</span>
            </div>
            <div class="appt-week-day-body">
                ${dayAppts.length > 0 ? dayAppts.map(a => `
                    <div class="appt-week-item appt-block-${a.appointment_type}" onclick="showAppointmentDetail(${a.id})">
                        <div class="text-xs" style="font-weight:600">${a.time_start}</div>
                        <div class="text-xs">${a.customer_name || 'Walk-in'}</div>
                        ${apptTypeBadge(a.appointment_type)}
                    </div>
                `).join('') : '<div class="text-xs text-secondary" style="padding:8px;text-align:center">No appts</div>'}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function navigateApptDate(direction) {
    const d = new Date(window._apptDate + 'T00:00:00');
    d.setDate(d.getDate() + (window._apptMode === 'day' ? direction : direction * 7));
    window._apptDate = d.toISOString().split('T')[0];
    renderAppointments();
}

function goToApptToday() {
    window._apptDate = new Date().toISOString().split('T')[0];
    renderAppointments();
}

function setApptMode(mode) {
    window._apptMode = mode;
    renderAppointments();
}

async function showAppointmentForm(existingId) {
    const [depts, officers] = await Promise.all([api('/departments'), api('/officers')]);
    let appt = {
        officer_id: '', department_id: '', appointment_type: 'fitting',
        date: new Date().toISOString().split('T')[0],
        time_start: '09:00', time_end: '09:30',
        customer_name: '', customer_phone: '', status: 'scheduled', notes: '',
    };
    const isEdit = !!existingId;
    if (isEdit) {
        const found = (window._allAppointments || []).find(a => a.id === existingId);
        if (found) appt = found;
    }

    openModal(isEdit ? 'Edit Appointment' : 'Book Appointment', `
        <form onsubmit="submitAppointment(event, ${existingId || 'null'})">
            <div class="form-row">
                <div class="form-group"><label>Appointment Type *</label>
                    <select id="appt-type" required>${APPT_TYPES.map(t => `<option value="${t}" ${t === appt.appointment_type ? 'selected' : ''}>${APPT_TYPE_LABELS[t]}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Status</label>
                    <select id="appt-status">${APPT_STATUSES.map(s => `<option value="${s}" ${s === appt.status ? 'selected' : ''}>${APPT_STATUS_LABELS[s]}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-row-3">
                <div class="form-group"><label>Date *</label><input type="date" id="appt-date" required value="${appt.date}"></div>
                <div class="form-group"><label>Start Time *</label><input type="time" id="appt-start" required value="${appt.time_start}"></div>
                <div class="form-group"><label>End Time *</label><input type="time" id="appt-end" required value="${appt.time_end}"></div>
            </div>
            <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
            <p class="text-xs text-secondary mb-4" style="font-weight:600;text-transform:uppercase">Customer Information (select officer or enter walk-in details)</p>
            <div class="form-row">
                <div class="form-group"><label>Officer (optional)</label>
                    <select id="appt-officer" onchange="apptOfficerChanged(this.value)">
                        <option value="">Walk-in / Not in system</option>
                        ${officers.map(o => `<option value="${o.id}" data-dept="${o.department_id}" data-name="${o.first_name} ${o.last_name}" ${o.id === appt.officer_id ? 'selected' : ''}>${o.first_name} ${o.last_name} (${o.badge_number})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Department (optional)</label>
                    <select id="appt-dept">
                        <option value="">None</option>
                        ${depts.map(d => `<option value="${d.id}" ${d.id === appt.department_id ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Customer Name</label><input id="appt-name" value="${appt.customer_name}" placeholder="For walk-ins..."></div>
                <div class="form-group"><label>Phone</label><input id="appt-phone" value="${appt.customer_phone}" placeholder="(555) 000-0000"></div>
            </div>
            <div class="form-group"><label>Notes</label><textarea id="appt-notes" rows="2" placeholder="Appointment details, special requests...">${appt.notes}</textarea></div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Book Appointment'}</button>
            </div>
        </form>
    `);
}

function apptOfficerChanged(officerId) {
    if (!officerId) return;
    const option = document.querySelector(`#appt-officer option[value="${officerId}"]`);
    if (option) {
        document.getElementById('appt-name').value = option.dataset.name || '';
        document.getElementById('appt-dept').value = option.dataset.dept || '';
    }
}

async function submitAppointment(e, id) {
    e.preventDefault();
    const val = fid => document.getElementById(fid).value;
    const body = JSON.stringify({
        officer_id: val('appt-officer') ? parseInt(val('appt-officer')) : null,
        department_id: val('appt-dept') ? parseInt(val('appt-dept')) : null,
        appointment_type: val('appt-type'),
        date: val('appt-date'),
        time_start: val('appt-start'),
        time_end: val('appt-end'),
        customer_name: val('appt-name'),
        customer_phone: val('appt-phone'),
        status: val('appt-status'),
        notes: val('appt-notes'),
    });
    try {
        if (id) {
            await api(`/appointments/${id}`, { method: 'PUT', body });
            toast('Appointment updated');
        } else {
            await api('/appointments', { method: 'POST', body });
            toast('Appointment booked successfully');
        }
        closeModal();
        renderAppointments();
    } catch (e) { toast(e.message, 'error'); }
}

function showAppointmentDetail(apptId) {
    const appt = (window._allAppointments || []).find(a => a.id === apptId);
    if (!appt) return;
    openModal('Appointment Details', `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">${apptTypeBadge(appt.appointment_type)} ${apptStatusBadge(appt.status)}</div>
            <span class="text-sm text-secondary">${appt.date} | ${appt.time_start} - ${appt.time_end}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Customer</p><p class="text-sm"><strong>${appt.customer_name || appt.officer_name || 'Walk-in'}</strong></p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Phone</p><p class="text-sm">${appt.customer_phone || '-'}</p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Department</p><p class="text-sm">${appt.department_name || 'N/A'}</p></div>
            <div><p class="text-xs text-secondary" style="font-weight:600;text-transform:uppercase;margin-bottom:2px">Linked Officer</p><p class="text-sm">${appt.officer_name || 'Walk-in'}</p></div>
        </div>
        ${appt.notes ? `<div style="background:var(--bg);padding:10px 14px;border-radius:6px;margin-bottom:16px"><p class="text-sm">${appt.notes}</p></div>` : ''}
        <div class="form-actions" style="border-top:none;margin-top:8px;padding-top:8px">
            ${appt.status === 'scheduled' ? `<button class="btn btn-success btn-sm" onclick="updateApptStatus(${appt.id}, 'confirmed')">Confirm</button>` : ''}
            ${appt.status === 'confirmed' ? `<button class="btn btn-success btn-sm" onclick="updateApptStatus(${appt.id}, 'completed')">Complete</button>` : ''}
            ${['scheduled','confirmed'].includes(appt.status) ? `<button class="btn btn-danger btn-sm" onclick="updateApptStatus(${appt.id}, 'cancelled')">Cancel</button>` : ''}
            ${['scheduled','confirmed'].includes(appt.status) ? `<button class="btn btn-secondary btn-sm" onclick="updateApptStatus(${appt.id}, 'no_show')">No Show</button>` : ''}
            <div style="flex:1"></div>
            <button class="btn btn-secondary btn-sm" onclick="closeModal(); showAppointmentForm(${appt.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAppointment(${appt.id})">Delete</button>
        </div>
    `);
}

async function updateApptStatus(apptId, status) {
    const appt = (window._allAppointments || []).find(a => a.id === apptId);
    if (!appt) return;
    try {
        await api(`/appointments/${apptId}`, {
            method: 'PUT',
            body: JSON.stringify({ ...appt, status }),
        });
        toast(`Appointment ${APPT_STATUS_LABELS[status].toLowerCase()}`);
        closeModal();
        renderAppointments();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteAppointment(apptId) {
    if (!confirm('Delete this appointment?')) return;
    try {
        await api(`/appointments/${apptId}`, { method: 'DELETE' });
        toast('Appointment deleted');
        closeModal();
        renderAppointments();
    } catch (e) { toast(e.message, 'error'); }
}
