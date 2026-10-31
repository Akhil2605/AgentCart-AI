/**
 * AGENTCART AI — CORE FRONTEND APPLICATION
 * Handles Product Catalogue, Filtering, Sorting, Modals, Comparisons,
 * Cart Interactions, PayPal Sandbox Checkout, Customer Wishlist,
 * Order Notifications, Returns & Refunds, and Admin Management Console.
 */

// Global Application State
const State = {
  products: [],
  filters: {
    category: 'All',
    search: '',
    size: null,
    maxPrice: 5000,
    sort: 'featured'
  },
  cart: new Map(), // key: `${id}-${size}-${color}` -> { product, size, color, quantity }
  compare: new Set(), // set of product IDs (up to 4)
  wishlist: new Set(), // set of wishlisted product IDs
  notifications: [],
  unreadNotifsCount: 0,
  returns: [],
  config: {
    ai_configured: false,
    paypal_configured: false,
    paypal_client_id: null,
    free_shipping_threshold: 2000,
    standard_shipping_fee: 150
  },
  profile: null,
  profileStats: null,
  activeModalProduct: null,
  selectedModalSize: null,
  selectedModalColor: null,
  modalQty: 1,
  adminToken: sessionStorage.getItem('agentcart_admin_token') || null,
  isAdmin: false,
  admin: null
};

// Utilities
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
// Fixed demonstration exchange rate (1 USD = 85 INR; updated dynamically via /api/config)
let USD_RATE = 85;
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const usd = (n) => '$' + (Number(n) / USD_RATE).toFixed(2);
const dualPrice = (n) => `${inr(n)} <span class="dual-usd">(≈ ${usd(n)} USD)</span>`;
const dualPricePlain = (n) => `${inr(n)} (≈ ${usd(n)} USD)`;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const animDur = (ms) => prefersReducedMotion ? 1 : ms;

let activeOrdersFilter = 'ALL';
let activePaymentsFilter = 'ALL';
let currentTrackingOrderId = null;

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initCartFromStorage();
  await fetchAppConfig();
  await loadProducts();
  await fetchUserProfile();
  await fetchWishlist();
  await fetchNotifications();
  await checkAdminAuth();
  setupEventListeners();
  setupAccountListeners();
  setupWishlistListeners();
  setupNotificationsListeners();
  setupPortalAndAdminListeners();
  setupPayPal();
  initScramblerElements();
  setupShowroomEvents();
});

// Load App Config from Server
async function fetchAppConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      State.config = await res.json();
      if (State.config.inr_to_usd_rate) {
        USD_RATE = Number(State.config.inr_to_usd_rate) || 85;
      }
      updateConfigUI();
    }
  } catch (err) {
    console.warn('Backend config offline, running in local standalone mode.');
  }
}

function updateConfigUI() {
  const guidance = $('#paypalGuidance');
  if (guidance && State.config.paypal_configured) {
    guidance.innerHTML = `<strong>⚡ PayPal Sandbox Live</strong><br>Connected with Client ID: <code>${State.config.paypal_client_id.substring(0, 8)}...</code>`;
  }
}

// Fetch products from API
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      State.products = data.products;
    } else {
      throw new Error('API products route returned ' + res.status);
    }
  } catch (err) {
    console.warn('API fetch failed, falling back to data/catalog.json:', err.message);
    try {
      const fallbackRes = await fetch('data/catalog.json');
      State.products = await fallbackRes.json();
    } catch (fErr) {
      console.error('Fatal: Failed to load catalog data:', fErr);
    }
  }

  renderProductGrid();
  updateHeroShowcase();
}

