/**
 * AGENTCART AI — CORE FRONTEND APPLICATION
 * Handles Product Catalogue, Filtering, Sorting, Modals, Comparisons,
 * AI Assistant Chat, Cart Interactions, and PayPal Sandbox Checkout.
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
  config: {
    ai_configured: false,
    paypal_configured: false,
    paypal_client_id: null,
    free_shipping_threshold: 2000,
    standard_shipping_fee: 150
  },
  aiHistory: [],
  activeModalProduct: null,
  selectedModalSize: null,
  selectedModalColor: null,
  modalQty: 1
};

// Utilities
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const animDur = (ms) => prefersReducedMotion ? 1 : ms;

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initCartFromStorage();
  await fetchAppConfig();
  await loadProducts();
  setupEventListeners();
  setupPayPal();
});

// Load App Config from Server
async function fetchAppConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      State.config = await res.json();
      updateConfigUI();
    }
  } catch (err) {
    console.warn('Backend config offline, running in local standalone mode.');
  }
}

function updateConfigUI() {
  const statusPill = $('#aiStatusPill');
  const statusText = $('#aiStatusText');
  if (statusPill && statusText) {
    if (State.config.ai_configured) {
      statusPill.className = 'ai-status-pill';
      statusText.textContent = 'Gemini 2.5 Live';
    } else {
      statusPill.className = 'ai-status-pill demo-pill';
      statusText.textContent = 'Demo Heuristic Assistant';
    }
  }

  const guidance = $('#paypalGuidance');
  if (guidance) {
    if (State.config.paypal_configured) {
      guidance.innerHTML = `<strong>⚡ PayPal Sandbox Live</strong><br>Connected with Client ID: <code>${State.config.paypal_client_id.substring(0, 8)}...</code>`;
    }
  }
}

// Fetch products from API (with fallback to catalog.json)
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
// PRODUCT GRID & FILTERING
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
      const combined = `${p.name} ${p.category} ${p.style} ${p.material} ${p.features.join(' ')} ${p.description} ${p.colors.map(c => c.name).join(' ')}`.toLowerCase();
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
      <div class="catalogue-empty">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <h3 style="font-size:1.1rem; color:#fff; margin-bottom:6px;">No technical jackets match your filters</h3>
        <p style="font-size:0.85rem; margin-bottom:16px;">Try adjusting your search terms, increasing your max budget, or resetting filters.</p>
        <button class="nav-btn primary" id="emptyResetBtn">Reset All Filters</button>
      </div>
    `;
    const resetBtn = $('#emptyResetBtn');
    if (resetBtn) resetBtn.onclick = resetFilters;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isComparing = State.compare.has(p.id);
    const discount = p.original_price ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0;
    
    return `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${p.name}">
        <div class="card-badge-row">
          <span class="card-cat-badge">${p.category.replace(/Jackets|Shells/g, '').trim()}</span>
          ${discount > 0 ? `<span class="card-discount-badge">-${discount}% OFF</span>` : ''}
        </div>

        <div class="card-img-wrap">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </div>

        <h3 class="card-name">${p.name}</h3>

        <div class="card-rating-row">
          <span class="stars">★★★★★</span>
          <span>${p.rating || 4.8} (${p.reviews_count || 42})</span>
        </div>

        <div class="card-material-snippet">${p.material}</div>

        <div class="card-specs-pills">
          ${p.waterproof_rating ? `<span class="spec-pill">${p.waterproof_rating}</span>` : ''}
          ${p.weight ? `<span class="spec-pill">${p.weight}</span>` : ''}
          <span class="spec-pill">${p.fit || 'Modern'}</span>
        </div>

        <div class="card-foot-row">
          <div class="card-price-col">
            <span class="card-current-price">${inr(p.price)}</span>
            ${p.original_price ? `<span class="card-orig-price">${inr(p.original_price)}</span>` : ''}
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

  // Subtle staggered entrance animation
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

  $('#searchInput').value = '';
  $('#priceRange').value = 5000;
  $('#priceRangeVal').textContent = '₹5,000';
  $('#sortSelect').value = 'featured';

  $$('.chip-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'All'));
  $$('.size-btn').forEach(b => b.classList.remove('active'));

  renderProductGrid();
}

function updateHeroShowcase() {
  const flagship = State.products.find(p => p.id === 'cyber-shell-black');
  if (flagship && $('#heroJacketImg')) {
    $('#heroJacketImg').src = flagship.image;
  }
}

// ==========================================================================
// CART & FLYING ANIMATION (PRESERVED & ENHANCED FROM APMC)
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
    console.warn('Failed to save cart:', err);
  }
}

function getCartTotal() {
  return [...State.cart.values()].reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
  return [...State.cart.values()].reduce((sum, item) => sum + item.quantity, 0);
}

function addToCart(product, size = null, color = null, qty = 1, sourceImgEl = null) {
  const chosenSize = size || (product.sizes?.[0]?.size || 'M');
  const chosenColor = color || (product.colors?.[0]?.name || 'Standard');
  const key = `${product.id}-${chosenSize}-${chosenColor}`;

  const existing = State.cart.get(key);
  if (existing) {
    existing.quantity += qty;
  } else {
    State.cart.set(key, {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image: product.image,
      size: chosenSize,
      color: chosenColor,
      quantity: qty
    });
  }

  saveCartToStorage();
  updateCartPill();

  // Execute Flying Jacket Animation to Cart Pill
  if (sourceImgEl) {
    animateFlyToPill(sourceImgEl, product.image);
  } else {
    pulsePill();
  }

  // Update Drawer if open
  if (!$('#cartDrawer').hidden) {
    renderCartDrawer(false);
  }
}

// Parabolic flying item animation
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

  const items = [...State.cart.values()];
  const stack = $('#cartPillStack');
  if (stack) {
    stack.innerHTML = items.slice(-3).map(it => `<i><img src="${it.image}" alt=""></i>`).join('');
  }

  const pillCount = $('#cartPillCount');
  if (pillCount) {
    pillCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  }

  if ($('#cartDrawer').hidden) {
    pill.classList.remove('hide');
  }
}

// Cart Drawer open & close with morphing effect
let cartBusy = false;
async function openCartDrawer() {
  if (cartBusy || !State.cart.size) return;
  cartBusy = true;

  const pill = $('#cartPill');
  const drawer = $('#cartDrawer');

  pill.classList.add('hide');
  renderCartDrawer(true);
  drawer.hidden = false;

  await drawer.animate([
    { transform: 'scale(0.3, 0.12)', opacity: 0, borderRadius: '999px' },
    { transform: 'scale(1)', opacity: 1, borderRadius: '24px' }
  ], {
    duration: animDur(480),
    easing: 'cubic-bezier(0.2, 0.9, 0.25, 1.05)'
  }).finished.catch(() => {});

  cartBusy = false;
  checkDeliveryEligibility();
}

async function closeCartDrawer() {
  if (cartBusy || $('#cartDrawer').hidden) return;
  cartBusy = true;

  const drawer = $('#cartDrawer');
  await drawer.animate([
    { transform: 'scale(1)', opacity: 1, borderRadius: '24px' },
    { transform: 'scale(0.3, 0.12)', opacity: 0, borderRadius: '999px' }
  ], {
    duration: animDur(320),
    easing: 'cubic-bezier(0.4, 0, 0.7, 0.3)'
  }).finished.catch(() => {});

  drawer.hidden = true;
  cartBusy = false;
  updateCartPill();
}

function renderCartDrawer(stagger) {
  const items = [...State.cart.values()].reverse();
  const list = $('#cartItemsList');
  const count = getCartCount();
  const subtotal = getCartTotal();

  if (items.length === 0) {
    closeCartDrawer();
    return;
  }

  $('#cartDrawerCount').textContent = count;
  $('#cartSubtotal').textContent = inr(subtotal);

  const deliveryFee = subtotal >= State.config.free_shipping_threshold ? 0 : State.config.standard_shipping_fee;
  $('#cartDeliveryFee').textContent = deliveryFee === 0 ? 'Free' : inr(deliveryFee);
  $('#cartFinalTotal').textContent = inr(subtotal + deliveryFee);
  $('#checkoutBtnAmt').textContent = inr(subtotal + deliveryFee);

  list.innerHTML = items.map(it => {
    const key = `${it.id}-${it.size}-${it.color}`;
    return `
      <div class="cart-item-row" data-key="${key}">
        <div class="cart-item-thumb">
          <img src="${it.image}" alt="">
        </div>
        <div class="cart-item-mid">
          <div class="cart-item-meta">${it.category}</div>
          <div class="cart-item-title">${it.name}</div>
          <div class="cart-item-variant">Size: <strong>${it.size}</strong> · ${it.color}</div>
          <div class="cart-qty-stepper">
            <button data-op="minus" aria-label="Decrease quantity">−</button>
            <span>${it.quantity}</span>
            <button data-op="plus" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-price">${inr(it.price * it.quantity)}</div>
          <button class="cart-item-del-btn" data-op="delete" aria-label="Remove item">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (stagger && !prefersReducedMotion) {
    [...list.children].forEach((row, idx) => {
      row.animate([
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' }
      ], {
        duration: animDur(320),
        delay: animDur(120 + idx * 45),
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'backwards'
      });
    });
  }
}

// Delivery eligibility animation
let deliveryCheckCount = 0;
function checkDeliveryEligibility() {
  const statusEl = $('#cartDeliveryStatus');
  const bar = $('#cartDeliveryBar');
  const text = $('#cartDeliveryText');
  const myCheck = ++deliveryCheckCount;

  statusEl.className = 'cart-delivery-status checking';
  text.textContent = 'Checking free delivery eligibility…';

  setTimeout(() => {
    if (myCheck !== deliveryCheckCount) return;

    statusEl.className = 'cart-delivery-status';
    const subtotal = getCartTotal();
    const threshold = State.config.free_shipping_threshold;
    const remaining = threshold - subtotal;

    if (remaining <= 0) {
      text.innerHTML = '<strong style="color:var(--green)">Free Express Delivery Unlocked 🎉</strong>';
      if (bar) bar.style.width = '100%';
    } else {
      const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
      text.innerHTML = `Add <strong>${inr(remaining)}</strong> more for free delivery`;
      if (bar) bar.style.width = `${pct}%`;
    }
  }, animDur(800));
}

// ==========================================================================
// PRODUCT DETAILS MODAL
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
  $('#modalPrice').textContent = inr(product.price);

  const discount = product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
  if (discount > 0) {
    $('#modalOrigPrice').textContent = inr(product.original_price);
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
  swatches.innerHTML = product.colors.map(c => `
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

  const modal = $('#productModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function updateModalStockDisplay() {
  const product = State.activeModalProduct;
  if (!product) return;

  const sizeData = product.sizes?.find(sz => sz.size === State.selectedModalSize);
  const stockEl = $('#modalStockStatus');
  if (sizeData && sizeData.stock > 0) {
    if (sizeData.stock <= 4) {
      stockEl.textContent = `Low stock: Only ${sizeData.stock} left in size ${State.selectedModalSize}`;
      stockEl.style.color = 'var(--amber)';
    } else {
      stockEl.textContent = `In Stock (${sizeData.stock} units available)`;
      stockEl.style.color = 'var(--green)';
    }
  } else {
    stockEl.textContent = `Size ${State.selectedModalSize} currently out of stock`;
    stockEl.style.color = 'var(--rose)';
  }
}

function closeProductModal() {
  const modal = $('#productModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  State.activeModalProduct = null;
}

// ==========================================================================
// PRODUCT COMPARISON LOGIC
// ==========================================================================
function toggleCompare(productId) {
  if (State.compare.has(productId)) {
    State.compare.delete(productId);
  } else {
    if (State.compare.size >= 4) {
      alert('You can compare up to 4 technical jackets simultaneously.');
      return;
    }
    State.compare.add(productId);
  }

  updateCompareTray();
  renderProductGrid();
}

function updateCompareTray() {
  const bar = $('#compareStickyBar');
  const countBadge = $('#navCompareCount');
  const countVal = $('#compareCountVal');
  const strip = $('#compareThumbsStrip');

  const count = State.compare.size;
  if (countVal) countVal.textContent = count;

  if (countBadge) {
    countBadge.textContent = count;
    countBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  if (count > 0) {
    bar.classList.add('visible');
    const items = [...State.compare].map(id => State.products.find(p => p.id === id)).filter(Boolean);
    strip.innerHTML = items.map(p => `
      <div class="compare-thumb-box">
        <img src="${p.image}" alt="">
        <button class="compare-thumb-remove" data-remove="${p.id}" aria-label="Remove from compare">×</button>
      </div>
    `).join('');
  } else {
    bar.classList.remove('visible');
  }
}

function openCompareModal() {
  if (State.compare.size < 2) {
    alert('Select at least 2 jackets to generate a side-by-side comparison.');
    return;
  }

  const items = [...State.compare].map(id => State.products.find(p => p.id === id)).filter(Boolean);
  const table = $('#compareTable');

  table.innerHTML = `
    <thead>
      <tr>
        <th>Specification</th>
        ${items.map(p => `
          <td class="compare-col-header">
            <img src="${p.image}" alt="">
            <div style="font-weight:800; font-size:0.95rem;">${p.name}</div>
            <div style="color:var(--accent-cyan); font-weight:800; margin:4px 0;">${inr(p.price)}</div>
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
        ${items.map(p => `<td style="font-size:0.78rem; line-height:1.4;">${p.material}</td>`).join('')}
      </tr>
      <tr>
        <th>Key Features</th>
        ${items.map(p => `<td><ul style="padding-left:14px; font-size:0.75rem; line-height:1.4;">${p.features.slice(0, 3).map(f => `<li>${f}</li>`).join('')}</ul></td>`).join('')}
      </tr>
      <tr>
        <th>Customer Rating</th>
        ${items.map(p => `<td>⭐ ${p.rating || 4.8} (${p.reviews_count} reviews)</td>`).join('')}
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
// AI SHOPPING ASSISTANT INTEGRATION
// ==========================================================================
async function submitAiPrompt(promptText) {
  if (!promptText || !promptText.trim()) return;

  const chatBody = $('#aiChatBody');
  const input = $('#aiPromptInput');
  const cleanPrompt = promptText.trim();
  input.value = '';

  // Append User message
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.textContent = cleanPrompt;
  chatBody.appendChild(userBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  // Append Thinking / Loading Indicator with restrained liquid pulse
  const aiLoading = document.createElement('div');
  aiLoading.className = 'chat-bubble ai';
  aiLoading.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="width:8px; height:8px; border-radius:50%; background:var(--accent-violet); box-shadow:0 0 10px var(--accent-violet); animation:liquidFloat 1.2s infinite ease-in-out;"></span>
      <span style="color:var(--accent-ice); font-size:0.85rem;">Analyzing 24 jackets against your budget, weather specs, and fit...</span>
    </div>
  `;
  chatBody.appendChild(aiLoading);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const res = await fetch('/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: cleanPrompt,
        history: State.aiHistory
      })
    });

    if (!res.ok) {
      throw new Error(`AI server responded with ${res.status}`);
    }

    const data = await res.json();
    aiLoading.remove();

    renderAiResponse(cleanPrompt, data);
  } catch (err) {
    console.warn('API assist call failed, utilizing client-side fallback heuristic:', err);
    aiLoading.remove();
    renderClientFallbackResponse(cleanPrompt);
  }
}

function renderAiResponse(userPrompt, data) {
  const chatBody = $('#aiChatBody');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai';

  // Status Banner if fallback
  let banner = '';
  if (data.is_fallback) {
    banner = `<div style="font-size:0.72rem; color:var(--amber); margin-bottom:8px; font-weight:700;">ℹ️ Heuristic Catalog Analysis Active (Demo Mode)</div>`;
  }

  // Extracted preferences tags
  let prefsHtml = '';
  const p = data.extracted_preferences;
  if (p) {
    const tags = [];
    if (p.budget_max) tags.push(`Max Budget: ₹${p.budget_max.toLocaleString('en-IN')}`);
    if (p.color) tags.push(`Color: ${p.color}`);
    if (p.size) tags.push(`Size: ${p.size}`);
    if (p.occasion) tags.push(`Occasion: ${p.occasion}`);

    if (tags.length > 0) {
      prefsHtml = `
        <div class="extracted-prefs-row">
          <span style="color:var(--text-dim); margin-right:4px;">Identified Constraints:</span>
          ${tags.map(t => `<span class="pref-tag">${t}</span>`).join(' · ')}
        </div>
      `;
    }
  }

  // Recommendations Grid
  let recsHtml = '';
  if (data.recommendations && data.recommendations.length > 0) {
    recsHtml = `
      <div class="ai-recommendations-grid">
        ${data.recommendations.map(rec => `
          <div class="ai-rec-card">
            <div class="ai-rec-thumb">
              <img src="${rec.image}" alt="">
            </div>
            <div class="ai-rec-title">${rec.name}</div>
            <div class="ai-rec-price">${inr(rec.price)}</div>
            <div class="ai-rec-reason">${rec.match_reason}</div>
            ${rec.trade_offs ? `<div style="font-size:0.68rem; color:var(--amber); margin-bottom:8px;">⚠️ Trade-off: ${rec.trade_offs}</div>` : ''}
            <div class="ai-rec-actions">
              <button class="ai-btn-add" data-add="${rec.id}">Add to Cart</button>
              <button class="ai-btn-view" data-view="${rec.id}">Specs</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  bubble.innerHTML = `
    ${banner}
    <div>${data.reply}</div>
    ${prefsHtml}
    ${recsHtml}
    ${data.trade_offs ? `<div style="margin-top:10px; font-size:0.78rem; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:6px;"><strong>Comparative Analysis:</strong> ${data.trade_offs}</div>` : ''}
  `;

  chatBody.appendChild(bubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  // Add to history
  State.aiHistory.push({ role: 'user', content: userPrompt });
  State.aiHistory.push({ role: 'assistant', content: data.reply });
}

function renderClientFallbackResponse(cleanPrompt) {
  // Simple grounded heuristic when offline
  const lower = cleanPrompt.toLowerCase();
  const matched = State.products.slice(0, 3);
  renderAiResponse(cleanPrompt, {
    is_fallback: true,
    reply: "I've reviewed our technical outerwear catalog to match your query:",
    extracted_preferences: { budget_max: 2000, size: 'M' },
    recommendations: matched.map(p => ({
      ...p,
      match_reason: `Engineered with ${p.material.substring(0, 40)}... and tested at ${p.waterproof_rating || 'high weatherproofing'}.`
    }))
  });
}

// ==========================================================================
// CHECKOUT & PAYPAL SANDBOX FLOW
// ==========================================================================
function openCheckoutModal() {
  if (State.cart.size === 0) return;

  const subtotal = getCartTotal();
  const delivery = subtotal >= State.config.free_shipping_threshold ? 0 : State.config.standard_shipping_fee;
  const total = subtotal + delivery;

  $('#checkoutSubtotal').textContent = inr(subtotal);
  $('#checkoutDelivery').textContent = delivery === 0 ? 'Free' : inr(delivery);
  $('#checkoutTotal').textContent = inr(total);

  const modal = $('#checkoutModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  closeCartDrawer();
}

function closeCheckoutModal() {
  const modal = $('#checkoutModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

let currentLocalOrderId = null;

function setupPayPal() {
  if (!State.config.paypal_configured || !State.config.paypal_client_id) {
    console.log('PayPal Sandbox SDK omitted in demo mode.');
    return;
  }

  // Update guidance UI
  const guidanceEl = $('#paypalGuidance');
  if (guidanceEl) {
    guidanceEl.innerHTML = `
      <div style="line-height:1.45;">
        <strong style="color:var(--accent-cyan); display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
          PayPal Sandbox Active
        </strong>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
          ⚠️ <strong>Testing Instructions:</strong> Log in with your <strong>Personal</strong> Sandbox Buyer account (<code style="color:var(--accent-cyan);">sb-buyerXXXX@personal.example.com</code>).<br>
          <em style="color:#ef4444;">Do NOT log in with your Business/Merchant account</em> — PayPal forbids merchants from buying from themselves and will show <em>“Things don't appear to be working”</em>.<br>
          <em>Tip:</em> Test in an <strong>Incognito/Private window</strong> if your browser has an active PayPal developer session.
        </div>
      </div>
    `;
  }

  // Dynamically inject official PayPal JS SDK with explicit capture intent
  const script = document.createElement('script');
  const currency = State.config.paypal_currency || 'USD';
  script.src = `https://www.paypal.com/sdk/js?client-id=${State.config.paypal_client_id}&currency=${currency}&intent=capture`;
  
  script.onerror = () => {
    console.error('Failed to load PayPal JS SDK.');
    if (guidanceEl) {
      guidanceEl.innerHTML = `
        <strong>⚠️ PayPal SDK Loading Issue</strong><br>
        Could not load PayPal SDK. Please ensure your Sandbox Client ID is from the Sandbox tab at <a href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" style="color:var(--accent-cyan); text-decoration:underline;">developer.paypal.com</a>. You can also test using the Demo Mode button below.
      `;
    }
  };

  script.onload = () => {
    if (window.paypal && $('#paypalButtonContainer')) {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        },
        createOrder: async () => {
          const shipping = getShippingFormData();
          const items = [...State.cart.values()].map(it => ({
            id: it.id,
            size: it.size,
            color: it.color,
            quantity: it.quantity
          }));

          console.log('[PayPal SDK] Calling /api/paypal/create-order with items:', items);

          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, shipping_address: shipping })
          });

          const data = await res.json();
          if (!data.success) {
            console.error('[PayPal SDK] /api/paypal/create-order rejected:', data);
            alert('Order creation failed: ' + (data.error || 'Server rejected order creation.'));
            throw new Error(data.error || 'Order creation failed');
          }

          console.log('[PayPal SDK] Order created successfully. PayPal Order ID:', data.paypal_order_id);
          currentLocalOrderId = data.order_id;
          return data.paypal_order_id;
        },
        onApprove: async (data) => {
          console.log('[PayPal SDK] onApprove triggered by PayPal popup:', data);
          try {
            const captureRes = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: currentLocalOrderId,
                paypal_order_id: data.orderID
              })
            });

            const captureData = await captureRes.json();
            if (captureData.success) {
              console.log('[PayPal SDK] Capture verified successfully:', captureData);
              handleOrderSuccess(captureData.order);
            } else {
              console.error('[PayPal SDK] Capture rejected by backend:', captureData);
              alert('PayPal capture error: ' + (captureData.error || 'Payment capture failed.'));
            }
          } catch (err) {
            console.error('[PayPal SDK] Network error during capture:', err);
            alert('Payment capture failed: ' + err.message);
          }
        },
        onCancel: async (data) => {
          console.log('[PayPal SDK] onCancel triggered:', data);
          if (currentLocalOrderId) {
            await fetch('/api/paypal/cancel-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: currentLocalOrderId,
                paypal_order_id: data?.orderID || null
              })
            }).catch(() => {});
          }
          alert('PayPal checkout was cancelled. Your items remain in your cart.');
        },
        onError: (err) => {
          console.error('[PayPal SDK] onError triggered:', err);
          alert('PayPal encountered an error during checkout. Please verify you are logged into your Sandbox Personal Buyer account (not your Business merchant account).');
        }
      }).render('#paypalButtonContainer');
    }
  };
  document.head.appendChild(script);
}

function getShippingFormData() {
  return {
    name: $('#shipName').value || 'Test Buyer',
    email: $('#shipEmail').value || 'buyer@example.com',
    address: $('#shipAddress').value || '402 Cyber Tech Residences',
    city: $('#shipCity').value || 'Bengaluru',
    state: $('#shipState').value || 'Karnataka',
    postal_code: $('#shipPostal').value || '560038',
    phone: $('#shipPhone').value || '+91 98765 43210'
  };
}

async function executeDemoTestOrder() {
  const shipping = getShippingFormData();
  const items = [...State.cart.values()].map(it => ({
    id: it.id,
    size: it.size,
    color: it.color,
    quantity: it.quantity
  }));

  try {
    // 1. Create order with server-calculated price verification
    const createRes = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, shipping_address: shipping })
    });
    const createData = await createRes.json();
    if (!createData.success) throw new Error(createData.error);

    const localOrderId = createData.order.id;

    // 2. Complete order via server demo test recorder
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
    : `<span style="color:var(--accent-cyan); font-weight:700; background:rgba(66,232,245,0.12); padding:3px 8px; border-radius:6px;">● ${order.status}</span>`;
  
  const txnLine = order.payment_id
    ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; word-break:break-all;">PayPal Capture ID: <code style="color:var(--accent-cyan); font-family:var(--font-mono);">${order.payment_id}</code></div>`
    : '';

  receiptCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span style="font-weight:800;">Purchased Items (${order.items.length}):</span>
      ${statusBadge}
    </div>
    ${order.items.map(it => `
      <div class="receipt-item-line">
        <span>${it.product_name} (${it.size} / ${it.color}) × ${it.quantity}</span>
        <strong>${inr(it.line_total)}</strong>
      </div>
    `).join('')}
    <div class="receipt-item-line" style="margin-top:8px;">
      <span>Delivery Fee</span>
      <span>${order.delivery_fee === 0 ? 'Free' : inr(order.delivery_fee)}</span>
    </div>
    <div class="receipt-item-line" style="font-weight:800; font-size:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
      <span>Total Paid</span>
      <span style="color:var(--accent-cyan);">${inr(order.total_amount)}</span>
    </div>
    ${txnLine}
    <div style="margin-top:12px; font-size:0.75rem; color:var(--text-muted);">
      Ship To: <strong>${order.customer_name}</strong><br>
      ${order.shipping_address}, ${order.city}, ${order.state} - ${order.postal_code}
    </div>
  `;

  const confModal = $('#confirmationModal');
  confModal.classList.add('open');
  confModal.setAttribute('aria-hidden', 'false');

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
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  // Search input live filtering with debounce
  let searchTimeout;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      State.filters.search = e.target.value;
      renderProductGrid();
    }, 120);
  });

  // Category filter chips
  $('#categoryChips').addEventListener('click', (e) => {
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
  priceRange.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    State.filters.maxPrice = val;
    priceRangeVal.textContent = inr(val);
    renderProductGrid();
  });

  // Sort dropdown
  $('#sortSelect').addEventListener('change', (e) => {
    State.filters.sort = e.target.value;
    renderProductGrid();
  });

  // Clear all filters
  $('#clearAllFiltersBtn').addEventListener('click', resetFilters);
  $('#resetFiltersTopBtn').addEventListener('click', resetFilters);

  // Product Grid interactions: Card click -> Modal, Button click -> Add/Compare
  $('#productGrid').addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-card-add');
    const compareBtn = e.target.closest('.btn-card-compare');
    const card = e.target.closest('.product-card');

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
  $('#heroQuickAddBtn').addEventListener('click', (e) => {
    const product = State.products.find(p => p.id === 'cyber-shell-black');
    if (product) {
      addToCart(product, 'M', 'Onyx & Electric Blue', 1, $('#heroJacketImg'));
    }
  });

  // Hero Try AI button
  $('#heroTryAiBtn').addEventListener('click', () => {
    $('#aiAssistant').scrollIntoView({ behavior: 'smooth' });
    $('#aiPromptInput').focus();
  });

  $('#headerAiBtn').addEventListener('click', () => {
    $('#aiAssistant').scrollIntoView({ behavior: 'smooth' });
    $('#aiPromptInput').focus();
  });

  // Modal interactions
  $('#modalCloseBtn').addEventListener('click', closeProductModal);
  $('#productModal').addEventListener('click', (e) => {
    if (e.target === $('#productModal')) closeProductModal();
  });

  $('#modalSwatches').addEventListener('click', (e) => {
    const btn = e.target.closest('.color-swatch-btn');
    if (!btn) return;
    $$('.color-swatch-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    State.selectedModalColor = btn.dataset.color;
  });

  $('#modalSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('.modal-size-btn');
    if (!btn || btn.disabled) return;
    $$('.modal-size-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    State.selectedModalSize = btn.dataset.size;
    updateModalStockDisplay();
  });

  $('#modalQtyMinus').addEventListener('click', () => {
    if (State.modalQty > 1) {
      State.modalQty--;
      $('#modalQtyVal').textContent = State.modalQty;
    }
  });

  $('#modalQtyPlus').addEventListener('click', () => {
    const product = State.activeModalProduct;
    const sizeData = product?.sizes?.find(s => s.size === State.selectedModalSize);
    const max = sizeData ? sizeData.stock : 10;
    if (State.modalQty < max) {
      State.modalQty++;
      $('#modalQtyVal').textContent = State.modalQty;
    }
  });

  $('#modalAddToCartBtn').addEventListener('click', () => {
    if (!State.activeModalProduct) return;
    addToCart(
      State.activeModalProduct,
      State.selectedModalSize,
      State.selectedModalColor,
      State.modalQty,
      $('#modalImg')
    );
    closeProductModal();
  });

  $('#modalCompareToggleBtn').addEventListener('click', () => {
    if (State.activeModalProduct) {
      toggleCompare(State.activeModalProduct.id);
    }
  });

  // Cart Pill & Drawer
  $('#cartPill').addEventListener('click', openCartDrawer);
  $('#headerCartBtn').addEventListener('click', openCartDrawer);
  $('#cartCloseBtn').addEventListener('click', closeCartDrawer);

  $('#cartItemsList').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const row = btn.closest('.cart-item-row');
    const key = row?.dataset.key;
    if (!key || !State.cart.has(key)) return;

    const item = State.cart.get(key);
    const op = btn.dataset.op;

    if (op === 'plus') {
      item.quantity++;
    } else if (op === 'minus') {
      item.quantity--;
      if (item.quantity <= 0) {
        State.cart.delete(key);
      }
    } else if (op === 'delete') {
      State.cart.delete(key);
    }

    saveCartToStorage();
    renderCartDrawer(false);
    updateCartPill();
  });

  $('#cartCheckoutBtn').addEventListener('click', openCheckoutModal);

  // Compare Sticky Bar & Modal
  $('#btnLaunchCompare').addEventListener('click', openCompareModal);
  $('#navCompareLink').addEventListener('click', (e) => {
    e.preventDefault();
    openCompareModal();
  });
  $('#compareModalCloseBtn').addEventListener('click', closeCompareModal);
  $('#compareModal').addEventListener('click', (e) => {
    if (e.target === $('#compareModal')) closeCompareModal();
  });

  $('#compareThumbsStrip').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.compare-thumb-remove');
    if (removeBtn) {
      toggleCompare(removeBtn.dataset.remove);
    }
  });

  $('#compareTable').addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-card-add');
    if (addBtn) {
      const id = addBtn.dataset.add;
      const product = State.products.find(p => p.id === id);
      if (product) addToCart(product);
    }
  });

  // AI Chat interactions
  $('#aiInputForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitAiPrompt($('#aiPromptInput').value);
  });

  // AI Prompt suggestion pills
  $$('.suggestion-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      submitAiPrompt(btn.dataset.prompt);
    });
  });

  // AI Chat card actions (Add to Cart / Specs)
  $('#aiChatBody').addEventListener('click', (e) => {
    const addBtn = e.target.closest('.ai-btn-add');
    const viewBtn = e.target.closest('.ai-btn-view');

    if (addBtn) {
      const id = addBtn.dataset.add;
      const product = State.products.find(p => p.id === id);
      if (product) {
        const card = addBtn.closest('.ai-rec-card');
        const img = card ? card.querySelector('img') : null;
        addToCart(product, null, null, 1, img);
        addBtn.textContent = 'Added ✓';
        setTimeout(() => addBtn.textContent = 'Add to Cart', 1400);
      }
    }

    if (viewBtn) {
      openProductModal(viewBtn.dataset.view);
    }
  });

  // Checkout modal
  $('#checkoutCloseBtn').addEventListener('click', closeCheckoutModal);
  $('#btnDemoCheckout').addEventListener('click', executeDemoTestOrder);
  $('#confDoneBtn').addEventListener('click', closeConfirmationModal);

  // Newsletter Form
  $('#newsletterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#newsletterEmail').value;
    alert(`Thank you! Demo subscription acknowledged for: ${email}\nNo personal data is stored externally.`);
    $('#newsletterEmail').value = '';
  });

  // Mobile Menu Drawer Toggle
  const mobileToggle = $('#mobileMenuToggle');
  const mobileDrawer = $('#mobileNavDrawer');
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileDrawer.setAttribute('aria-hidden', String(!isOpen));
    });

    $$('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        mobileDrawer.classList.remove('open');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        if (link.id === 'mobileNavCompareLink') {
          e.preventDefault();
          openCompareModal();
        }
      });
    });
  }

  // Escape key to close open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeCompareModal();
      closeCheckoutModal();
      closeConfirmationModal();
      closeCartDrawer();
    }
  });
}
