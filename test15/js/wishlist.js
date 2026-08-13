/* ==========================================================
   wishlist.js — Wishlist state, persistence, drawer rendering.
   Mirrors the cart.js patterns (localStorage-backed array,
   toast feedback) but stores plain product ids since wishlist
   items don't carry quantity/variant/color state.
   ========================================================== */

// ===== STATE =====
let wishlist = []; // array of product ids

// ===== PERSISTENCE =====
function saveWishlist() {
  localStorage.setItem('uplift_wishlist', JSON.stringify(wishlist));
}

function loadWishlist() {
  const saved = localStorage.getItem('uplift_wishlist');
  if (saved) {
    try {
      wishlist = JSON.parse(saved);
    } catch (e) {
      wishlist = [];
    }
  }
  if (!Array.isArray(wishlist)) wishlist = [];
}

function isInWishlist(productId) {
  return wishlist.includes(productId);
}

// ===== TOGGLE =====
// `fromModal` re-renders the product detail modal's heart button instead of
// re-running the full card grid render (avoids losing modal scroll state).
function toggleWishlist(productId, fromModal = false) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const idx = wishlist.indexOf(productId);
  if (idx > -1) {
    wishlist.splice(idx, 1);
    showToast(`${product.name} removed from wishlist`, 'info', 2200);
  } else {
    wishlist.push(productId);
    showToast(`${product.name} added to wishlist!`, 'success', 2200);
  }

  saveWishlist();
  updateWishlistUI();

  if (fromModal) {
    updateModalWishlistButton(productId);
  }
  // Re-sync every heart button already in the DOM (grid + search results)
  // without a full grid rebuild, which would restart card entrance animations.
  refreshWishlistButtonsInGrid();
}

// Syncs every heart button currently in the product grid with wishlist state
// (used after add/remove so all matching cards — e.g. same product shown
// twice via search — stay in sync).
function refreshWishlistButtonsInGrid() {
  document.querySelectorAll('#products-container .product-card').forEach(card => {
    const btn = card.querySelector('.wishlist-toggle-btn');
    if (!btn) return;
    const match = btn.getAttribute('aria-label').match(/wishlist$/);
    // Card DOM has no data-id, so pull id from the onclick handler instead.
    const onclickAttr = btn.getAttribute('onclick') || '';
    const idMatch = onclickAttr.match(/toggleWishlist\((\d+)\)/);
    if (!idMatch) return;
    const id = parseInt(idMatch[1], 10);
    const active = isInWishlist(id);
    const product = products.find(p => p.id === id);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
    if (product) {
      btn.setAttribute('aria-label', active ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`);
    }
    const icon = btn.querySelector('i');
    if (icon) icon.className = `${active ? 'fas' : 'far'} fa-heart`;
  });

  // Also refresh the mobile search results list, if open.
  document.querySelectorAll('#mobile-search-results .wishlist-toggle-btn').forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick') || '';
    const idMatch = onclickAttr.match(/toggleWishlist\((\d+)\)/);
    if (!idMatch) return;
    const id = parseInt(idMatch[1], 10);
    const active = isInWishlist(id);
    btn.classList.toggle('active', active);
    const icon = btn.querySelector('i');
    if (icon) icon.className = `${active ? 'fas' : 'far'} fa-heart`;
  });
}

function updateModalWishlistButton(productId) {
  const btn = document.getElementById('pm-wishlist-btn');
  if (!btn) return;
  const active = isInWishlist(productId);
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', active);
  btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
  const icon = btn.querySelector('i');
  if (icon) icon.className = `${active ? 'fas' : 'far'} fa-heart`;
}

// ===== MOVE TO CART =====
function moveWishlistItemToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (product.variants) {
    // Variant products need an option picked, so send the shopper to the
    // product modal instead of guessing which option to add.
    toggleWishlistDrawer();
    openProductModal(productId);
    return;
  }

  addToCart(productId);
  const idx = wishlist.indexOf(productId);
  if (idx > -1) {
    wishlist.splice(idx, 1);
    saveWishlist();
    updateWishlistUI();
    refreshWishlistButtonsInGrid();
  }
}

// ===== DRAWER =====
function toggleWishlistDrawer() {
  const drawer = document.getElementById('wishlist-drawer');
  const isOpening = !drawer.classList.contains('open');
  drawer.classList.toggle('open');
  document.getElementById('wishlist-overlay').classList.toggle('show');
  setBottomNavActive(isOpening ? 'wishlist' : null);

  if (isOpening) {
    lastFocusedElement = document.activeElement;
    const closeBtn = drawer.querySelector('.close-cart');
    if (closeBtn) closeBtn.focus();
  } else if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// ===== RENDER =====
function updateWishlistUI() {
  const container = document.getElementById('wishlist-items');
  const countBadges = [
    document.getElementById('wishlist-count-desktop'),
    document.getElementById('bnav-wishlist-badge')
  ];

  const count = wishlist.length;
  countBadges.forEach(el => {
    if (!el) return;
    el.textContent = count;
    el.hidden = count === 0;
  });

  const wishlistIconContainer = document.getElementById('wishlist-icon-container');
  if (wishlistIconContainer) {
    wishlistIconContainer.setAttribute('aria-label', `Open wishlist, ${count} item${count !== 1 ? 's' : ''}`);
  }

  if (!container) return;
  container.innerHTML = '';

  if (wishlist.length === 0) {
    container.innerHTML = `
    <div class="cart-empty">
      <i class="far fa-heart" aria-hidden="true"></i>
      <p>Your wishlist is empty.<br>Tap the heart on any product to save it here.</p>
    </div>`;
    return;
  }

  wishlist.forEach(productId => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const hasVariants = !!product.variants;
    const onSale = !hasVariants && isDiscountActive(product);
    const discount = onSale ? getDiscount(product) : null;

    const priceHTML = hasVariants
      ? `<div class="cart-item-price">From ${getVariantPriceRange(product).min.toLocaleString()} tk</div>`
      : onSale
        ? `<div class="cart-item-price">
             <span class="cart-item-price-original">${product.price.toLocaleString()} tk</span>
             <span class="cart-item-price-sale">${discount.salePrice.toLocaleString()} tk</span>
           </div>`
        : `<div class="cart-item-price">${product.price.toLocaleString()} tk</div>`;

    const stockInfo = getStockInfo({ stock: hasVariants ? getVariantTotalStock(product) : product.stock });

    const itemRow = document.createElement('div');
    itemRow.classList.add('cart-item', 'wishlist-item');
    itemRow.innerHTML = `
      <img src="${product.img}" alt="${product.name}" class="cart-item-img"
      onclick="toggleWishlistDrawer();openProductModal(${product.id})" style="cursor:pointer"
      onerror="this.src='https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400'">
      <div class="cart-item-details">
        <h4 onclick="toggleWishlistDrawer();openProductModal(${product.id})" style="cursor:pointer">${product.name}</h4>
        ${priceHTML}
        ${!stockInfo.available ? '<div class="cart-item-stock-note">Out of stock</div>' : ''}
        <button class="wishlist-move-to-cart-btn" onclick="moveWishlistItemToCart(${product.id})" ${!stockInfo.available ? 'disabled' : ''}>
          <i class="fas fa-cart-plus" aria-hidden="true"></i> ${hasVariants ? 'Select Options' : 'Move to Bag'}
        </button>
      </div>
      <button class="remove-item" onclick="toggleWishlist(${product.id})" aria-label="Remove ${product.name} from wishlist">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    `;
    container.appendChild(itemRow);
  });
}