// ==========================================================================
// PRODUCT GRID & FILTERING (WITH HEART WISHLIST BUTTONS)
// ==========================================================================
function getFilteredProducts() {
  return State.products.filter(p => {
    // Category filter
    if (State.filters.category !== 'All' && p.category !== State.filters.category) {
      return false;
    }

    // Price filter
    if (p.price > State.filters.maxPrice) {
      return false;
    }

    // Size filter
    if (State.filters.size) {
      const hasSize = p.sizes && p.sizes.some(s => s.size === State.filters.size && s.stock > 0);
      if (!hasSize) return false;
    }

    // Search query filter
    if (State.filters.search.trim()) {
      const q = State.filters.search.toLowerCase().trim();
      const feats = Array.isArray(p.features) ? p.features.join(' ') : String(p.features || '');
      const cols = Array.isArray(p.colors) ? p.colors.map(c => c.name).join(' ') : '';
      const combined = `${p.name} ${p.category} ${p.style || ''} ${p.material || ''} ${feats} ${p.description || ''} ${cols}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    return true;
  }).sort((a, b) => {
    switch (State.filters.sort) {
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
      default: return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    }
  });
}

function renderProductGrid() {
  const grid = $('#productGrid');
  const countEl = $('#productCount');
  if (!grid) return;

  const filtered = getFilteredProducts();
  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="catalogue-empty" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <h3 style="font-size:1.1rem; color:var(--text-primary); margin: 12px 0 6px 0;">No technical jackets match your filters</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">Try adjusting your search terms, increasing your max budget, or resetting filters.</p>
        <button class="nav-btn primary" id="emptyResetBtn">Reset All Filters</button>
      </div>
    `;
    const resetBtn = $('#emptyResetBtn');
    if (resetBtn) resetBtn.onclick = resetFilters;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isComparing = State.compare.has(p.id);
    const isWishlisted = State.wishlist.has(p.id);
    const discount = p.original_price ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0;
    
    return `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${p.name}">
        <div class="card-badge-row">
          <span class="card-cat-badge">${p.category.replace(/Jackets|Shells/g, '').trim()}</span>
          ${discount > 0 ? `<span class="card-discount-badge">-${discount}% OFF</span>` : ''}
        </div>

        <div class="card-img-wrap" style="position:relative;">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          <!-- Heart Favorite Wishlist Button -->
          <button type="button" class="btn-wishlist-card ${isWishlisted ? 'active' : ''}" data-wishlist="${p.id}" aria-label="Save ${p.name} to wishlist" title="Save to Wishlist">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>

        <h3 class="card-name">${p.name}</h3>

        <div class="card-rating-row">
          <span class="stars">★★★★★</span>
          <span>${p.rating || 4.8} (${p.reviews_count || 42})</span>
        </div>

        <div class="card-material-snippet">${p.material || 'Technical Shell'}</div>

        <div class="card-specs-pills">
          ${p.waterproof_rating ? `<span class="spec-pill">${p.waterproof_rating}</span>` : ''}
          ${p.weight ? `<span class="spec-pill">${p.weight}</span>` : ''}
          <span class="spec-pill">${p.fit || 'Modern'}</span>
        </div>

        <div class="card-foot-row">
          <div class="card-price-col">
            <span class="card-current-price">${dualPrice(p.price)}</span>
            ${p.original_price ? `<span class="card-orig-price">${dualPrice(p.original_price)}</span>` : ''}
          </div>

          <div class="card-actions-col">
            <button class="btn-card-compare ${isComparing ? 'active' : ''}" data-compare="${p.id}" aria-label="Add to comparison" title="Compare">
              <svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
            </button>
            <button class="btn-card-add" data-add="${p.id}" aria-label="Add to cart">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              <span>Add</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (!prefersReducedMotion) {
    [...grid.children].forEach((card, i) => {
      card.animate([
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'none' }
      ], {
        duration: animDur(320),
        delay: animDur(Math.min(i * 25, 300)),
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'backwards'
      });
    });
  }
}

function resetFilters() {
  State.filters = {
    category: 'All',
    search: '',
    size: null,
    maxPrice: 5000,
    sort: 'featured'
  };

  if ($('#searchInput')) $('#searchInput').value = '';
  if ($('#priceRange')) $('#priceRange').value = 5000;
  if ($('#priceRangeVal')) $('#priceRangeVal').textContent = dualPricePlain(5000);
  if ($('#sortSelect')) $('#sortSelect').value = 'featured';

  $$('.chip-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'All'));
  $$('.size-btn').forEach(b => b.classList.remove('active'));

  renderProductGrid();
}

function updateHeroShowcase() {
  const flagship = State.products.find(p => p.id === 'cyber-shell-black');
  if (flagship) {
    if ($('#heroJacketImg')) $('#heroJacketImg').src = flagship.image;
    if ($('#detailsJacketVisual')) $('#detailsJacketVisual').src = flagship.image;
  }
}

// ==========================================================================
// 1. WISHLIST / SAVE FOR LATER ENGINE
// ==========================================================================
async function fetchWishlist() {
  try {
    const res = await fetch('/api/wishlist');
    if (res.ok) {
      const data = await res.json();
      State.wishlist = new Set((data.items || []).map(p => p.id));
      const countEl = $('#tabWishlistCount');
      if (countEl) countEl.textContent = State.wishlist.size;
      updateWishlistButtonsUI();
      renderWishlistItems(data.items || []);
    }
  } catch (err) {
    console.warn('Wishlist fetch error:', err);
  }
}

function updateWishlistButtonsUI(productId = null, isWishlisted = null) {
  if (productId) {
    $$(`.btn-wishlist-card[data-wishlist="${productId}"]`).forEach(btn => {
      btn.classList.toggle('active', isWishlisted);
    });
    const modalBtn = $('#modalWishlistBtn');
    if (modalBtn && State.activeModalProduct?.id === productId) {
      modalBtn.classList.toggle('active', isWishlisted);
    }
  } else {
    $$('.btn-wishlist-card').forEach(btn => {
      const id = btn.dataset.wishlist;
      btn.classList.toggle('active', State.wishlist.has(id));
    });
    const modalBtn = $('#modalWishlistBtn');
    if (modalBtn && State.activeModalProduct) {
      modalBtn.classList.toggle('active', State.wishlist.has(State.activeModalProduct.id));
    }
  }
}

async function toggleWishlist(productId) {
  if (!productId) return;
  const willBeWishlisted = !State.wishlist.has(productId);

  // Optimistic instant visual update
  if (willBeWishlisted) {
    State.wishlist.add(productId);
  } else {
    State.wishlist.delete(productId);
  }
  updateWishlistButtonsUI(productId, willBeWishlisted);

  const countEl = $('#tabWishlistCount');
  if (countEl) countEl.textContent = State.wishlist.size;

  try {
    const res = await fetch('/api/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId })
    });
    const data = await res.json();
    if (data.success) {
      if (data.in_wishlist) {
        State.wishlist.add(productId);
      } else {
        State.wishlist.delete(productId);
      }
      updateWishlistButtonsUI(productId, data.in_wishlist);
      if (data.stats && State.profileStats) {
        State.profileStats.wishlist_count = data.stats.wishlist_count;
      }
      if ($('#tabPaneWishlist')?.classList.contains('active')) {
        fetchWishlist();
      }
    }
  } catch (err) {
    console.error('Toggle wishlist error:', err);
  }
}

function renderWishlistItems(items) {
  const container = $('#accountWishlistList');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px 20px; color:var(--text-muted); grid-column: 1 / -1;">
        <div style="font-size:2.2rem; margin-bottom:8px;">🖤</div>
        <strong style="color:var(--text-primary); font-size:1rem;">Your Wishlist is Empty</strong>
        <p style="font-size:0.82rem; margin-top:4px;">Browse the 24 technical jackets in our catalogue and click the heart icon on any style to save it for later.</p>
        <button type="button" class="btn-tech-shop" onclick="closeAccountModal(); location.href='#catalogue';" style="margin:16px auto 0;">Explore Jackets</button>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(p => `
    <div class="wishlist-item-card" data-id="${p.id}">
      <div class="wishlist-thumb">
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="wishlist-item-info">
        <div class="wishlist-item-cat">${p.category.replace(/Jackets|Shells/g, '').trim()}</div>
        <div class="wishlist-item-title" title="${p.name}">${p.name}</div>
        <div class="wishlist-item-price">${dualPrice(p.price)}</div>
        <div class="wishlist-item-actions">
          <button type="button" class="btn-wishlist-move" onclick="moveWishlistToCart('${p.id}')">
            Move to Cart
          </button>
          <button type="button" class="btn-wishlist-remove" onclick="removeWishlistItem('${p.id}')">
            Remove
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function moveWishlistToCart(productId) {
  const product = State.products.find(p => p.id === productId);
  if (product) {
    addToCart(product, 'M', null, 1);
    await toggleWishlist(productId);
    fetchWishlist();
  }
}

async function removeWishlistItem(productId) {
  await toggleWishlist(productId);
  fetchWishlist();
}

function setupWishlistListeners() {
  const modalWishBtn = $('#modalWishlistBtn');
  if (modalWishBtn) {
    modalWishBtn.addEventListener('click', () => {
      if (State.activeModalProduct) {
        toggleWishlist(State.activeModalProduct.id);
      }
    });
  }
}

// ==========================================================================
// 2. IN-APP NOTIFICATIONS ENGINE
// ==========================================================================
async function fetchNotifications() {
  try {
    const res = await fetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      State.notifications = data.notifications || [];
      State.unreadNotifsCount = data.unread_count || 0;
      renderNotificationsUI();
    }
  } catch (err) {
    console.warn('Notifications fetch error:', err);
  }
}

function renderNotificationsUI() {
  const badge = $('#notificationBadgeCount');
  const unreadTag = $('#notifUnreadTag');
  const list = $('#notificationItemsList');

  if (badge) {
    badge.textContent = State.unreadNotifsCount;
    badge.style.display = State.unreadNotifsCount > 0 ? 'grid' : 'none';
  }
  if (unreadTag) {
    unreadTag.textContent = `${State.unreadNotifsCount} NEW`;
  }

  if (!list) return;

  if (State.notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty-state">No notifications yet. Real-time order updates will appear here.</div>';
    return;
  }

  const iconMap = {
    ORDER_PLACED: '📦',
    ORDER_PROCESSING: '⚙️',
    PAYMENT_SUCCESS: '💳',
    PAYMENT_FAILED: '⚠️',
    SHIPPED: '✈️',
    OUT_FOR_DELIVERY: '🚚',
    DELIVERED: '🏆',
    RETURN_REQUESTED: '🔄',
    RETURN_APPROVED: '✅',
    RETURN_REJECTED: '❌',
    RETURN_RECEIVED: '📥',
    REFUND_ISSUED: '💰'
  };

  list.innerHTML = State.notifications.map(n => {
    const icon = iconMap[n.type] || '🔔';
    const dateStr = n.created_at ? new Date(n.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Just now';

    return `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-icon">${icon}</div>
        <div class="notif-content">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-msg">${n.message}</div>
          <div class="notif-item-time">${dateStr}</div>
        </div>
        ${!n.is_read ? `<button type="button" class="btn-notif-mark-one" onclick="markNotificationRead(${n.id})" title="Mark read" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem; padding:4px;">✓</button>` : ''}
      </div>
    `;
  }).join('');
}

async function markNotificationRead(id) {
  try {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      State.notifications = data.notifications || [];
      State.unreadNotifsCount = data.unread_count || 0;
      renderNotificationsUI();
    }
  } catch (e) {
    console.error(e);
  }
}

async function markAllNotificationsRead() {
  try {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      State.notifications = data.notifications || [];
      State.unreadNotifsCount = 0;
      renderNotificationsUI();
    }
  } catch (e) {
    console.error(e);
  }
}

function setupNotificationsListeners() {
  const notifBtn = $('#notificationBtn');
  const dropdown = $('#notificationDropdown');
  const markAllBtn = $('#btnMarkAllNotifs');

  if (notifBtn && dropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      notifBtn.setAttribute('aria-expanded', String(!isVisible));
      if (!isVisible) fetchNotifications();
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        dropdown.style.display = 'none';
        notifBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllNotificationsRead();
    });
  }
}

// ==========================================================================
// 3. RETURNS & REFUNDS ENGINE
// ==========================================================================
async function fetchReturns() {
  const list = $('#accountReturnsList');
  if (!list) return;

  try {
    const res = await fetch('/api/returns');
    const data = await res.json();
    State.returns = data.returns || [];

    if (State.returns.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:48px 20px; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:8px;">🔄</div>
          <strong style="color:var(--text-primary); font-size:1rem;">No Return Requests</strong>
          <p style="font-size:0.82rem; margin-top:4px;">You can request a return for any paid or delivered jacket from your My Orders & Tracking tab.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = State.returns.map(ret => {
      const dateStr = ret.created_at ? new Date(ret.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Recent';
      const statusClass = (ret.status || 'REQUESTED').toLowerCase();

      return `
        <div class="return-card">
          <div class="return-card-header">
            <div>
              <strong style="font-family:var(--font-mono); font-size:0.85rem;">${ret.id}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">Order: ${ret.order_id} • ${dateStr}</span>
            </div>
            <span class="return-status-pill ${statusClass}">${ret.status}</span>
          </div>
          <div style="margin-top:8px;">
            <div style="font-weight:700; color:var(--text-primary); font-size:0.92rem;">${ret.product_name} (${ret.size} / ${ret.color}) × ${ret.quantity}</div>
            <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">Reason: <strong>${ret.reason}</strong></div>
            ${ret.description ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px; font-style:italic;">"${ret.description}"</div>` : ''}
          </div>
          ${ret.admin_notes ? `<div style="margin-top:10px; padding:8px 12px; background:#FAF8F5; border-radius:6px; font-size:0.75rem; color:var(--text-secondary); border-left:3px solid var(--accent-orange);">Admin Note: ${ret.admin_notes}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div style="color:var(--color-error); padding:20px;">Failed to load returns: ${err.message}</div>`;
  }
}

function openReturnRequestModal(orderId, productId = '', productName = '', size = '', color = '', quantity = 1) {
  const modal = $('#returnRequestModal');
  if (!modal) return;

  $('#returnOrderId').value = orderId;
  $('#returnProductId').value = productId;
  $('#returnReasonSelect').value = '';
  $('#returnDescriptionInput').value = '';

  $('#returnItemSummaryBox').innerHTML = `
    <div style="font-family:var(--font-mono); font-weight:700; font-size:0.85rem; margin-bottom:2px;">Order ID: ${orderId}</div>
    <div>Item: <strong>${productName || 'Technical Jacket'}</strong> (${size || 'M'} / ${color || 'Default'}) × ${quantity}</div>
  `;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeReturnRequestModal() {
  const modal = $('#returnRequestModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

// ==========================================================================
// 4. ENTRY PORTAL & ADMIN MANAGEMENT CONSOLE
// ==========================================================================
async function checkAdminAuth() {
  const token = sessionStorage.getItem('agentcart_admin_token');
  if (!token) {
    State.isAdmin = false;
    updateAdminHeaderUI(false);
    return;
  }

  try {
    const res = await fetch('/api/admin/check-auth', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.authenticated) {
      State.isAdmin = true;
      State.admin = data.admin;
      updateAdminHeaderUI(true);
    } else {
      sessionStorage.removeItem('agentcart_admin_token');
      State.isAdmin = false;
      updateAdminHeaderUI(false);
    }
  } catch (e) {
    console.warn('Admin auth verification failed:', e);
  }
}

function updateAdminHeaderUI(isAdmin) {
  const badge = $('#headerAdminBadge');
  if (badge) badge.style.display = isAdmin ? 'flex' : 'none';
  if ($('#adminUserDisplay')) {
    $('#adminUserDisplay').textContent = State.admin?.username || 'admin';
  }
}

function openEntryPortalModal() {
  const modal = $('#entryPortalModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeEntryPortalModal() {
  const modal = $('#entryPortalModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openAdminLoginModal() {
  const modal = $('#adminLoginModal');
  if (modal) {
    const alertBox = $('#adminLoginAlert');
    if (alertBox) alertBox.style.display = 'none';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeAdminLoginModal() {
  const modal = $('#adminLoginModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openAdminDashboardModal(tab = 'admin-overview') {
  const modal = $('#adminDashboardModal');
  if (!modal) return;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  switchAdminTab(tab);
}

function closeAdminDashboardModal() {
  const modal = $('#adminDashboardModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function switchAdminTab(tabName) {
  $$('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const paneMap = {
    'admin-overview': $('#adminPaneOverview'),
    'admin-products': $('#adminPaneProducts'),
    'admin-orders': $('#adminPaneOrders'),
    'admin-returns': $('#adminPaneReturns')
  };

  Object.keys(paneMap).forEach(key => {
    if (paneMap[key]) {
      paneMap[key].classList.toggle('active', key === tabName);
    }
  });

  if (tabName === 'admin-overview') fetchAdminDashboardStats();
  else if (tabName === 'admin-products') fetchAdminProducts();
  else if (tabName === 'admin-orders') fetchAdminOrders();
  else if (tabName === 'admin-returns') fetchAdminReturns();
}

async function fetchAdminDashboardStats() {
  const token = sessionStorage.getItem('agentcart_admin_token');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const s = data.stats;
    if ($('#adminMetricRevenue')) $('#adminMetricRevenue').innerHTML = `${inr(s.net_revenue_inr)} <small>($${s.net_revenue_usd.toFixed(2)} USD)</small>`;
    if ($('#adminMetricTotalOrders')) $('#adminMetricTotalOrders').textContent = s.total_orders;
    if ($('#adminMetricPendingOrders')) $('#adminMetricPendingOrders').textContent = s.pending_orders;
    if ($('#adminMetricLowStock')) $('#adminMetricLowStock').textContent = s.low_stock_count;
    if ($('#adminMetricPendingReturns')) $('#adminMetricPendingReturns').textContent = s.pending_returns;

    // Render Low Stock Table
    const lowStockTbody = $('#adminLowStockTbody');
    if (lowStockTbody) {
      if (!s.low_stock_items || s.low_stock_items.length === 0) {
        lowStockTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-muted);">All variant inventories are well-stocked (>= 5 units).</td></tr>';
      } else {
        lowStockTbody.innerHTML = s.low_stock_items.map(item => `
          <tr>
            <td><strong>${item.product_name}</strong></td>
            <td><span class="font-mono-tech">${item.size}</span></td>
            <td>${item.color_name}</td>
            <td><strong style="color:var(--accent-orange);">${item.stock} units</strong></td>
            <td>
              <div class="stock-stepper">
                <button type="button" onclick="adminAdjustStock(${item.id}, -1)">−</button>
                <span>${item.stock}</span>
                <button type="button" onclick="adminAdjustStock(${item.id}, 1)">+</button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }

    // Render Recent Returns in overview
    fetchAdminRecentReturns();
  } catch (err) {
    console.error('Fetch admin stats error:', err);
  }
}

async function fetchAdminRecentReturns() {
  const container = $('#adminRecentReturnsList');
  if (!container) return;
  const token = sessionStorage.getItem('agentcart_admin_token');
  try {
    const res = await fetch('/api/admin/returns', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const returns = (data.returns || []).slice(0, 4);

    if (returns.length === 0) {
      container.innerHTML = '<div style="padding:16px; color:var(--text-muted); font-size:0.8rem;">No return requests pending.</div>';
      return;
    }

    container.innerHTML = returns.map(r => `
      <div style="padding:10px 0; border-bottom:1px solid rgba(30,41,59,0.06); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:0.82rem;">${r.id}</strong> • <span style="font-size:0.75rem; color:var(--text-muted);">${r.product_name}</span>
          <div style="font-size:0.72rem; color:var(--text-secondary);">${r.reason}</div>
        </div>
        <span class="return-status-pill ${r.status.toLowerCase()}">${r.status}</span>
      </div>
    `).join('');
  } catch (e) {}
}

async function fetchAdminProducts() {
  const tbody = $('#adminProductsTbody');
  if (!tbody) return;
  const token = sessionStorage.getItem('agentcart_admin_token');

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px;">Loading products...</td></tr>';

  try {
    const res = await fetch('/api/admin/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const products = data.products || [];

    tbody.innerHTML = products.map(p => {
      const activeBadge = p.is_active
        ? '<span class="status-badge active">Active</span>'
        : '<span class="status-badge inactive">Deactivated</span>';

      const variantBreakdown = (p.sizes || []).map(s => `${s.size}:${s.stock}`).join(' | ');

      return `
        <tr>
          <td><img src="${p.image}" width="40" height="40" style="object-fit:contain; border-radius:6px; background:#151F2E;"></td>
          <td><code style="font-size:0.72rem; color:var(--text-dim);">${p.id}</code></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category.replace(/Jackets|Shells/g, '').trim()}</td>
          <td><strong>${inr(p.price)}</strong></td>
          <td>${activeBadge}</td>
          <td><span class="font-mono-tech" style="font-size:0.75rem;">${variantBreakdown}</span></td>
          <td>
            <button type="button" class="btn-table-action" onclick="adminToggleActive('${p.id}')">
              ${p.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--color-error); padding:16px;">Failed to load products: ${err.message}</td></tr>`;
  }
}

async function adminToggleActive(productId) {
  const token = sessionStorage.getItem('agentcart_admin_token');
  try {
    const res = await fetch(`/api/admin/products/${productId}/toggle-active`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchAdminProducts();
      loadProducts(); // Refresh storefront
    }
  } catch (e) {
    alert('Error toggling product: ' + e.message);
  }
}

async function adminAdjustStock(variantId, change) {
  const token = sessionStorage.getItem('agentcart_admin_token');
  // First retrieve current variant
  try {
    const statsRes = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statsData = await statsRes.json();
    const item = statsData.stats?.low_stock_items?.find(it => it.id === variantId);
    const currentStock = item ? item.stock : 5;
    const newStock = Math.max(0, currentStock + change);

    const updateRes = await fetch('/api/admin/products/stock', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ variant_id: variantId, stock: newStock })
    });
    if (updateRes.ok) {
      fetchAdminDashboardStats();
    }
  } catch (e) {
    alert('Stock update error: ' + e.message);
  }
}

async function fetchAdminOrders() {
  const tbody = $('#adminOrdersTbody');
  if (!tbody) return;
  const token = sessionStorage.getItem('agentcart_admin_token');

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px;">Loading orders...</td></tr>';

  try {
    const res = await fetch('/api/admin/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const orders = data.orders || [];

    tbody.innerHTML = orders.map(ord => {
      const dateStr = ord.created_at ? new Date(ord.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'Recent';

      const itemsStr = (ord.items || []).map(i => `${i.product_name} (${i.size})×${i.quantity}`).join(', ');

      return `
        <tr>
          <td><strong style="font-family:var(--font-mono); font-size:0.75rem;">${ord.id}</strong></td>
          <td style="font-size:0.72rem; color:var(--text-muted);">${dateStr}</td>
          <td>${ord.customer_name}<br><small style="color:var(--text-dim);">${ord.customer_email}</small></td>
          <td style="font-size:0.75rem; max-width:200px;">${itemsStr}</td>
          <td><strong>${inr(ord.total_amount)}</strong><br><small>$${(ord.charged_amount || ord.total_amount/85).toFixed(2)} USD</small></td>
          <td><span class="order-badge-pill ${getStatusBadgeClass(ord.status)}">${ord.status}</span></td>
          <td>
            <select onchange="adminUpdateOrderStatus('${ord.id}', this.value)" style="font-size:0.75rem; padding:4px 6px; border-radius:6px; border:1px solid rgba(30,41,59,0.15);">
              <option value="" disabled selected>Change Status...</option>
              <option value="PAID">Paid</option>
              <option value="PROCESSING">Order Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--color-error); padding:16px;">Failed to load orders: ${err.message}</td></tr>`;
  }
}

async function adminUpdateOrderStatus(orderId, newStatus) {
  if (!newStatus) return;
  const token = sessionStorage.getItem('agentcart_admin_token');
  const stageMap = {
    PAID: 2,
    PROCESSING: 3,
    SHIPPED: 4,
    OUT_FOR_DELIVERY: 5,
    DELIVERED: 6
  };

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus, stage_number: stageMap[newStatus] || null })
    });
    if (res.ok) {
      fetchAdminOrders();
      fetchAdminDashboardStats();
    }
  } catch (e) {
    alert('Error updating order: ' + e.message);
  }
}

async function fetchAdminReturns() {
  const tbody = $('#adminReturnsTbody');
  if (!tbody) return;
  const token = sessionStorage.getItem('agentcart_admin_token');

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px;">Loading returns...</td></tr>';

  try {
    const res = await fetch('/api/admin/returns', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const returns = data.returns || [];

    if (returns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No return requests on file.</td></tr>';
      return;
    }

    tbody.innerHTML = returns.map(ret => {
      let actionButtons = '';
      if (ret.status === 'REQUESTED') {
        actionButtons = `
          <button type="button" class="btn-table-action primary" onclick="adminApproveReturn('${ret.id}')">Approve</button>
          <button type="button" class="btn-table-action danger" onclick="adminRejectReturn('${ret.id}')">Reject</button>
        `;
      } else if (ret.status === 'APPROVED') {
        actionButtons = `
          <button type="button" class="btn-table-action primary" onclick="adminReceiveReturn('${ret.id}')">Receive & Restock</button>
        `;
      } else if (ret.status === 'RECEIVED') {
        actionButtons = `
          <button type="button" class="btn-table-action primary" onclick="adminProcessRefund('${ret.id}')">Process PayPal Refund</button>
        `;
      } else if (ret.status === 'REFUNDED') {
        actionButtons = `<span style="font-size:0.75rem; color:#10B981; font-weight:700;">Refund Completed ✓</span>`;
      } else {
        actionButtons = `<span style="font-size:0.75rem; color:var(--text-muted);">${ret.status}</span>`;
      }

      return `
        <tr>
          <td><strong style="font-family:var(--font-mono); font-size:0.75rem;">${ret.id}</strong></td>
          <td><span style="font-family:var(--font-mono); font-size:0.75rem;">${ret.order_id}</span></td>
          <td>${ret.customer_name || 'Customer'}<br><small style="color:var(--text-dim);">${ret.customer_email || ''}</small></td>
          <td><strong>${ret.product_name}</strong> (${ret.size})</td>
          <td>${ret.reason}</td>
          <td><span class="return-status-pill ${ret.status.toLowerCase()}">${ret.status}</span></td>
          <td><div style="display:flex; gap:6px; flex-wrap:wrap;">${actionButtons}</div></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--color-error); padding:16px;">Failed to load returns: ${err.message}</td></tr>`;
  }
}

async function adminApproveReturn(returnId) {
  const token = sessionStorage.getItem('agentcart_admin_token');
  try {
    const res = await fetch(`/api/admin/returns/${returnId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ admin_notes: 'Approved by admin for return inspection' })
    });
    if (res.ok) {
      fetchAdminReturns();
      fetchAdminDashboardStats();
    }
  } catch (e) {
    alert('Error approving return: ' + e.message);
  }
}

async function adminRejectReturn(returnId) {
  const reason = prompt('Enter rejection reason for customer:', 'Return window expired or tags removed.');
  if (reason === null) return;

  const token = sessionStorage.getItem('agentcart_admin_token');
  try {
    const res = await fetch(`/api/admin/returns/${returnId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ admin_notes: reason })
    });
    if (res.ok) {
      fetchAdminReturns();
      fetchAdminDashboardStats();
    }
  } catch (e) {
    alert('Error rejecting return: ' + e.message);
  }
}

async function adminReceiveReturn(returnId) {
  const token = sessionStorage.getItem('agentcart_admin_token');
  try {
    const res = await fetch(`/api/admin/returns/${returnId}/receive`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ admin_notes: 'Item verified and restocked into warehouse inventory' })
    });
    if (res.ok) {
      alert('Return package marked as received. Item inventory has been automatically restocked!');
      fetchAdminReturns();
      fetchAdminDashboardStats();
      loadProducts();
    }
  } catch (e) {
    alert('Error receiving return: ' + e.message);
  }
}

async function adminProcessRefund(returnId) {
  if (!confirm('Execute verified PayPal Sandbox refund for this return?')) return;

  const token = sessionStorage.getItem('agentcart_admin_token');
  try {
    const res = await fetch(`/api/admin/returns/${returnId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'Approved customer return refund' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Success! Refund of $${data.refund.amount.toFixed(2)} USD processed via PayPal Sandbox. Status: ${data.refund.status}`);
      fetchAdminReturns();
      fetchAdminDashboardStats();
      fetchUserProfile();
    } else {
      alert('Refund failed: ' + (data.error || 'Server error'));
    }
  } catch (e) {
    alert('Error executing refund: ' + e.message);
  }
}

function setupPortalAndAdminListeners() {
  // Portal Entry Modal
  $('#entryPortalBtn')?.addEventListener('click', openEntryPortalModal);
  $('#footerPortalLink')?.addEventListener('click', (e) => { e.preventDefault(); openEntryPortalModal(); });
  $('#portalCloseBtn')?.addEventListener('click', closeEntryPortalModal);

  $('#btnSelectCustomerPortal')?.addEventListener('click', () => {
    closeEntryPortalModal();
    const cat = $('#catalogue');
    if (cat) cat.scrollIntoView({ behavior: 'smooth' });
  });

  $('#btnSelectAdminPortal')?.addEventListener('click', () => {
    closeEntryPortalModal();
    if (State.isAdmin) {
      openAdminDashboardModal();
    } else {
      openAdminLoginModal();
    }
  });

  // Admin Login Modal
  $('#adminLoginCloseBtn')?.addEventListener('click', closeAdminLoginModal);
  $('#adminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = $('#adminLoginAlert');
    alertBox.style.display = 'none';

    const username = $('#adminUsername').value.trim();
    const password = $('#adminPassword').value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.success) {
        alertBox.textContent = data.error || 'Invalid credentials.';
        alertBox.style.display = 'block';
        return;
      }

      sessionStorage.setItem('agentcart_admin_token', data.token);
      State.isAdmin = true;
      State.admin = data.admin;
      updateAdminHeaderUI(true);

      closeAdminLoginModal();
      openAdminDashboardModal();
    } catch (err) {
      alertBox.textContent = 'Connection error: ' + err.message;
      alertBox.style.display = 'block';
    }
  });

  // Header Admin Button
  $('#headerAdminBadge')?.addEventListener('click', () => {
    openAdminDashboardModal();
  });

  // Admin Dashboard Controls
  $('#adminDashboardCloseBtn')?.addEventListener('click', closeAdminDashboardModal);
  $('#btnAdminExitShowroom')?.addEventListener('click', closeAdminDashboardModal);
  $('#btnAdminLogout')?.addEventListener('click', async () => {
    const token = sessionStorage.getItem('agentcart_admin_token');
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    sessionStorage.removeItem('agentcart_admin_token');
    State.isAdmin = false;
    updateAdminHeaderUI(false);
    closeAdminDashboardModal();
  });

  // Admin Tabs
  $$('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAdminTab(btn.dataset.tab);
    });
  });

  // Return Request Modal Controls
  $('#returnCloseBtn')?.addEventListener('click', closeReturnRequestModal);
  $('#btnCancelReturn')?.addEventListener('click', closeReturnRequestModal);
  $('#returnRequestForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = $('#returnOrderId').value;
    const productId = $('#returnProductId').value;
    const reason = $('#returnReasonSelect').value;
    const description = $('#returnDescriptionInput').value;

    try {
      const res = await fetch('/api/returns/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          product_id: productId,
          reason,
          description
        })
      });
      const data = await res.json();
      if (data.success) {
        closeReturnRequestModal();
        alert('Return request submitted successfully. Our team will review your ticket promptly!');
        fetchReturns();
        fetchNotifications();
        switchAccountTab('returns');
      } else {
        alert('Failed to submit return: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      alert('Error submitting return: ' + err.message);
    }
  });
}

// ==========================================================================
// CART & FLYING ANIMATION (PRESERVED)
// ==========================================================================
function initCartFromStorage() {
  try {
    const saved = localStorage.getItem('agentcart_items');
    if (saved) {
      const parsed = JSON.parse(saved);
      State.cart.clear();
      for (const item of parsed) {
        State.cart.set(`${item.id}-${item.size}-${item.color}`, item);
      }
      updateCartPill();
    }
  } catch (err) {
    console.warn('Failed to load cart from storage:', err);
  }
}

function saveCartToStorage() {
  try {
    const list = [...State.cart.values()];
    localStorage.setItem('agentcart_items', JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save cart to storage:', err);
  }
}

function addToCart(product, size = null, color = null, quantity = 1, sourceImg = null) {
  const chosenSize = size || product.sizes?.[0]?.size || 'M';
  const chosenColor = color || product.colors?.[0]?.name || 'Standard';
  const key = `${product.id}-${chosenSize}-${chosenColor}`;

  if (State.cart.has(key)) {
    const existing = State.cart.get(key);
    existing.quantity += quantity;
  } else {
    State.cart.set(key, {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image: product.image,
      size: chosenSize,
      color: chosenColor,
      quantity
    });
  }

  saveCartToStorage();
  updateCartPill();

  if (sourceImg) {
    animateFlyToPill(sourceImg, product.image);
  }

  if (!$('#cartDrawer').hidden) {
    renderCartDrawer(false);
  }
}

function getCartCount() {
  let count = 0;
  for (const item of State.cart.values()) {
    count += item.quantity;
  }
  return count;
}

function calculateCartTotals() {
  let inrSubtotal = 0;
  for (const item of State.cart.values()) {
    inrSubtotal += item.price * item.quantity;
  }

  const isFreeShipping = inrSubtotal >= State.config.free_shipping_threshold;
  const inrDeliveryFee = isFreeShipping || inrSubtotal === 0 ? 0 : State.config.standard_shipping_fee;
  const inrTotal = inrSubtotal + inrDeliveryFee;
  const usdTotal = Number((inrTotal / USD_RATE).toFixed(2));

  return {
    inrSubtotal,
    inrDeliveryFee,
    inrTotal,
    usdTotal,
    isFreeShipping
  };
}

function renderCartDrawer(open = true) {
  const drawer = $('#cartDrawer');
  const itemsList = $('#cartItemsList');
  const subtotalEl = $('#cartSubtotal');
  const deliveryEl = $('#cartDeliveryFee');
  const finalTotalEl = $('#cartFinalTotal');
  const checkoutAmtEl = $('#checkoutBtnAmt');
  const deliveryBar = $('#cartDeliveryBar');
  const deliveryText = $('#cartDeliveryText');
  const countEl = $('#cartDrawerCount');

  const totals = calculateCartTotals();
  const totalCount = getCartCount();

  if (countEl) countEl.textContent = totalCount;
  if (subtotalEl) subtotalEl.innerHTML = dualPrice(totals.inrSubtotal);
  if (deliveryEl) deliveryEl.innerHTML = totals.isFreeShipping ? 'Free' : dualPrice(totals.inrDeliveryFee);
  if (finalTotalEl) finalTotalEl.innerHTML = `${dualPrice(totals.inrTotal)}`;
  if (checkoutAmtEl) checkoutAmtEl.textContent = `$${totals.usdTotal.toFixed(2)} USD`;

  const threshold = State.config.free_shipping_threshold;
  const pct = Math.min(100, Math.round((totals.inrSubtotal / threshold) * 100));
  if (deliveryBar) deliveryBar.style.width = pct + '%';

  if (deliveryText) {
    if (totals.isFreeShipping) {
      deliveryText.innerHTML = `✓ <strong>Free Express Delivery Unlocked!</strong>`;
    } else {
      const remaining = threshold - totals.inrSubtotal;
      deliveryText.innerHTML = `Add <strong>${inr(remaining)}</strong> more for Free Delivery`;
    }
  }

  if (State.cart.size === 0) {
    itemsList.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" stroke-width="1.5"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
        <p style="margin-top: 12px; font-weight: 700; color: var(--text-primary);">Your cart is empty</p>
        <small>Explore 24 technical jackets and start building your collection.</small>
      </div>
    `;
  } else {
    itemsList.innerHTML = [...State.cart.values()].map(item => `
      <div class="cart-item-row" data-key="${item.id}-${item.size}-${item.color}">
        <div class="cart-item-thumb">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-meta">${item.size} · ${item.color}</div>
          <div class="cart-item-price">${dualPrice(item.price * item.quantity)}</div>
        </div>
        <div class="cart-item-qty-wrap">
          <button class="cart-qty-btn minus" data-key="${item.id}-${item.size}-${item.color}">−</button>
          <span class="cart-qty-val font-mono-tech">${item.quantity}</span>
          <button class="cart-qty-btn plus" data-key="${item.id}-${item.size}-${item.color}">+</button>
        </div>
        <button class="cart-item-del-btn" data-key="${item.id}-${item.size}-${item.color}" aria-label="Remove item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `).join('');
  }

  if (open) {
    drawer.hidden = false;
    drawer.classList.add('open');
  }
}

function closeCartDrawer() {
  const drawer = $('#cartDrawer');
  if (drawer) {
    drawer.classList.remove('open');
    setTimeout(() => { drawer.hidden = true; }, 250);
  }
}

function animateFlyToPill(sourceImg, imgSrc) {
  const pill = $('#cartPill');
  if (!pill) return;

  pill.classList.remove('hide');
  const sourceRect = sourceImg.getBoundingClientRect();
  const targetRect = pill.getBoundingClientRect();

  const flyEl = document.createElement('div');
  flyEl.className = 'flying-jacket-clone';
  flyEl.innerHTML = `<img src="${imgSrc}" alt="flying item">`;

  Object.assign(flyEl.style, {
    left: sourceRect.left + 'px',
    top: sourceRect.top + 'px',
    width: Math.min(sourceRect.width, 100) + 'px',
    height: Math.min(sourceRect.height, 100) + 'px'
  });

  document.body.appendChild(flyEl);

  const deltaX = (targetRect.left + targetRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
  const deltaY = (targetRect.top + targetRect.height / 2) - (sourceRect.top + sourceRect.height / 2);

  const anim = flyEl.animate([
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
    { transform: `translate(${deltaX * 0.35}px, -90px) scale(0.85) rotate(-10deg)`, opacity: 1, offset: 0.4 },
    { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.25) rotate(12deg)`, opacity: 0.8, offset: 1 }
  ], {
    duration: animDur(850),
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
  });

  anim.onfinish = () => {
    flyEl.remove();
    pulsePill();
  };
}

function pulsePill() {
  const pill = $('#cartPill');
  if (pill) {
    pill.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.12)' },
      { transform: 'scale(1)' }
    ], {
      duration: animDur(340),
      easing: 'cubic-bezier(0.3, 1.4, 0.4, 1)'
    });
  }
}

function updateCartPill() {
  const pill = $('#cartPill');
  const headerCount = $('#headerCartCount');
  const totalItems = getCartCount();

  if (headerCount) headerCount.textContent = totalItems;

  if (!pill) return;

  if (totalItems === 0) {
    pill.classList.add('hide');
    return;
  }

  pill.classList.remove('hide');
  $('#cartPillCount').textContent = `${totalItems} item${totalItems > 1 ? 's' : ''}`;

  const stack = $('#cartPillStack');
  const items = [...State.cart.values()].slice(-3);
  stack.innerHTML = items.map((it, idx) => `
    <img src="${it.image}" alt="" style="transform: translateX(${idx * -6}px); z-index: ${3 - idx};">
  `).join('');
}

// ==========================================================================
// MODAL CONTROLLERS: PRODUCT, COMPARE, CHECKOUT
// ==========================================================================
function openProductModal(productId) {
  const product = State.products.find(p => p.id === productId);
  if (!product) return;

  State.activeModalProduct = product;
  State.selectedModalSize = product.sizes?.[0]?.size || 'M';
  State.selectedModalColor = product.colors?.[0]?.name || 'Default';
  State.modalQty = 1;

  $('#modalImg').src = product.image;
  $('#modalImg').alt = product.name;
  $('#modalCategory').textContent = product.category;
  $('#modalTitle').textContent = product.name;
  $('#modalPrice').innerHTML = dualPrice(product.price);

  const discount = product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
  if (discount > 0) {
    $('#modalOrigPrice').innerHTML = dualPrice(product.original_price);
    $('#modalOrigPrice').style.display = 'inline';
    $('#modalDiscountBadge').textContent = `-${discount}% OFF`;
    $('#modalDiscountBadge').style.display = 'inline';
  } else {
    $('#modalOrigPrice').style.display = 'none';
    $('#modalDiscountBadge').style.display = 'none';
  }

  $('#modalDesc').textContent = product.description;
  $('#modalQtyVal').textContent = '1';

  // Render Color Swatches
  const swatches = $('#modalSwatches');
  swatches.innerHTML = (product.colors || []).map(c => `
    <button class="color-swatch-btn ${c.name === State.selectedModalColor ? 'selected' : ''}" 
      style="background: ${c.hex};" 
      data-color="${c.name}" 
      title="${c.name}"
      aria-label="Color ${c.name}">
    </button>
  `).join('');

  // Render Sizes
  const sizesRow = $('#modalSizes');
  sizesRow.innerHTML = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => {
    const sizeData = product.sizes?.find(sz => sz.size === s);
    const inStock = sizeData && sizeData.stock > 0;
    const isSelected = s === State.selectedModalSize;
    return `
      <button class="modal-size-btn ${isSelected ? 'selected' : ''} ${!inStock ? 'disabled' : ''}" 
        data-size="${s}" 
        ${!inStock ? 'disabled' : ''}>
        ${s}
      </button>
    `;
  }).join('');

  updateModalStockDisplay();

  // Update heart wishlist state in modal
  const modalWishBtn = $('#modalWishlistBtn');
  if (modalWishBtn) {
    modalWishBtn.classList.toggle('active', State.wishlist.has(product.id));
  }

  const modal = $('#productModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function updateModalStockDisplay() {
  const product = State.activeModalProduct;
  if (!product) return;

  const sizeData = product.sizes?.find(s => s.size === State.selectedModalSize);
  const stockEl = $('#modalStockStatus');

  if (sizeData && sizeData.stock > 0) {
    stockEl.textContent = `In Stock (${sizeData.stock} units available)`;
    stockEl.className = 'modal-stock-indicator in-stock';
  } else {
    stockEl.textContent = 'Out of Stock in this size';
    stockEl.className = 'modal-stock-indicator out-of-stock';
  }
}

function closeProductModal() {
  const modal = $('#productModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  State.activeModalProduct = null;
}

// Product Comparison Flow
function toggleCompare(productId) {
  if (State.compare.has(productId)) {
    State.compare.delete(productId);
  } else {
    if (State.compare.size >= 4) {
      alert('You can compare a maximum of 4 jackets simultaneously.');
      return;
    }
    State.compare.add(productId);
  }

  updateCompareUI();
}

function updateCompareUI() {
  const bar = $('#compareStickyBar');
  const count = State.compare.size;
  const countVal = $('#compareCountVal');
  const navCount = $('#navCompareCount');
  const navLink = $('#navCompareLink');
  const strip = $('#compareThumbsStrip');

  if (countVal) countVal.textContent = count;
  if (navCount) navCount.textContent = count;

  if (navLink) {
    navLink.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  if (count === 0) {
    if (bar) bar.classList.remove('open');
    $$('.btn-card-compare').forEach(b => b.classList.remove('active'));
    return;
  }

  if (bar) bar.classList.add('open');

  const items = [...State.compare].map(id => State.products.find(p => p.id === id)).filter(Boolean);
  if (strip) {
    strip.innerHTML = items.map(p => `
      <div class="compare-thumb" title="${p.name}">
        <img src="${p.image}" alt="">
        <button class="compare-thumb-del" data-del="${p.id}">×</button>
      </div>
    `).join('');
  }

  $$('.btn-card-compare').forEach(b => {
    b.classList.toggle('active', State.compare.has(b.dataset.compare));
  });
}

function openCompareModal() {
  if (State.compare.size === 0) return;

  const table = $('#compareTable');
  const items = [...State.compare].map(id => State.products.find(p => p.id === id)).filter(Boolean);

  table.innerHTML = `
    <thead>
      <tr>
        <th>Specification</th>
        ${items.map(p => `
          <td class="compare-col-header">
            <img src="${p.image}" alt="">
            <div style="font-weight:800; font-size:0.95rem;">${p.name}</div>
            <div style="color:var(--accent-orange); font-weight:800; margin:4px 0;">${dualPrice(p.price)}</div>
            <button class="btn-card-add" data-add="${p.id}" style="margin:6px auto 0;">Add to Cart</button>
          </td>
        `).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>Category & Style</th>
        ${items.map(p => `<td>${p.category}</td>`).join('')}
      </tr>
      <tr>
        <th>Waterproof Rating</th>
        ${items.map(p => `<td class="compare-diff-highlight">${p.waterproof_rating || 'Weather-Resistant'}</td>`).join('')}
      </tr>
      <tr>
        <th>Breathability</th>
        ${items.map(p => `<td>${p.breathability || 'Standard'}</td>`).join('')}
      </tr>
      <tr>
        <th>Garment Weight</th>
        ${items.map(p => `<td>${p.weight || 'N/A'}</td>`).join('')}
      </tr>
      <tr>
        <th>Fit Profile</th>
        ${items.map(p => `<td>${p.fit || 'Regular'}</td>`).join('')}
      </tr>
      <tr>
        <th>Technical Material</th>
        ${items.map(p => `<td style="font-size:0.78rem; line-height:1.4;">${p.material || ''}</td>`).join('')}
      </tr>
      <tr>
        <th>Customer Rating</th>
        ${items.map(p => `<td>⭐ ${p.rating || 4.8} (${p.reviews_count || 42} reviews)</td>`).join('')}
      </tr>
    </tbody>
  `;

  const modal = $('#compareModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCompareModal() {
  const modal = $('#compareModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

// ==========================================================================
// CHECKOUT & PAYPAL SANDBOX FLOW
// ==========================================================================
function openCheckoutModal() {
  if (State.cart.size === 0) return;

  const totals = calculateCartTotals();

  if ($('#checkoutSubtotal')) $('#checkoutSubtotal').textContent = inr(totals.inrSubtotal);
  if ($('#checkoutDelivery')) $('#checkoutDelivery').textContent = totals.isFreeShipping ? 'Free' : inr(totals.inrDeliveryFee);
  if ($('#checkoutTotal')) $('#checkoutTotal').innerHTML = `$${totals.usdTotal.toFixed(2)} USD <span class="dual-usd">(${inr(totals.inrTotal)})</span>`;
  if ($('#checkoutRateInfo')) $('#checkoutRateInfo').textContent = `1 USD = ₹${USD_RATE.toFixed(2)} INR (Server Verified)`;

  if (State.profile) {
    if ($('#shipName')) $('#shipName').value = State.profile.name || 'Akhil';
    if ($('#shipEmail')) $('#shipEmail').value = State.profile.email || 'akhil@agentcart.ai';
    if ($('#shipAddress')) $('#shipAddress').value = State.profile.shipping_address || '402 Cyber Tech Residences, Indiranagar';
    if ($('#shipCity')) $('#shipCity').value = State.profile.city || 'Bengaluru';
    if ($('#shipState')) $('#shipState').value = State.profile.state || 'Karnataka';
    if ($('#shipPostal')) $('#shipPostal').value = State.profile.postal_code || '560038';
    if ($('#shipPhone')) $('#shipPhone').value = State.profile.phone || '+91 98765 43210';
  }

  updateCheckoutCountryEligibility();

  const modal = $('#checkoutModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  closeCartDrawer();
}

function updateCheckoutCountryEligibility() {
  const countryEl = $('#shipCountry');
  const alertEl = $('#domesticRestrictionAlert');
  const blockedEl = $('#domesticBlockedContainer');
  const paypalWrap = $('#paypalContainerWrap');

  if (!countryEl) return;

  const country = countryEl.value.trim();
  const isDomestic = /^(india|in|ind)$/i.test(country);

  if (isDomestic) {
    if (alertEl) alertEl.style.display = 'block';
    if (blockedEl) blockedEl.style.display = 'flex';
    if (paypalWrap) paypalWrap.style.display = 'none';
  } else {
    if (alertEl) alertEl.style.display = 'none';
    if (blockedEl) blockedEl.style.display = 'none';
    if (paypalWrap) paypalWrap.style.display = 'block';
  }
}

function closeCheckoutModal() {
  const modal = $('#checkoutModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function setupPayPal() {
  const clientId = State.config.paypal_client_id;
  if (!clientId || clientId === 'your_paypal_client_id_here') {
    return;
  }

  const script = document.createElement('script');
  script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
  script.async = true;

  script.onload = () => {
    if (window.paypal && window.paypal.Buttons) {
      window.paypal.Buttons({
        createOrder: async () => {
          const shipping = getShippingFormData();
          const items = [...State.cart.values()].map(it => ({
            id: it.id,
            size: it.size,
            color: it.color,
            quantity: it.quantity
          }));

          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, shipping_address: shipping })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error);
          return data.paypal_order_id;
        },
        onApprove: async (data) => {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paypal_order_id: data.orderID })
          });
          const result = await res.json();
          if (!result.success) throw new Error(result.error);
          handleOrderSuccess(result.order);
        },
        onCancel: async (data) => {
          await fetch('/api/paypal/cancel-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paypal_order_id: data.orderID })
          });
          alert('PayPal transaction was cancelled. Your items remain in the cart.');
        },
        onError: (err) => {
          console.error('PayPal Buttons Error:', err);
          alert('PayPal encountered an error. Please try again.');
        }
      }).render('#paypalButtonContainer');
    }
  };

  document.head.appendChild(script);
}

function getShippingFormData() {
  return {
    name: $('#shipName')?.value || 'Akhil',
    email: $('#shipEmail')?.value || 'akhil@agentcart.ai',
    address: $('#shipAddress')?.value || '402 Cyber Tech Residences, Indiranagar',
    city: $('#shipCity')?.value || 'Bengaluru',
    state: $('#shipState')?.value || 'Karnataka',
    postal_code: $('#shipPostal')?.value || '560038',
    phone: $('#shipPhone')?.value || '+91 98765 43210',
    country: $('#shipCountry')?.value || 'United States',
    user_id: 'user_akhil'
  };
}

async function executeDemoTestOrder() {
  const shipping = getShippingFormData();
  const isDomestic = /^(india|in|ind)$/i.test((shipping.country || '').trim());
  if (isDomestic) {
    alert('PayPal Domestic Payment Restriction: Under RBI regulations, PayPal does not support domestic payments within India. Please select United States or an international destination country to test PayPal checkout.');
    return;
  }

  const items = [...State.cart.values()].map(it => ({
    id: it.id,
    size: it.size,
    color: it.color,
    quantity: it.quantity
  }));

  try {
    const createRes = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, shipping_address: shipping })
    });
    const createData = await createRes.json();
    if (!createData.success) throw new Error(createData.error);

    const localOrderId = createData.order.id;

    const simRes = await fetch('/api/paypal/demo-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: localOrderId })
    });
    const simData = await simRes.json();
    if (!simData.success) throw new Error(simData.error);

    handleOrderSuccess(simData.order);
  } catch (err) {
    alert('Order checkout error: ' + err.message);
  }
}

function handleOrderSuccess(order) {
  closeCheckoutModal();

  $('#confOrderRef').textContent = `Order Reference: ${order.id}`;
  const receiptCard = $('#confReceiptCard');

  const isPaid = order.status === 'PAID';
  const statusBadge = isPaid
    ? '<span style="color:#10b981; font-weight:700; background:rgba(16,185,129,0.12); padding:3px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.3);">● PAID (PayPal Sandbox Verified)</span>'
    : `<span style="color:var(--accent-orange); font-weight:700; background:var(--accent-orange-soft); padding:3px 8px; border-radius:6px; border:1px solid var(--accent-orange-border);">● ${order.status}</span>`;
  
  const txnLine = order.payment_id
    ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; word-break:break-all;">PayPal Capture ID: <code style="color:var(--accent-orange); font-family:var(--font-mono);">${order.payment_id}</code></div>`
    : '';

  const chargedCurrency = order.charged_currency || 'USD';
  const chargedAmountStr = typeof order.charged_amount === 'number'
    ? `$${order.charged_amount.toFixed(2)} ${chargedCurrency}`
    : `${usd(order.total_amount)} USD`;

  receiptCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span style="font-weight:800;">Purchased Items (${order.items.length}):</span>
      ${statusBadge}
    </div>
    ${order.items.map(it => `
      <div class="receipt-item-line" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.82rem;">
        <span>${it.product_name} (${it.size} / ${it.color}) × ${it.quantity}</span>
        <strong>${dualPrice(it.line_total)}</strong>
      </div>
    `).join('')}
    <div class="receipt-item-line" style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.82rem;">
      <span>Delivery Fee</span>
      <span>${order.delivery_fee === 0 ? 'Free' : dualPrice(order.delivery_fee)}</span>
    </div>
    <div class="receipt-item-line" style="display:flex; justify-content:space-between; font-weight:800; font-size:1rem; border-top:1px solid var(--glass-border); padding-top:8px; margin-top:6px;">
      <span>Total Charged (${chargedCurrency})</span>
      <span style="color:var(--accent-orange); font-weight:800;">${chargedAmountStr} <span class="dual-inr" style="font-size:0.8rem; color:var(--text-muted);">(${inr(order.total_amount)})</span></span>
    </div>
    ${txnLine}
    <div style="margin-top:12px; font-size:0.75rem; color:var(--text-muted);">
      Ship To: <strong>${order.customer_name}</strong><br>
      ${order.shipping_address}, ${order.city}, ${order.state} - ${order.postal_code} (${order.country || 'India'})
    </div>
  `;

  const confModal = $('#confirmationModal');
  confModal.classList.add('open');
  confModal.setAttribute('aria-hidden', 'false');

  const trackBtn = $('#confTrackOrderBtn');
  if (trackBtn) {
    trackBtn.onclick = () => {
      closeConfirmationModal();
      openTrackingModal(order.id);
    };
  }

  fetchUserProfile();
  fetchNotifications();

  // Clear Cart
  State.cart.clear();
  saveCartToStorage();
  updateCartPill();
}

function closeConfirmationModal() {
  const confModal = $('#confirmationModal');
  confModal.classList.remove('open');
  confModal.setAttribute('aria-hidden', 'true');
}

// ==========================================================================
// MY ACCOUNT, ORDERS, WISHLIST, RETURNS & TRACKING CONSOLE
// ==========================================================================
function setupAccountListeners() {
  // All profile opening triggers
  const headerProfileBtn = $('#headerProfileBtn');
  if (headerProfileBtn) {
    headerProfileBtn.addEventListener('click', () => openAccountModal('profile'));
  }

  const navProfileLink = $('#navProfileLink');
  if (navProfileLink) {
    navProfileLink.addEventListener('click', () => openAccountModal('profile'));
  }

  const heroOpenProfileBtn = $('#heroOpenProfileBtn');
  if (heroOpenProfileBtn) {
    heroOpenProfileBtn.addEventListener('click', () => openAccountModal('profile'));
  }

  const mobileNavAccountLink = $('#mobileNavAccountLink');
  if (mobileNavAccountLink) {
    mobileNavAccountLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAccountModal('profile');
    });
  }

  const footerProfileLink = $('#footerProfileLink');
  if (footerProfileLink) {
    footerProfileLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAccountModal('profile');
    });
  }

  // Close Account Modal
  const accountCloseBtn = $('#accountCloseBtn');
  if (accountCloseBtn) {
    accountCloseBtn.addEventListener('click', closeAccountModal);
  }

  // Close Tracking Modal
  const trackingCloseBtn = $('#trackingCloseBtn');
  if (trackingCloseBtn) {
    trackingCloseBtn.addEventListener('click', closeTrackingModal);
  }

  // Account Tabs switching
  $$('.account-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAccountTab(btn.dataset.tab);
    });
  });

  // Profile Save Form
  const profileForm = $('#profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileSave);
  }

  // Orders Filters & Search
  $$('.order-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.order-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeOrdersFilter = chip.dataset.filter;
      fetchAndRenderOrders(activeOrdersFilter, $('#ordersSearchInput')?.value || '');
    });
  });

  const ordersSearch = $('#ordersSearchInput');
  if (ordersSearch) {
    let orderDebounce = null;
    ordersSearch.addEventListener('input', () => {
      clearTimeout(orderDebounce);
      orderDebounce = setTimeout(() => {
        fetchAndRenderOrders(activeOrdersFilter, ordersSearch.value);
      }, 300);
    });
  }

  // Payments Filters & Search
  $$('.payment-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.payment-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activePaymentsFilter = chip.dataset.filter;
      fetchAndRenderPayments(activePaymentsFilter, $('#paymentsSearchInput')?.value || '');
    });
  });

  const paymentsSearch = $('#paymentsSearchInput');
  if (paymentsSearch) {
    let payDebounce = null;
    paymentsSearch.addEventListener('input', () => {
      clearTimeout(payDebounce);
      payDebounce = setTimeout(() => {
        fetchAndRenderPayments(activePaymentsFilter, paymentsSearch.value);
      }, 300);
    });
  }
}

async function fetchUserProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      State.profile = data.profile;
      State.profileStats = data.stats;
      updateProfileUI();
    }
  } catch (err) {
    console.error('Failed to fetch user profile:', err);
  }
}

function updateProfileUI() {
  if (!State.profile) return;

  const navLabel = $('#navProfileNameLabel');
  if (navLabel) {
    navLabel.textContent = 'PROFILE';
  }

  if ($('#accountUserNameDisplay')) {
    $('#accountUserNameDisplay').textContent = State.profile.name || 'Akhil';
  }

  if ($('#accountAvatarInitials')) {
    const parts = (State.profile.name || 'Akhil').trim().split(' ');
    const initials = parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
    $('#accountAvatarInitials').textContent = initials;
  }

  if ($('#accountUserMetaDisplay')) {
    $('#accountUserMetaDisplay').textContent = `${State.profile.email} • ${State.profile.city}, ${State.profile.state || State.profile.country}`;
  }

  if (State.profileStats) {
    if ($('#statTotalOrders')) $('#statTotalOrders').textContent = State.profileStats.total_orders;
    if ($('#statActiveOrders')) $('#statActiveOrders').textContent = State.profileStats.active_orders;
    if ($('#statDeliveredOrders')) $('#statDeliveredOrders').textContent = State.profileStats.delivered_orders;
    if ($('#statTotalSpent')) $('#statTotalSpent').textContent = inr(State.profileStats.total_spent_inr);
    if ($('#statTotalSpentUsd')) $('#statTotalSpentUsd').textContent = `$${Number(State.profileStats.total_spent_usd || 0).toFixed(2)}`;

    renderProfileActivity(State.profileStats.recent_activity || []);
  }

  // Populate Profile Form fields
  if ($('#profName')) $('#profName').value = State.profile.name || '';
  if ($('#profEmail')) $('#profEmail').value = State.profile.email || '';
  if ($('#profPhone')) $('#profPhone').value = State.profile.phone || '';
  if ($('#profCountry')) $('#profCountry').value = State.profile.country || 'India';
  if ($('#profAddress')) $('#profAddress').value = State.profile.shipping_address || '';
  if ($('#profCity')) $('#profCity').value = State.profile.city || '';
  if ($('#profState')) $('#profState').value = State.profile.state || '';
  if ($('#profPostal')) $('#profPostal').value = State.profile.postal_code || '';
}

function renderProfileActivity(activities) {
  const container = $('#profileActivityList');
  if (!container) return;

  if (!activities || activities.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim); font-size:0.8rem; padding:12px;">No recent activity found.</div>';
    return;
  }

  container.innerHTML = activities.map(act => {
    const dateStr = act.created_at ? new Date(act.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Recent';
    const statusClass = getStatusBadgeClass(act.status);

    return `
      <div class="activity-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(30,41,59,0.06);">
        <div>
          <div style="font-family:var(--font-mono); font-weight:700; color:var(--text-primary); font-size:0.82rem;">${act.id}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${dateStr}</div>
        </div>
        <div style="text-align:right;">
          <span class="order-badge-pill ${statusClass}" style="margin-bottom:2px; display:inline-block;">${act.status}</span>
          <div style="font-weight:700; font-family:var(--font-mono); color:var(--text-primary); font-size:0.82rem;">${inr(act.total_amount)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'PAID':
    case 'PAID_DEMO_TEST': return 'badge-paid';
    case 'DELIVERED': return 'badge-delivered';
    case 'SHIPPED': return 'badge-shipped';
    case 'PROCESSING': return 'badge-processing';
    case 'PENDING': return 'badge-pending';
    case 'CANCELLED': return 'badge-cancelled';
    case 'FAILED': return 'badge-failed';
    default: return 'badge-paid';
  }
}

function openAccountModal(tab = 'profile') {
  const modal = $('#accountModal');
  if (!modal) return;

  fetchUserProfile();
  switchAccountTab(tab);

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAccountModal() {
  const modal = $('#accountModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function switchAccountTab(tabName) {
  $$('.account-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const paneMap = {
    profile: $('#tabPaneProfile'),
    orders: $('#tabPaneOrders'),
    payments: $('#tabPanePayments'),
    wishlist: $('#tabPaneWishlist'),
    returns: $('#tabPaneReturns')
  };

  Object.keys(paneMap).forEach(key => {
    if (paneMap[key]) {
      paneMap[key].classList.toggle('active', key === tabName);
    }
  });

  if (tabName === 'orders') {
    fetchAndRenderOrders(activeOrdersFilter, $('#ordersSearchInput')?.value || '');
  } else if (tabName === 'payments') {
    fetchAndRenderPayments(activePaymentsFilter, $('#paymentsSearchInput')?.value || '');
  } else if (tabName === 'wishlist') {
    fetchWishlist();
  } else if (tabName === 'returns') {
    fetchReturns();
  }
}

async function handleProfileSave(e) {
  e.preventDefault();

  const profileData = {
    name: $('#profName').value.trim(),
    email: $('#profEmail').value.trim(),
    phone: $('#profPhone').value.trim(),
    country: $('#profCountry').value.trim(),
    shipping_address: $('#profAddress').value.trim(),
    city: $('#profCity').value.trim(),
    state: $('#profState').value.trim(),
    postal_code: $('#profPostal').value.trim()
  };

  const statusLabel = $('#profileSaveStatus');
  const saveBtn = $('#btnSaveProfile');
  if (saveBtn) saveBtn.disabled = true;
  if (statusLabel) statusLabel.textContent = 'Saving to SQLite...';

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });

    const data = await res.json();
    if (data.success) {
      State.profile = data.profile;
      State.profileStats = data.stats;
      updateProfileUI();

      if (statusLabel) {
        statusLabel.textContent = '✓ Saved permanently to SQLite';
        statusLabel.style.color = '#10B981';
        setTimeout(() => {
          statusLabel.textContent = 'Persistent SQLite Storage';
          statusLabel.style.color = '';
        }, 3000);
      }
    } else {
      alert('Failed to update profile: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Error saving profile: ' + err.message);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function fetchAndRenderOrders(filter = 'ALL', search = '') {
  const container = $('#accountOrdersList');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:32px; color:var(--text-muted);">Loading orders from SQLite...</div>';

  try {
    const query = new URLSearchParams();
    if (filter && filter !== 'ALL') query.set('status', filter);
    if (search && search.trim()) query.set('search', search.trim());
    query.set('limit', '30');

    const res = await fetch(`/api/orders?${query.toString()}`);
    const data = await res.json();

    if (!data.success || !data.orders || data.orders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 20px; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:8px;">📦</div>
          <strong>No orders found matching the criteria.</strong>
          <p style="font-size:0.8rem; margin-top:4px;">Place a test purchase through Checkout to see genuine SQLite order tracking!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.orders.map(order => {
      const dateStr = order.created_at ? new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Recent';

      const statusBadgeClass = getStatusBadgeClass(order.status);
      const chargedStr = order.charged_amount ? `$${order.charged_amount.toFixed(2)} ${order.charged_currency || 'USD'}` : `$${(order.total_amount / (order.exchange_rate || 85)).toFixed(2)} USD`;

      const thumbsHtml = (order.items || []).map(item => `
        <div class="order-thumb-wrap" title="${item.product_name} (${item.size} / ${item.color})" style="position:relative; width:48px; height:48px; border-radius:8px; background:#151F2E; display:grid; place-items:center;">
          <img src="${item.image || 'assets/images/jackets/cyber-shell-black.png'}" alt="${item.product_name}" style="max-width:85%; max-height:85%; object-fit:contain;">
          ${item.quantity > 1 ? `<span class="order-thumb-qty" style="position:absolute; bottom:-4px; right:-4px; background:#E15C1D; color:#FFF; font-size:0.65rem; border-radius:999px; padding:1px 5px;">${item.quantity}</span>` : ''}
        </div>
      `).join('');

      const canRequestReturn = ['PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST'].includes(order.status);
      const firstItem = order.items && order.items[0];

      return `
        <div class="order-card-row" style="background:#FFF; border:1px solid var(--glass-border); border-radius:14px; padding:16px; margin-bottom:14px; box-shadow:var(--shadow-glass-sm);">
          <div class="order-card-head" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(30,41,59,0.06); padding-bottom:10px; margin-bottom:12px;">
            <div class="order-id-group">
              <span class="order-id-code" style="font-family:var(--font-mono); font-weight:800; color:var(--text-primary);">${order.id}</span>
              <span class="order-date-text" style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">• ${dateStr}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="order-badge-pill ${statusBadgeClass}">${order.status}</span>
              <span class="order-badge-pill badge-paid" style="font-size:0.65rem;">${order.payment_provider || 'PAYPAL'}</span>
            </div>
          </div>

          <div class="order-card-body" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
              <div class="order-thumbs-strip" style="display:flex; gap:8px;">
                ${thumbsHtml}
              </div>
              <div style="font-size:0.78rem; color:var(--text-secondary);">
                <div>${order.items.length} item${order.items.length > 1 ? 's' : ''}</div>
                <div style="color:var(--text-muted); font-size:0.72rem;">Ship to: ${order.customer_name} (${order.city})</div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              <div class="order-summary-pricing" style="text-align:right;">
                <div class="order-price-inr" style="font-weight:800; font-family:var(--font-mono); color:var(--text-primary); font-size:0.95rem;">${inr(order.total_amount)}</div>
                <div class="order-price-usd" style="font-size:0.75rem; color:var(--text-dim);">${chargedStr}</div>
              </div>

              ${canRequestReturn && firstItem ? `
                <button type="button" class="btn-table-action" onclick="openReturnRequestModal('${order.id}', '${firstItem.product_id}', '${firstItem.product_name.replace(/'/g, "\\'")}', '${firstItem.size}', '${firstItem.color}', ${firstItem.quantity})" title="Request return / exchange" style="color:var(--text-secondary);">
                  Request Return
                </button>
              ` : ''}

              <button class="btn-order-track" onclick="openTrackingModal('${order.id}')" style="display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px; background:var(--accent-orange-soft); border:1px solid var(--accent-orange-border); color:var(--accent-orange); font-size:0.75rem; font-weight:700; cursor:pointer;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Track Order</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--color-error); padding:20px;">Failed to load orders: ${err.message}</div>`;
  }
}

async function openTrackingModal(orderId) {
  currentTrackingOrderId = orderId;
  const modal = $('#trackingModal');
  if (!modal) return;

  $('#trackModalOrderId').textContent = orderId;
  const banner = $('#trackingSummaryBanner');
  const stepper = $('#trackingTimelineContainer');
  const advanceGroup = $('#trackingAdvanceGroup');

  banner.innerHTML = '<div style="color:var(--text-muted);">Fetching genuine tracking telemetry...</div>';
  stepper.innerHTML = '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  try {
    const res = await fetch(`/api/orders/${orderId}/tracking`);
    const data = await res.json();
    if (!data.success || !data.tracking) {
      banner.innerHTML = `<div style="color:var(--color-error);">Tracking data not found for ${orderId}</div>`;
      return;
    }

    const tr = data.tracking;
    const statusClass = getStatusBadgeClass(tr.current_status);

    banner.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span class="order-badge-pill ${statusClass}" style="font-size:0.8rem;">STATUS: ${tr.current_status}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          Destination: <strong style="color:var(--text-primary);">${tr.shipping_address}</strong>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; display:block;">Estimated Delivery</span>
        <strong style="color:var(--accent-orange); font-size:0.95rem; font-family:var(--font-mono);">${tr.estimated_delivery}</strong>
      </div>
    `;

    const completedStages = tr.timeline.filter(t => t.completed);
    const lastCompletedStage = completedStages.length > 0 ? completedStages[completedStages.length - 1].stage_number : 1;
    const currentActiveStage = tr.current_status === 'DELIVERED' ? 6 : Math.min(6, lastCompletedStage + (lastCompletedStage < 6 ? 1 : 0));

    stepper.innerHTML = tr.timeline.map((stage, idx) => {
      const isCompleted = stage.completed;
      const isActive = !isCompleted && stage.stage_number === currentActiveStage && tr.current_status !== 'CANCELLED' && tr.current_status !== 'FAILED';
      const isLast = idx === tr.timeline.length - 1;

      const dateStr = stage.completed_at ? new Date(stage.completed_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : (isActive ? 'In Progress' : 'Pending');

      const markerContent = isCompleted ? '✓' : stage.stage_number;

      return `
        <div class="stepper-stage-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active-stage' : ''}">
          ${!isLast ? '<div class="stepper-line"></div>' : ''}
          <div class="stepper-stage-marker">${markerContent}</div>
          <div class="stepper-content">
            <div class="stepper-title-row">
              <span class="stepper-title">${stage.stage_name}</span>
              <span class="stepper-time">${dateStr}</span>
            </div>
            <p class="stepper-desc">${stage.description}</p>
            ${stage.location ? `<span class="stepper-location">📍 ${stage.location}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    advanceGroup.innerHTML = [
      { num: 1, label: '1. Placed' },
      { num: 2, label: '2. Paid' },
      { num: 3, label: '3. Processing' },
      { num: 4, label: '4. Shipped' },
      { num: 5, label: '5. Out for Delivery' },
      { num: 6, label: '6. Delivered' }
    ].map(st => `
      <button class="btn-advance-chip" onclick="advanceOrderStageTest('${orderId}', ${st.num})">${st.label}</button>
    `).join('');

  } catch (err) {
    banner.innerHTML = `<div style="color:var(--color-error);">Tracking fetch failed: ${err.message}</div>`;
  }
}

async function advanceOrderStageTest(orderId, stageNumber) {
  try {
    const res = await fetch(`/api/orders/${orderId}/advance-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_number: stageNumber })
    });
    const data = await res.json();
    if (data.success) {
      openTrackingModal(orderId);
      fetchUserProfile();
      fetchNotifications();
      if ($('#tabPaneOrders').classList.contains('active')) {
        fetchAndRenderOrders(activeOrdersFilter, $('#ordersSearchInput')?.value || '');
      }
    } else {
      alert('Could not advance stage: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function closeTrackingModal() {
  const modal = $('#trackingModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

async function fetchAndRenderPayments(filter = 'ALL', search = '') {
  const container = $('#accountPaymentsList');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:32px; color:var(--text-muted);">Loading verified payment records from SQLite...</div>';

  try {
    const query = new URLSearchParams();
    if (filter && filter !== 'ALL') query.set('status', filter);
    if (search && search.trim()) query.set('search', search.trim());
    query.set('limit', '50');

    const res = await fetch(`/api/payments?${query.toString()}`);
    const data = await res.json();

    if (!data.success || !data.payments || data.payments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 20px; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:8px;">💳</div>
          <strong>No payment history records found.</strong>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="payments-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>PayPal Order ID</th>
            <th>Local Order ID</th>
            <th>Date & Time</th>
            <th>Amount (USD)</th>
            <th>Reference (INR)</th>
            <th>Method</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.payments.map(p => {
            const dateStr = p.created_at ? new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Recent';

            const badgeClass = p.status === 'SUCCESS' ? 'badge-success' : (p.status === 'PENDING' ? 'badge-pending' : (p.status === 'CANCELLED' ? 'badge-cancelled' : 'badge-failed'));
            const txnDisplay = p.transaction_id || p.id || 'Pending Capture';
            const paypalIdDisplay = p.provider_order_id || '—';

            return `
              <tr>
                <td><code style="color:var(--accent-orange); font-size:0.75rem;">${txnDisplay}</code></td>
                <td><code style="font-size:0.75rem; color:var(--text-muted);">${paypalIdDisplay}</code></td>
                <td><strong style="font-family:var(--font-mono); font-size:0.78rem;">${p.order_id}</strong></td>
                <td style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</td>
                <td><strong style="color:var(--text-primary); font-family:var(--font-mono);">$${Number(p.amount).toFixed(2)} ${p.currency}</strong></td>
                <td><span style="color:var(--text-secondary); font-size:0.78rem;">${inr(p.inr_amount || (p.amount * (p.exchange_rate || 85)))}</span></td>
                <td><span style="font-size:0.75rem;">${p.payment_method}</span></td>
                <td><span class="order-badge-pill ${badgeClass}">${p.status}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--color-error); padding:20px;">Failed to load payments: ${err.message}</div>`;
  }
}

// Global window exposure for HTML inline callbacks
window.openTrackingModal = openTrackingModal;
window.advanceOrderStageTest = advanceOrderStageTest;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.closeTrackingModal = closeTrackingModal;
window.openReturnRequestModal = openReturnRequestModal;
window.closeReturnRequestModal = closeReturnRequestModal;
window.markNotificationRead = markNotificationRead;
window.moveWishlistToCart = moveWishlistToCart;
window.removeWishlistItem = removeWishlistItem;
window.adminToggleActive = adminToggleActive;
window.adminAdjustStock = adminAdjustStock;
window.adminUpdateOrderStatus = adminUpdateOrderStatus;
window.adminApproveReturn = adminApproveReturn;
window.adminRejectReturn = adminRejectReturn;
window.adminReceiveReturn = adminReceiveReturn;
window.adminProcessRefund = adminProcessRefund;

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
  // Search input live filtering with debounce
  let searchTimeout;
  $('#searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      State.filters.search = e.target.value;
      renderProductGrid();
    }, 120);
  });

  // Category filter chips
  $('#categoryChips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    $$('.chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.filters.category = btn.dataset.cat;
    renderProductGrid();
  });

  // Size filter buttons
  $$('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      if (State.filters.size === size) {
        State.filters.size = null;
        btn.classList.remove('active');
      } else {
        $$('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.filters.size = size;
      }
      renderProductGrid();
    });
  });

  // Price range slider
  const priceRange = $('#priceRange');
  const priceRangeVal = $('#priceRangeVal');
  if (priceRange) {
    priceRange.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      State.filters.maxPrice = val;
      if (priceRangeVal) priceRangeVal.textContent = dualPricePlain(val);
      renderProductGrid();
    });
  }

  // Sort dropdown
  $('#sortSelect')?.addEventListener('change', (e) => {
    State.filters.sort = e.target.value;
    renderProductGrid();
  });

  // Clear all filters
  $('#clearAllFiltersBtn')?.addEventListener('click', resetFilters);
  $('#resetFiltersTopBtn')?.addEventListener('click', resetFilters);

  // Product Grid interactions: Card click -> Modal, Button click -> Add/Compare/Wishlist
  $('#productGrid')?.addEventListener('click', (e) => {
    const wishlistBtn = e.target.closest('.btn-wishlist-card');
    const addBtn = e.target.closest('.btn-card-add');
    const compareBtn = e.target.closest('.btn-card-compare');
    const card = e.target.closest('.product-card');

    if (wishlistBtn) {
      e.stopPropagation();
      const id = wishlistBtn.dataset.wishlist;
      toggleWishlist(id);
      return;
    }

    if (addBtn) {
      e.stopPropagation();
      const id = addBtn.dataset.add;
      const product = State.products.find(p => p.id === id);
      if (product) {
        const img = card ? card.querySelector('img') : null;
        addToCart(product, null, null, 1, img);
        addBtn.classList.add('added');
        addBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg><span>Added</span>`;
        setTimeout(() => {
          addBtn.classList.remove('added');
          addBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>Add</span>`;
        }, 1200);
      }
      return;
    }

    if (compareBtn) {
      e.stopPropagation();
      const id = compareBtn.dataset.compare;
      toggleCompare(id);
      return;
    }

    if (card) {
      openProductModal(card.dataset.id);
    }
  });

  // Hero Quick Add
  const heroQuickAdd = $('#heroQuickAddBtn');
  if (heroQuickAdd) {
    heroQuickAdd.addEventListener('click', () => {
      const product = State.products.find(p => p.id === 'cyber-shell-black');
      if (product) {
        addToCart(product, 'M', 'Onyx & Electric Blue', 1, $('#heroJacketImg'));
      }
    });
  }

  // Modal interactions
  $('#modalCloseBtn')?.addEventListener('click', closeProductModal);
  $('#productModal')?.addEventListener('click', (e) => {
    if (e.target === $('#productModal')) closeProductModal();
  });

  $('#modalSwatches')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-swatch-btn');
    if (!btn) return;
    $$('#modalSwatches .color-swatch-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    State.selectedModalColor = btn.dataset.color;
  });

  $('#modalSizes')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.modal-size-btn');
    if (!btn || btn.disabled) return;
    $$('#modalSizes .modal-size-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    State.selectedModalSize = btn.dataset.size;
    updateModalStockDisplay();
  });

  $('#modalQtyMinus')?.addEventListener('click', () => {
    if (State.modalQty > 1) {
      State.modalQty--;
      $('#modalQtyVal').textContent = State.modalQty;
    }
  });

  $('#modalQtyPlus')?.addEventListener('click', () => {
    State.modalQty++;
    $('#modalQtyVal').textContent = State.modalQty;
  });

  $('#modalAddToCartBtn')?.addEventListener('click', () => {
    if (!State.activeModalProduct) return;
    addToCart(State.activeModalProduct, State.selectedModalSize, State.selectedModalColor, State.modalQty, $('#modalImg'));
    closeProductModal();
  });

  $('#modalCompareToggleBtn')?.addEventListener('click', () => {
    if (State.activeModalProduct) {
      toggleCompare(State.activeModalProduct.id);
    }
  });

  // Cart Floating Pill & Drawer Panel
  $('#cartPill')?.addEventListener('click', () => renderCartDrawer(true));
  $('#headerCartBtn')?.addEventListener('click', () => renderCartDrawer(true));
  $('#cartCloseBtn')?.addEventListener('click', closeCartDrawer);

  $('#cartItemsList')?.addEventListener('click', (e) => {
    const minusBtn = e.target.closest('.cart-qty-btn.minus');
    const plusBtn = e.target.closest('.cart-qty-btn.plus');
    const delBtn = e.target.closest('.cart-item-del-btn');

    if (minusBtn) {
      const key = minusBtn.dataset.key;
      const it = State.cart.get(key);
      if (it) {
        if (it.quantity > 1) {
          it.quantity--;
        } else {
          State.cart.delete(key);
        }
        saveCartToStorage();
        updateCartPill();
        renderCartDrawer(false);
      }
      return;
    }

    if (plusBtn) {
      const key = plusBtn.dataset.key;
      const it = State.cart.get(key);
      if (it) {
        it.quantity++;
        saveCartToStorage();
        updateCartPill();
        renderCartDrawer(false);
      }
      return;
    }

    if (delBtn) {
      const key = delBtn.dataset.key;
      State.cart.delete(key);
      saveCartToStorage();
      updateCartPill();
      renderCartDrawer(false);
    }
  });

  $('#cartCheckoutBtn')?.addEventListener('click', openCheckoutModal);

  // Compare Sticky Bar & Modal
  $('#btnLaunchCompare')?.addEventListener('click', openCompareModal);
  $('#navCompareLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCompareModal();
  });
  $('#compareModalCloseBtn')?.addEventListener('click', closeCompareModal);
  $('#compareModal')?.addEventListener('click', (e) => {
    if (e.target === $('#compareModal')) closeCompareModal();
  });

  $('#compareThumbsStrip')?.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.compare-thumb-del');
    if (delBtn) {
      e.stopPropagation();
      toggleCompare(delBtn.dataset.del);
    }
  });

  $('#compareTable')?.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-card-add');
    if (addBtn) {
      const id = addBtn.dataset.add;
      const product = State.products.find(p => p.id === id);
      if (product) addToCart(product);
    }
  });

  // Checkout modal
  $('#checkoutCloseBtn')?.addEventListener('click', closeCheckoutModal);
  $('#btnDemoCheckout')?.addEventListener('click', executeDemoTestOrder);
  $('#confDoneBtn')?.addEventListener('click', closeConfirmationModal);
  $('#shipCountry')?.addEventListener('change', updateCheckoutCountryEligibility);

  // Mobile Menu Drawer Toggle
  const mobileToggle = $('#mobileMenuToggle');
  const mobileDrawer = $('#mobileNavDrawer');
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileDrawer.setAttribute('aria-hidden', String(!isOpen));
    });

    $$('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileDrawer.setAttribute('aria-hidden', 'true');
      });
    });
  }
}

