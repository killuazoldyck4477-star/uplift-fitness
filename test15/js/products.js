/* ==========================================================
   products.js — Product catalog data + rendering + filtering.
   Product data now lives in data/products.json and is fetched
   once at startup by loadProductData(). Everything else that
   reads `products` / `DISCOUNTS` / `LOW_STOCK_THRESHOLD` (cart.js,
   ui.js, utils.js) just waits for that promise to resolve first.
   ========================================================== */

// ===== CATALOG STATE (populated by loadProductData) =====
let products = [];
let DISCOUNTS = {};
let LOW_STOCK_THRESHOLD = 5;

// ===== FILTER / SEARCH STATE =====
// currentCategories: empty Set = "All Categories" (no category filter applied)
let currentCategories = new Set();
let currentSearch = '';
let saleOnlyFilter = false;
let priceMin = null;
let priceMax = null;
let priceBoundsMin = 0;
let priceBoundsMax = 5000;

// Fetches data/products.json and populates the catalog state above.
// Must be awaited before displayProducts()/loadCart() run.
async function loadProductData() {
  try {
    const response = await fetch('data/products.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    products = data.products || [];
    DISCOUNTS = data.discounts || {};
    LOW_STOCK_THRESHOLD = typeof data.lowStockThreshold === 'number' ? data.lowStockThreshold : 5;

    initPriceFilter();
  } catch (err) {
    console.error('Failed to load product data:', err);
    showToast('Could not load products. Please refresh the page.', 'error', 6000);
  }
}

// ===== RENDER PRODUCTS =====
function displayProducts(filteredList = products) {
  const container = document.getElementById('products-container');
  const countEl = document.getElementById('products-count');
  container.innerHTML = '';

  updateSaleFilterVisibility();

  if (filteredList.length === 0) {
    container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
      <i class="fas fa-magnifying-glass" aria-hidden="true" style="font-size: 2.5rem; color: var(--text-muted); opacity: 0.4; margin-bottom: 15px; display: block;"></i>
      <p style="color: var(--text-muted); font-size: 1.1rem;">No products found. Try a different search or category.</p>
    </div>`;
    countEl.textContent = '0 products';
    return;
  }

  countEl.textContent = `${filteredList.length} product${filteredList.length !== 1 ? 's' : ''}`;

  filteredList.forEach((product, index) => {
    const card = document.createElement('div');
    card.classList.add('product-card');
    card.style.animationDelay = `${index * 0.05}s`;

    const badgeHTML = product.badge
      ? `<span class="product-badge ${product.badge}">${product.badge === 'bestseller' ? 'Bestseller' : 'New'}</span>`
      : '';

    const hasVariants = !!product.variants;

    const stockInfo = hasVariants
      ? getStockInfo({ stock: getVariantTotalStock(product) })
      : getStockInfo(product);
    const stockBadgeHTML = !stockInfo.available
      ? `<span class="stock-tag ${stockInfo.className}">${stockInfo.label}</span>`
      : (stockInfo.className === 'low-stock'
          ? `<span class="stock-tag ${stockInfo.className}">${stockInfo.label}</span>`
          : '');

    const cardDisabledClass = !stockInfo.available ? 'product-card-disabled' : '';

    // Variant products (e.g. Power Twister) have their own price/weight per
    // option rather than a single discount-eligible price, so they skip the
    // sale-ribbon logic below and show a price range instead.
    const onSale = !hasVariants && isDiscountActive(product);
    const discount = onSale ? getDiscount(product) : null;
    const discountRibbonHTML = onSale
      ? `<span class="discount-ribbon">-${getDiscountPercent(product)}%</span>`
      : '';

    let priceHTML;
    if (hasVariants) {
      const range = getVariantPriceRange(product);
      priceHTML = `<div class="product-price">From ${range.min.toLocaleString()} tk</div>`;
    } else if (onSale) {
      priceHTML = `<div class="product-price">
           <span class="product-price-original"><span class="sr-only">Original price: </span>${product.price.toLocaleString()} tk</span>
           <span class="product-price-sale"><span class="sr-only">Sale price: </span>${discount.salePrice.toLocaleString()} tk</span>
         </div>`;
    } else {
      priceHTML = `<div class="product-price">${product.price.toLocaleString()} tk</div>`;
    }

    const countdownHTML = (onSale && discount.endsAt)
      ? `<div class="deal-countdown"><i class="fas fa-clock" aria-hidden="true"></i> <span data-ends="${discount.endsAt}">${formatCountdown(getCountdownParts(discount.endsAt))}</span></div>`
      : '';

    const weightLineHTML = hasVariants
      ? (() => {
          const r = getVariantWeightRange(product);
          return `<div class="pm-product-card-weight"><i class="fas fa-weight-hanging" aria-hidden="true"></i> Approx. ${formatWeight(r.min)} – ${formatWeight(r.max)}</div>`;
        })()
      : (typeof product.weight === 'number' ? `<div class="pm-product-card-weight"><i class="fas fa-weight-hanging" aria-hidden="true"></i> Approx. ${formatWeight(product.weight)}</div>` : '');

    const addButtonHTML = hasVariants
      ? `<button class="btn-add-cart" onclick="openProductModal(${product.id})" ${!stockInfo.available ? 'disabled' : ''} aria-label="${stockInfo.available ? 'Select options for ' + product.name : product.name + ' is out of stock'}">
          <i class="fas fa-${stockInfo.available ? 'sliders-h' : 'ban'}" aria-hidden="true"></i> ${stockInfo.available ? 'Select Options' : 'Out of Stock'}
        </button>`
      : `<button class="btn-add-cart" onclick="addToCart(${product.id})" ${!stockInfo.available ? 'disabled' : ''} aria-label="${stockInfo.available ? 'Add ' + product.name + ' to bag' : product.name + ' is out of stock'}">
          <i class="fas fa-${stockInfo.available ? 'plus' : 'ban'}" aria-hidden="true"></i> ${stockInfo.available ? 'Add to Bag' : 'Out of Stock'}
        </button>`;

    const inWishlist = typeof isInWishlist === 'function' && isInWishlist(product.id);

    card.innerHTML = `
      ${badgeHTML}
      ${discountRibbonHTML}
      <button type="button" class="wishlist-toggle-btn ${inWishlist ? 'active' : ''}" onclick="event.stopPropagation();toggleWishlist(${product.id})" aria-pressed="${inWishlist}" aria-label="${inWishlist ? 'Remove ' + product.name + ' from wishlist' : 'Add ' + product.name + ' to wishlist'}">
        <i class="${inWishlist ? 'fas' : 'far'} fa-heart" aria-hidden="true"></i>
      </button>
      <div class="product-image-container ${cardDisabledClass}" onclick="openProductModal(${product.id})" role="button" tabindex="0" aria-label="View ${product.name} details" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProductModal(${product.id})}">
        <img src="${product.img}" alt="${product.name}" class="product-img" width="260" height="220"
        loading="${index < 4 ? 'eager' : 'lazy'}" fetchpriority="${index < 4 ? 'high' : 'auto'}" decoding="async"
        onerror="this.src='https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400'">
        ${!stockInfo.available ? '<div class="out-of-stock-overlay">Out of Stock</div>' : ''}
      </div>
      <div class="product-info">
        <h3 class="product-title" onclick="openProductModal(${product.id})" tabindex="0" role="button" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProductModal(${product.id})}">${product.name}</h3>
        <div class="product-meta-row">
          ${priceHTML}
          ${stockBadgeHTML}
        </div>
        ${weightLineHTML}
        ${countdownHTML}
        ${addButtonHTML}
      </div>
    `;
    container.appendChild(card);
  });
}

// ===== SEARCH =====
function handleSearch(query) {
  currentSearch = query.toLowerCase().trim();
  applyFilters();
}

// ===== COMBINED FILTER + SEARCH =====
function applyFilters() {
  let filtered = products;

  if (currentCategories.size > 0) {
    filtered = filtered.filter(p => currentCategories.has(p.category));
  }

  if (currentSearch) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(currentSearch) ||
      p.category.toLowerCase().includes(currentSearch)
    );
  }

  if (saleOnlyFilter) {
    filtered = filtered.filter(p => isDiscountActive(p));
  }

  if (priceMin !== null && priceMax !== null) {
    filtered = filtered.filter(p => {
      const effectivePrice = isDiscountActive(p) ? getDiscount(p).salePrice : p.price;
      return effectivePrice >= priceMin && effectivePrice <= priceMax;
    });
  }

  displayProducts(filtered);
  updateActiveFiltersUI();
}

// ===== SALE FILTER =====
function toggleSaleFilter() {
  const checkbox = document.getElementById('sale-filter-checkbox');
  saleOnlyFilter = checkbox ? checkbox.checked : !saleOnlyFilter;
  if (checkbox) checkbox.checked = saleOnlyFilter;
  applyFilters();
}

function updateSaleFilterVisibility() {
  const activeCount = products.filter(p => isDiscountActive(p)).length;
  const item = document.getElementById('sale-filter-item');
  const label = document.getElementById('sale-filter-label');
  if (!item || !label) return;

  if (activeCount === 0) {
    item.style.display = 'none';
    if (saleOnlyFilter) {
      saleOnlyFilter = false;
      const checkbox = document.getElementById('sale-filter-checkbox');
      if (checkbox) checkbox.checked = false;
    }
  } else {
    item.style.display = 'flex';
    label.textContent = `On Sale (${activeCount})`;
  }
}

// ===== CATEGORY FILTER (sidebar checkboxes) =====
function toggleCategoryCheckbox(checkbox) {
  if (checkbox.checked) {
    currentCategories.add(checkbox.value);
  } else {
    currentCategories.delete(checkbox.value);
  }
  applyFilters();
}

function syncCategoryCheckboxes() {
  document.querySelectorAll('.category-filter-checkbox').forEach(cb => {
    cb.checked = currentCategories.has(cb.value);
  });
}

// Kept for backwards compatibility with existing links (footer "Shop" column,
// category call-to-action buttons elsewhere on the page) that call
// filterProducts('supports') etc. Selects a single category in the sidebar.
function filterProducts(category) {
  currentCategories = (category === 'all') ? new Set() : new Set([category]);
  syncCategoryCheckboxes();
  applyFilters();

  openFiltersPanel();

  setTimeout(() => {
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
  }, window.innerWidth <= 850 ? 100 : 0);

  if (window.innerWidth <= 850) {
    closeMobileMenu();
  }
}

// ===== PRICE RANGE FILTER (dual-handle slider) =====
function initPriceFilter() {
  if (!products.length) return;

  const prices = products.flatMap(p => {
    if (p.variants) return p.variants.options.map(o => o.price);
    return [isDiscountActive(p) ? getDiscount(p).salePrice : p.price];
  });
  priceBoundsMin = Math.floor(Math.min(...prices) / 50) * 50;
  priceBoundsMax = Math.ceil(Math.max(...prices) / 50) * 50;

  const minSlider = document.getElementById('price-min');
  const maxSlider = document.getElementById('price-max');
  if (!minSlider || !maxSlider) return;

  minSlider.min = priceBoundsMin;
  minSlider.max = priceBoundsMax;
  minSlider.value = priceBoundsMin;
  maxSlider.min = priceBoundsMin;
  maxSlider.max = priceBoundsMax;
  maxSlider.value = priceBoundsMax;

  priceMin = priceBoundsMin;
  priceMax = priceBoundsMax;

  updatePriceSliderUI();
}

function updatePriceRange() {
  const minSlider = document.getElementById('price-min');
  const maxSlider = document.getElementById('price-max');
  if (!minSlider || !maxSlider) return;

  let minVal = parseInt(minSlider.value, 10);
  let maxVal = parseInt(maxSlider.value, 10);

  // Keep the two handles from crossing over each other.
  if (minVal > maxVal) {
    [minVal, maxVal] = [maxVal, minVal];
  }

  minSlider.value = minVal;
  maxSlider.value = maxVal;

  priceMin = minVal;
  priceMax = maxVal;

  updatePriceSliderUI();
  applyFilters();
}

function updatePriceSliderUI() {
  const minSlider = document.getElementById('price-min');
  const rangeEl = document.getElementById('price-slider-range');
  const displayEl = document.getElementById('price-range-display');
  if (!minSlider || !rangeEl || !displayEl) return;

  const boundsMin = parseInt(minSlider.min, 10);
  const boundsMax = parseInt(minSlider.max, 10);
  const span = boundsMax - boundsMin || 1;

  const minPct = ((priceMin - boundsMin) / span) * 100;
  const maxPct = ((priceMax - boundsMin) / span) * 100;

  rangeEl.style.left = `${minPct}%`;
  rangeEl.style.right = `${100 - maxPct}%`;

  displayEl.textContent = `Price: ${priceMin.toLocaleString()} tk — ${priceMax.toLocaleString()} tk`;
}

// ===== COLLAPSIBLE FILTER GROUPS (Category / Price headers) =====
function toggleFilterGroup(headerBtn) {
  const group = headerBtn.closest('.filter-group');
  const expanded = headerBtn.getAttribute('aria-expanded') === 'true';
  headerBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  group.classList.toggle('collapsed', expanded);
}

// ===== FILTERS PANEL (collapsed by default; opens as a real sidebar column to the left of the grid) =====
function toggleFiltersPanel() {
  const sidebar = document.getElementById('filters-sidebar');
  if (sidebar.classList.contains('open')) {
    closeFiltersPanel();
  } else {
    openFiltersPanel();
  }
}

function openFiltersPanel() {
  const sidebar = document.getElementById('filters-sidebar');
  const layout = document.getElementById('products-layout');
  const toggleBtn = document.getElementById('filters-toggle');
  sidebar.classList.add('open');
  layout.classList.add('filters-open');
  toggleBtn.setAttribute('aria-expanded', 'true');
}

function closeFiltersPanel() {
  const sidebar = document.getElementById('filters-sidebar');
  const layout = document.getElementById('products-layout');
  const toggleBtn = document.getElementById('filters-toggle');
  sidebar.classList.remove('open');
  layout.classList.remove('filters-open');
  toggleBtn.setAttribute('aria-expanded', 'false');
}

// ===== ACTIVE FILTER COUNT + CLEAR ALL =====
function updateActiveFiltersUI() {
  let count = currentCategories.size;
  if (saleOnlyFilter) count += 1;
  if (priceMin !== null && priceMax !== null &&
      (priceMin > priceBoundsMin || priceMax < priceBoundsMax)) {
    count += 1;
  }

  const clearBtn = document.getElementById('btn-clear-filters');
  const countBadge = document.getElementById('filters-active-count');

  if (clearBtn) clearBtn.hidden = count === 0;
  if (countBadge) {
    countBadge.hidden = count === 0;
    countBadge.textContent = count;
  }
}

function clearAllFilters() {
  currentCategories = new Set();
  saleOnlyFilter = false;
  priceMin = priceBoundsMin;
  priceMax = priceBoundsMax;

  syncCategoryCheckboxes();
  const saleCheckbox = document.getElementById('sale-filter-checkbox');
  if (saleCheckbox) saleCheckbox.checked = false;

  const minSlider = document.getElementById('price-min');
  const maxSlider = document.getElementById('price-max');
  if (minSlider) minSlider.value = priceBoundsMin;
  if (maxSlider) maxSlider.value = priceBoundsMax;
  updatePriceSliderUI();

  applyFilters();
}
