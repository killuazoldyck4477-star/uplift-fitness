/* ==========================================================
   ui.js — Interactive chrome that isn't cart or catalog logic:
   the product detail modal, cart drawer, checkout modal,
   mobile nav menu, global Escape handling, and the newsletter form.
   ========================================================== */

let activeModalProductId = null;
let modalQty = 1;
let selectedModalColor = null;
let selectedModalSize = null;
let selectedModalVariant = null;
let lastFocusedElement = null;

// ===== MOBILE MENU =====
function toggleMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const isOpen = toggle.classList.toggle('active');
  document.getElementById('nav-menu').classList.toggle('open');
  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeMobileMenu() {
  document.getElementById('mobile-menu-toggle').classList.remove('active');
  document.getElementById('mobile-menu-toggle').setAttribute('aria-expanded', 'false');
  document.getElementById('nav-menu').classList.remove('open');
}

// ===== CART DRAWER =====
function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const isOpening = !drawer.classList.contains('open');
  drawer.classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('show');
  setBottomNavActive(isOpening ? 'cart' : null);

  if (isOpening) {
    lastFocusedElement = document.activeElement;
    const closeBtn = drawer.querySelector('.close-cart');
    if (closeBtn) closeBtn.focus();
  } else if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// ===== CHECKOUT MODAL =====
function toggleCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  const isOpening = !modal.classList.contains('show');
  modal.classList.toggle('show');

  if (isOpening) {
    lastFocusedElement = document.activeElement;
    const closeBtn = modal.querySelector('.close-checkout');
    if (closeBtn) closeBtn.focus();
  } else if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// ===== PRODUCT DETAIL MODAL =====
function openProductModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  activeModalProductId = productId;
  selectedModalColor = product.colors && product.colors.length ? product.colors[0].name : null;
  selectedModalSize = product.sizes && product.sizes.length ? product.sizes[0] : null;
  selectedModalVariant = product.variants ? product.variants.options[0].name : null;

  const effStock = getEffectiveStock(product, selectedModalVariant);
  const stockInfo = getStockInfo({ stock: effStock });
  const alreadyInCart = getQuantityInCart(productId, selectedModalVariant);
  const remainingCanAdd = Math.max(effStock - alreadyInCart, 0);

  modalQty = remainingCanAdd > 0 ? 1 : 0;

  const images = (product.images && product.images.length) ? product.images : [product.img];
  renderModalGallery(images, product.name);

  const categoryLabels = {
    supports: 'Supports & Gear',
    weights: 'Strength & Weights',
    'cardio-core': 'Cardio & Core',
    recovery: 'Recovery & Martial Arts'
  };
  document.getElementById('pm-category').textContent = categoryLabels[product.category] || product.category;
  document.getElementById('pm-title').textContent = product.name;
  renderModalPrice(product, selectedModalVariant);
  document.getElementById('pm-description').textContent = product.description || '';

  const badgeEl = document.getElementById('pm-badge');
  if (product.badge) {
    badgeEl.textContent = product.badge === 'bestseller' ? 'Bestseller' : 'New';
    badgeEl.className = `pm-badge ${product.badge}`;
    badgeEl.style.display = 'inline-block';
  } else {
    badgeEl.style.display = 'none';
  }

  const weightValueEl = document.getElementById('pm-weight-value');
  if (weightValueEl) {
    const effWeight = getEffectiveWeight(product, selectedModalVariant);
    weightValueEl.textContent = typeof effWeight === 'number' ? formatWeight(effWeight) : '—';
  }

  renderModalRating(product);
  renderModalColors(product);
  renderModalSizes(product);
  renderModalVariants(product);
  renderModalFeatures(product);
  renderModalSpecs(product);
  renderModalStockStatus(product, alreadyInCart, remainingCanAdd, stockInfo);
  renderModalQty(remainingCanAdd);
  renderModalAddButton(stockInfo, remainingCanAdd);
  updateModalWishlistButton(productId);

  lastFocusedElement = document.activeElement;
  document.getElementById('product-modal').classList.add('show');
  document.getElementById('product-modal-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';

  document.querySelector('.close-product-modal').focus();
}