// Scrambler / Cyber-Text Decrypt Engine
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#*&!/<>+-$%[]';

function scrambleText(element, targetText, duration = 650) {
  if (!element) return;
  const original = targetText || element.dataset.scramble || element.textContent.trim();
  if (prefersReducedMotion) {
    element.innerHTML = original.replace(/\n/g, '<br>');
    return;
  }

  const length = original.length;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const revealedCount = Math.floor(progress * length);

    let result = '';
    for (let i = 0; i < length; i++) {
      const char = original[i];
      if (char === ' ') {
        result += ' ';
      } else if (char === '\n') {
        result += '<br>';
      } else if (i < revealedCount) {
        result += char;
      } else {
        result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
    }

    element.innerHTML = result;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.innerHTML = original.replace(/\n/g, '<br>');
    }
  }

  requestAnimationFrame(update);
}

function initScramblerElements() {
  $$('.scramble-text').forEach((el, idx) => {
    setTimeout(() => {
      scrambleText(el);
    }, idx * 110);
  });
}

function setupShowroomEvents() {
  const btnExplore = $('#btnExploreJacket');
  if (btnExplore) {
    btnExplore.addEventListener('click', () => {
      openProductModal('cyber-shell-black');
    });
  }

  const heroShopBtn = $('#heroShopNowBtn');
  if (heroShopBtn) {
    heroShopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $('#catalogue');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
