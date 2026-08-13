/* ==========================================================
   utils.js — Toast notifications, discount math, stock helpers,
   countdown formatting. No cart/product state lives here; these
   are pure helpers shared by the other modules.
   ========================================================== */

// ===== HTML ESCAPING =====
// Use this whenever user-typed text (search queries, etc.) is interpolated
// into innerHTML, so characters like < > " ' & can't be used to inject markup.
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.classList.add('toast', type);

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}" aria-hidden="true"></i><span>${message}</span>`;
  container.appendChild(toast);

  toast.addEventListener('click', () => removeToast(toast));

  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

// ===== DISCOUNT HELPERS =====
// Relies on the global `DISCOUNTS` object populated by products.js
// after data/products.json has loaded.
function getDiscount(product) {
  return DISCOUNTS[product.id] || null;
}

function isDiscountActive(product) {
  const discount = getDiscount(product);
  if (!discount || !discount.salePrice || discount.salePrice >= product.price) return false;
  if (!discount.endsAt) return true;
  return new Date(discount.endsAt).getTime() > Date.now();
}

function getCurrentPrice(product) {
  const discount = getDiscount(product);
  return isDiscountActive(product) ? discount.salePrice : product.price;
}

function getDiscountPercent(product) {
  const discount = getDiscount(product);
  if (!isDiscountActive(product)) return 0;
  return Math.round(100 - (discount.salePrice / product.price) * 100);
}

// ===== COUNTDOWN HELPERS =====
function getCountdownParts(endsAt) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000)
  };
}

function formatCountdown(parts) {
  if (!parts) return 'Deal ended';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h left`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.mins}m left`;
  return `${parts.mins}m ${parts.secs}s left`;
}

// Ticks every active countdown element on the page (product cards + modal).
// Lives here because it's pure DOM/date logic, but it calls into
// products.js (applyFilters) and ui.js (openProductModal) once a deal
// expires so those visuals refresh immediately.
function tickCountdowns() {
  const els = document.querySelectorAll('[data-ends]');
  let expiredFound = false;

  els.forEach(el => {
    const parts = getCountdownParts(el.dataset.ends);
    if (!parts) {
      expiredFound = true;
    } else {
      el.textContent = formatCountdown(parts);
    }
  });

  if (expiredFound) {
    applyFilters();
    if (activeModalProductId && document.getElementById('product-modal').classList.contains('show')) {
      openProductModal(activeModalProductId);
    }
  }
}

// ===== WEIGHT / SHIPPING SURCHARGE HELPERS =====
// Every product carries an approximate `weight` in kg (data/products.json).
// Weight-based shipping surcharge: free up to 1kg total, then 20tk per
// extra kg (rounded up) on top of the flat delivery fee.
const WEIGHT_FREE_THRESHOLD_KG = 1;
const WEIGHT_SURCHARGE_PER_KG = 20;

function formatWeight(kg) {
  return `${kg.toFixed(2)} KG`;
}

function getCartTotalWeight() {
  return cart.reduce((total, item) => {
    const weight = typeof item.weight === 'number' ? item.weight : 0;
    return total + weight * item.quantity;
  }, 0);
}

function getWeightShippingSurcharge(totalWeight) {
  if (totalWeight <= WEIGHT_FREE_THRESHOLD_KG) return 0;
  return Math.ceil(totalWeight - WEIGHT_FREE_THRESHOLD_KG) * WEIGHT_SURCHARGE_PER_KG;
}

// Toggles the tap-to-open state of a weight tooltip (for touch devices;
// desktop already gets a hover/focus tooltip from CSS alone).
function toggleWeightTooltip(el) {
  const tooltip = el.closest('.weight-tooltip');
  if (!tooltip) return;
  const isOpen = tooltip.classList.contains('tooltip-open');
  document.querySelectorAll('.weight-tooltip.tooltip-open').forEach(t => t.classList.remove('tooltip-open'));
  if (!isOpen) tooltip.classList.add('tooltip-open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.weight-tooltip')) {
    document.querySelectorAll('.weight-tooltip.tooltip-open').forEach(t => t.classList.remove('tooltip-open'));
  }
});

// ===== VARIANT HELPERS =====
// Some products (e.g. Power Twister) offer multiple resistance/size
// "variants" that each carry their own price, weight and stock, instead of
// the color/size selectors above (which are cosmetic-only and share the
// product's single price/weight/stock pool). `product.variants` looks like:
// { label: "Resistance", options: [{ name, price, weight, stock }, ...] }
function getVariantOption(product, variantName) {
  if (!product.variants) return null;
  return product.variants.options.find(o => o.name === variantName) || product.variants.options[0];
}

function getEffectiveStock(product, variantName) {
  const opt = getVariantOption(product, variantName);
  return opt ? opt.stock : product.stock;
}

function getEffectivePrice(product, variantName) {
  const opt = getVariantOption(product, variantName);
  return opt ? opt.price : getCurrentPrice(product);
}

function getEffectiveWeight(product, variantName) {
  const opt = getVariantOption(product, variantName);
  return opt ? opt.weight : product.weight;
}

function getVariantTotalStock(product) {
  if (!product.variants) return product.stock;
  return product.variants.options.reduce((sum, o) => sum + o.stock, 0);
}

function getVariantPriceRange(product) {
  if (!product.variants) return null;
  const prices = product.variants.options.map(o => o.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function getVariantWeightRange(product) {
  if (!product.variants) return null;
  const weights = product.variants.options.map(o => o.weight);
  return { min: Math.min(...weights), max: Math.max(...weights) };
}

// ===== STOCK HELPERS =====
// Relies on the global `LOW_STOCK_THRESHOLD` populated by products.js.
function getStockInfo(product) {
  if (product.stock <= 0) {
    return { label: 'Out of Stock', className: 'out-of-stock', available: false };
  }
  if (product.stock <= LOW_STOCK_THRESHOLD) {
    return { label: `Only ${product.stock} left`, className: 'low-stock', available: true };
  }
  return { label: 'In Stock', className: 'in-stock', available: true };
}