function renderModalGallery(images, productName) {
  const grid = document.getElementById('pm-gallery-grid');
  grid.innerHTML = '';

  images.forEach((imgSrc, i) => {
    const tile = document.createElement('div');
    tile.className = 'pm-gallery-item' + (i < 2 ? ' large' : ' small');
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `View image ${i + 1} of ${images.length} full size`);

    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = `${productName}, view ${i + 1} of ${images.length}`;
    img.loading = 'lazy';
    img.onerror = function () {
      this.src = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400';
    };

    const openThis = () => openLightbox(images, i, productName);
    tile.onclick = openThis;
    tile.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThis(); } };

    tile.appendChild(img);
    grid.appendChild(tile);
  });
}

// ===== IMAGE LIGHTBOX =====
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxProductName = '';

function openLightbox(images, index, productName) {
  lightboxImages = images;
  lightboxIndex = index;
  lightboxProductName = productName;
  updateLightboxImage();
  document.getElementById('pm-lightbox').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function updateLightboxImage() {
  const img = document.getElementById('pm-lightbox-img');
  img.src = lightboxImages[lightboxIndex];
  img.alt = `${lightboxProductName}, view ${lightboxIndex + 1} of ${lightboxImages.length}`;
  img.onerror = function () {
    this.src = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800';
  };
  document.getElementById('pm-lightbox-counter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  const multi = lightboxImages.length > 1;
  document.querySelector('.pm-lightbox-prev').style.display = multi ? 'flex' : 'none';
  document.querySelector('.pm-lightbox-next').style.display = multi ? 'flex' : 'none';
}

function lightboxNav(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  updateLightboxImage();
}

function closeLightbox() {
  document.getElementById('pm-lightbox').classList.remove('show');
  const productModalOpen = document.getElementById('product-modal').classList.contains('show');
  document.body.style.overflow = productModalOpen ? 'hidden' : '';
}

document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('pm-lightbox');
  if (!lb || !lb.classList.contains('show')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') lightboxNav(1);
  if (e.key === 'ArrowLeft') lightboxNav(-1);
});

function renderModalPrice(product, variantName = null) {
  const originalEl = document.getElementById('pm-price-original');
  const priceEl = document.getElementById('pm-price');
  const badgeEl = document.getElementById('pm-discount-badge');
  const countdownRow = document.getElementById('pm-countdown-row');
  const countdownText = document.getElementById('pm-countdown-text');

  if (product.variants) {
    originalEl.style.display = 'none';
    priceEl.textContent = `${getEffectivePrice(product, variantName).toLocaleString()} tk`;
    priceEl.classList.remove('pm-price-on-sale');
    badgeEl.style.display = 'none';
    countdownRow.style.display = 'none';
    return;
  }

  const onSale = isDiscountActive(product);
  const discount = onSale ? getDiscount(product) : null;

  if (onSale) {
    originalEl.textContent = `${product.price.toLocaleString()} tk`;
    originalEl.style.display = 'inline';
    priceEl.textContent = `${discount.salePrice.toLocaleString()} tk`;
    priceEl.classList.add('pm-price-on-sale');
    badgeEl.textContent = `-${getDiscountPercent(product)}%`;
    badgeEl.style.display = 'inline-block';

    if (discount.endsAt) {
      countdownRow.style.display = 'flex';
      countdownText.dataset.ends = discount.endsAt;
      countdownText.textContent = formatCountdown(getCountdownParts(discount.endsAt));
    } else {
      countdownRow.style.display = 'none';
    }
  } else {
    originalEl.style.display = 'none';
    priceEl.textContent = `${product.price.toLocaleString()} tk`;
    priceEl.classList.remove('pm-price-on-sale');
    badgeEl.style.display = 'none';
    countdownRow.style.display = 'none';
  }
}

function renderModalRating(product) {
  const row = document.getElementById('pm-rating-row');
  if (!product.rating) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'flex';

  const starsEl = document.getElementById('pm-stars');
  const full = Math.floor(product.rating);
  const hasHalf = product.rating - full >= 0.25 && product.rating - full < 0.75;
  const roundedFull = product.rating - full >= 0.75 ? full + 1 : full;
  let starsHTML = '';
  for (let i = 0; i < roundedFull; i++) starsHTML += '<i class="fas fa-star" aria-hidden="true"></i>';
  if (hasHalf) starsHTML += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
  for (let i = starsHTML.match(/<i/g)?.length || 0; i < 5; i++) starsHTML += '<i class="far fa-star" aria-hidden="true"></i>';
  starsEl.innerHTML = starsHTML;
  starsEl.setAttribute('aria-label', `Rated ${product.rating.toFixed(1)} out of 5 stars`);

  document.getElementById('pm-rating-number').textContent = product.rating.toFixed(1);
  document.getElementById('pm-review-count').textContent = product.reviewCount
    ? `(${product.reviewCount.toLocaleString()} Reviews)`
    : '';
}

function renderModalColors(product) {
  const row = document.getElementById('pm-color-row');
  if (!product.colors || !product.colors.length) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'block';

  document.getElementById('pm-color-selected').textContent = selectedModalColor;

  const swatchContainer = document.getElementById('pm-color-swatches');
  swatchContainer.innerHTML = '';
  product.colors.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'pm-swatch' + (color.name === selectedModalColor ? ' active' : '');
    swatch.style.background = color.hex;
    swatch.setAttribute('aria-label', `Select color: ${color.name}`);
    swatch.setAttribute('aria-pressed', color.name === selectedModalColor ? 'true' : 'false');
    swatch.title = color.name;
    swatch.onclick = () => {
      selectedModalColor = color.name;
      document.getElementById('pm-color-selected').textContent = color.name;
      swatchContainer.querySelectorAll('.pm-swatch').forEach(s => {
        s.classList.remove('active');
        s.setAttribute('aria-pressed', 'false');
      });
      swatch.classList.add('active');
      swatch.setAttribute('aria-pressed', 'true');
    };
    swatchContainer.appendChild(swatch);
  });
}

function renderModalSizes(product) {
  const row = document.getElementById('pm-size-row');
  if (!product.sizes || !product.sizes.length) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'block';

  document.getElementById('pm-size-selected').textContent = selectedModalSize;

  const optionsContainer = document.getElementById('pm-size-options');
  optionsContainer.innerHTML = '';
  product.sizes.forEach(size => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pm-size-btn' + (size === selectedModalSize ? ' active' : '');
    btn.textContent = size;
    btn.setAttribute('aria-label', `Select size: ${size}`);
    btn.setAttribute('aria-pressed', size === selectedModalSize ? 'true' : 'false');
    btn.onclick = () => {
      selectedModalSize = size;
      document.getElementById('pm-size-selected').textContent = size;
      optionsContainer.querySelectorAll('.pm-size-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    };
    optionsContainer.appendChild(btn);
  });
}

function renderModalVariants(product) {
  const row = document.getElementById('pm-variant-row');
  if (!product.variants || !product.variants.options.length) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'block';

  document.getElementById('pm-variant-label-text').textContent = product.variants.label || 'Option';
  document.getElementById('pm-variant-selected').textContent = selectedModalVariant;

  const optionsContainer = document.getElementById('pm-variant-options');
  optionsContainer.innerHTML = '';
  product.variants.options.forEach(opt => {
    const optStockInfo = getStockInfo({ stock: opt.stock });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pm-size-btn' + (opt.name === selectedModalVariant ? ' active' : '');
    btn.textContent = opt.name;
    btn.disabled = !optStockInfo.available;
    if (!optStockInfo.available) btn.title = 'Out of stock';
    btn.setAttribute('aria-label', `Select ${product.variants.label || 'option'}: ${opt.name}${!optStockInfo.available ? ' (out of stock)' : ''}`);
    btn.setAttribute('aria-pressed', opt.name === selectedModalVariant ? 'true' : 'false');
    btn.onclick = () => {
      selectedModalVariant = opt.name;
      refreshModalForVariant(product);
    };
    optionsContainer.appendChild(btn);
  });
}

// Re-renders every part of the modal that depends on the selected variant
// (price, weight, stock status, quantity controls, add/buy buttons) without
// rebuilding the gallery/description/etc. Called whenever the shopper taps
// a different resistance/size option.
function refreshModalForVariant(product) {
  const effStock = getEffectiveStock(product, selectedModalVariant);
  const stockInfo = getStockInfo({ stock: effStock });
  const alreadyInCart = getQuantityInCart(product.id, selectedModalVariant);
  const remainingCanAdd = Math.max(effStock - alreadyInCart, 0);

  modalQty = remainingCanAdd > 0 ? 1 : 0;

  renderModalPrice(product, selectedModalVariant);

  const weightValueEl = document.getElementById('pm-weight-value');
  if (weightValueEl) {
    weightValueEl.textContent = formatWeight(getEffectiveWeight(product, selectedModalVariant));
  }

  renderModalVariants(product);
  renderModalStockStatus(product, alreadyInCart, remainingCanAdd, stockInfo);
  renderModalQty(remainingCanAdd);
  renderModalAddButton(stockInfo, remainingCanAdd);
}

function renderModalFeatures(product) {
  const block = document.getElementById('pm-features-block');
  if (!product.features || !product.features.length) {
    block.style.display = 'none';
    return;
  }
  block.style.display = 'block';

  const grid = document.getElementById('pm-features-grid');
  grid.innerHTML = product.features.map(f => `
    <div class="pm-feature-item">
      <i class="fas ${f.icon}" aria-hidden="true"></i>
      <span>${f.label}</span>
    </div>
  `).join('');
}

function renderModalSpecs(product) {
  const col = document.getElementById('pm-specs-col');
  if (!product.specs || Object.keys(product.specs).length === 0) {
    col.style.display = 'none';
    return;
  }
  col.style.display = 'block';

  const list = document.getElementById('pm-specs-list');
  list.innerHTML = Object.entries(product.specs).map(([key, value]) => `
    <dt>${key}</dt>
    <dd>${value}</dd>
  `).join('');
}

function renderModalStockStatus(product, alreadyInCart, remainingCanAdd, stockInfo = null) {
  const el = document.getElementById('pm-stock-status');
  if (!stockInfo) stockInfo = getStockInfo(product);
  const stockCount = product.variants ? getEffectiveStock(product, selectedModalVariant) : product.stock;

  if (!stockInfo.available) {
    el.innerHTML = `<i class="fas fa-circle-xmark" aria-hidden="true"></i> Out of Stock`;
    el.className = 'pm-stock-status out-of-stock';
  } else if (stockInfo.className === 'low-stock') {
    el.innerHTML = `<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Only ${stockCount} left in stock${alreadyInCart ? ` — ${alreadyInCart} already in your bag` : ''}`;
    el.className = 'pm-stock-status low-stock';
  } else {
    el.innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i> In Stock${alreadyInCart ? ` — ${alreadyInCart} already in your bag` : ''}`;
    el.className = 'pm-stock-status in-stock';
  }
}

function renderModalQty(remainingCanAdd) {
  document.getElementById('pm-qty-display').textContent = modalQty;
  const controls = document.querySelector('.pm-quantity-controls');
  if (remainingCanAdd <= 0) {
    controls.style.opacity = '0.4';
    controls.style.pointerEvents = 'none';
  } else {
    controls.style.opacity = '1';
    controls.style.pointerEvents = 'auto';
  }
}

function renderModalAddButton(stockInfo, remainingCanAdd) {
  const btn = document.getElementById('pm-add-btn');
  const buyBtn = document.getElementById('pm-buy-btn');

  if (!stockInfo.available) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-ban" aria-hidden="true"></i> Out of Stock`;
    buyBtn.disabled = true;
  } else if (remainingCanAdd <= 0) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-check" aria-hidden="true"></i> Max Quantity in Bag`;
    buyBtn.disabled = false;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-plus" aria-hidden="true"></i> Add to Bag`;
    buyBtn.disabled = false;
  }
}

function changeModalQty(delta) {
  const product = products.find(p => p.id === activeModalProductId);
  if (!product) return;

  const effStock = getEffectiveStock(product, selectedModalVariant);
  const alreadyInCart = getQuantityInCart(product.id, selectedModalVariant);
  const remainingCanAdd = Math.max(effStock - alreadyInCart, 0);

  modalQty = Math.min(Math.max(modalQty + delta, 1), Math.max(remainingCanAdd, 1));
  document.getElementById('pm-qty-display').textContent = modalQty;
}

function addToCartFromModal() {
  const product = products.find(p => p.id === activeModalProductId);
  if (!product) return;

  const effStock = getEffectiveStock(product, selectedModalVariant);
  const alreadyInCart = getQuantityInCart(product.id, selectedModalVariant);
  const remainingCanAdd = Math.max(effStock - alreadyInCart, 0);

  if (remainingCanAdd <= 0) {
    showToast(`No more ${product.name} available.`, 'error');
    return;
  }

  const qtyToAdd = Math.min(modalQty, remainingCanAdd);
  addToCart(product.id, qtyToAdd, selectedModalColor, selectedModalSize, selectedModalVariant);
  closeProductModal();
}

function buyNowFromModal() {
  const product = products.find(p => p.id === activeModalProductId);
  if (!product) return;

  const effStock = getEffectiveStock(product, selectedModalVariant);
  const alreadyInCart = getQuantityInCart(product.id, selectedModalVariant);
  const remainingCanAdd = Math.max(effStock - alreadyInCart, 0);

  if (alreadyInCart === 0) {
    if (remainingCanAdd <= 0) {
      showToast(`${product.name} is out of stock.`, 'error');
      return;
    }
    const qtyToAdd = Math.min(modalQty, remainingCanAdd);
    addToCart(product.id, qtyToAdd, selectedModalColor, selectedModalSize, selectedModalVariant);
  }

  closeProductModal();

  if (cart.length === 0) {
    showToast('Your bag is empty! Add some gear first.', 'error');
    return;
  }

  toggleCheckoutModal();
  updateCheckoutSummary();
  loadSavedInformation();
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('show');
  document.getElementById('product-modal-overlay').classList.remove('show');
  document.body.style.overflow = '';
  activeModalProductId = null;
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// ===== GLOBAL ESCAPE KEY HANDLING =====
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (document.getElementById('product-modal').classList.contains('show')) {
    closeProductModal();
    return;
  }
  if (document.getElementById('checkout-modal').classList.contains('show')) {
    toggleCheckoutModal();
    return;
  }
  if (document.getElementById('cart-drawer').classList.contains('open')) {
    toggleCart();
    return;
  }
  if (document.getElementById('wishlist-drawer').classList.contains('open')) {
    toggleWishlistDrawer();
    return;
  }
  if (document.getElementById('account-panel').classList.contains('open')) {
    toggleAccountPanel();
    return;
  }
  if (document.getElementById('mobile-search-overlay').classList.contains('show')) {
    closeMobileSearch();
    return;
  }
  if (document.getElementById('nav-menu').classList.contains('open')) {
    closeMobileMenu();
  }
});

// ===== NEWSLETTER SUBSCRIBE =====
function subscribeNewsletter(event) {
  event.preventDefault();
  const email = event.target.querySelector('input').value;
  showToast(`Subscribed! We'll send updates to ${email}`, 'success');
  event.target.reset();
}

/* ==========================================================
   STICKY MOBILE BOTTOM NAVIGATION
   Home / Search / Cart / Wishlist / Account. Since this is a
   single-page storefront (no real routing), "active" reflects
   whichever panel is currently open — Home whenever nothing
   else is open — rather than a URL-based route.
   ========================================================== */
function setBottomNavActive(key) {
  const items = {
    home: document.getElementById('bnav-home'),
    search: document.getElementById('bnav-search'),
    cart: document.getElementById('bnav-cart'),
    wishlist: document.getElementById('bnav-wishlist'),
    account: document.getElementById('bnav-account')
  };
  const resolved = key || 'home';
  Object.entries(items).forEach(([itemKey, el]) => {
    if (!el) return;
    const isActive = itemKey === resolved;
    el.classList.toggle('active', isActive);
    if (isActive) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

function bottomNavGoHome() {
  // Close whatever panel/drawer/overlay might currently be open, then
  // scroll to the very top of the page.
  if (document.getElementById('cart-drawer').classList.contains('open')) toggleCart();
  if (document.getElementById('wishlist-drawer').classList.contains('open')) toggleWishlistDrawer();
  if (document.getElementById('account-panel').classList.contains('open')) toggleAccountPanel();
  if (document.getElementById('mobile-search-overlay').classList.contains('show')) closeMobileSearch();
  closeMobileMenu();

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setBottomNavActive('home');
}

function bottomNavToggleCart() {
  if (document.getElementById('wishlist-drawer').classList.contains('open')) toggleWishlistDrawer();
  if (document.getElementById('account-panel').classList.contains('open')) toggleAccountPanel();
  toggleCart();
}

function bottomNavToggleWishlist() {
  if (document.getElementById('cart-drawer').classList.contains('open')) toggleCart();
  if (document.getElementById('account-panel').classList.contains('open')) toggleAccountPanel();
  toggleWishlistDrawer();
}

function bottomNavToggleAccount() {
  if (document.getElementById('cart-drawer').classList.contains('open')) toggleCart();
  if (document.getElementById('wishlist-drawer').classList.contains('open')) toggleWishlistDrawer();
  toggleAccountPanel();
}

// ===== ACCOUNT PANEL =====
function toggleAccountPanel() {
  const panel = document.getElementById('account-panel');
  const isOpening = !panel.classList.contains('open');
  panel.classList.toggle('open');
  document.getElementById('account-overlay').classList.toggle('show');
  setBottomNavActive(isOpening ? 'account' : null);

  if (isOpening) {
    lastFocusedElement = document.activeElement;
    const closeBtn = panel.querySelector('.close-cart');
    if (closeBtn) closeBtn.focus();
  } else if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// ===== MOBILE SEARCH OVERLAY =====
function openMobileSearch() {
  const overlay = document.getElementById('mobile-search-overlay');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  setBottomNavActive('search');

  const input = document.getElementById('mobile-search-input');
  input.value = currentSearch || '';
  renderMobileSearchResults(input.value);

  lastFocusedElement = document.activeElement;
  setTimeout(() => input.focus(), 60);
}

function closeMobileSearch() {
  const overlay = document.getElementById('mobile-search-overlay');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
  setBottomNavActive('home');
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

function handleMobileSearch(query) {
  // Keep it in sync with the desktop header search + sidebar filters so
  // whichever the shopper used last "wins" once the overlay closes.
  handleSearch(query);
  const desktopInput = document.getElementById('search-input');
  if (desktopInput) desktopInput.value = query;
  renderMobileSearchResults(query);
}

function renderMobileSearchResults(query) {
  const resultsContainer = document.getElementById('mobile-search-results');
  if (!resultsContainer) return;

  const q = (query || '').toLowerCase().trim();

  if (!q) {
    resultsContainer.innerHTML = `
    <div class="mobile-search-empty">
      <i class="fas fa-dumbbell" aria-hidden="true"></i>
      <p>Search knee supports, dumbbells, kettlebells, massage guns & more.</p>
    </div>`;
    return;
  }

  const matches = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    resultsContainer.innerHTML = `
    <div class="mobile-search-empty">
      <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
      <p>No products found for "${escapeHTML(query)}".</p>
    </div>`;
    return;
  }

  resultsContainer.innerHTML = matches.map(product => {
    const hasVariants = !!product.variants;
    const onSale = !hasVariants && isDiscountActive(product);
    const discount = onSale ? getDiscount(product) : null;
    const priceText = hasVariants
      ? `From ${getVariantPriceRange(product).min.toLocaleString()} tk`
      : onSale
        ? `${discount.salePrice.toLocaleString()} tk`
        : `${product.price.toLocaleString()} tk`;
    const active = isInWishlist(product.id);

    return `
    <div class="mobile-search-result-item">
      <img src="${product.img}" alt="${product.name}" loading="lazy"
        onclick="closeMobileSearch();openProductModal(${product.id})"
        onerror="this.src='https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400'">
      <div class="mobile-search-result-info" onclick="closeMobileSearch();openProductModal(${product.id})">
        <span class="mobile-search-result-name">${product.name}</span>
        <span class="mobile-search-result-price">${priceText}</span>
      </div>
      <button type="button" class="wishlist-toggle-btn mobile-search-result-wishlist ${active ? 'active' : ''}" onclick="event.stopPropagation();toggleWishlist(${product.id})" aria-label="${active ? 'Remove from' : 'Add to'} wishlist">
        <i class="${active ? 'fas' : 'far'} fa-heart" aria-hidden="true"></i>
      </button>
    </div>`;
  }).join('');
}
