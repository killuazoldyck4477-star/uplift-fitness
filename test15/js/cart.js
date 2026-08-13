/* ==========================================================
   cart.js — Cart state, persistence, cart drawer rendering,
   and the checkout/order-submission flow.
   ========================================================== */

// ===== STATE =====
let cart = [];

// ===== CART PERSISTENCE =====
function saveCart() {
  localStorage.setItem('uplift_cart', JSON.stringify(cart));
}

function loadCart() {
  const saved = localStorage.getItem('uplift_cart');
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch (e) {
      cart = [];
    }
  }
  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) {
      const cap = item.variant ? getEffectiveStock(product, item.variant) : product.stock;
      item.quantity = Math.min(item.quantity, cap);
    }
  });
  cart = cart.filter(item => item.quantity > 0);
}

// If `variant` is null (default), sums every cart line for this product id —
// used for plain products, and for color/size selectors which share one
// stock pool. If a variant name is given, only lines matching that specific
// variant are summed, since each variant option has its own stock pool.
function getQuantityInCart(productId, variant = null) {
  return cart
    .filter(i => i.id === productId && (variant === null || i.variant === variant))
    .reduce((sum, i) => sum + i.quantity, 0);
}

function getCartSavings() {
  return cart.reduce((total, item) => {
    const original = item.originalPrice || item.price;
    const saved = Math.max(original - item.price, 0);
    return total + (saved * item.quantity);
  }, 0);
}

// ===== ADD TO CART (stock-aware) =====
// color/size are cosmetic-only selections that share the product's single
// stock/price/weight pool. `variant` (e.g. "20kg"/"30kg" resistance) is
// different: each option has its own price, weight and stock, so it gets
// its own line in the cart AND its own stock pool.
function addToCart(productId, quantity = 1, color = null, size = null, variant = null) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const effStock = variant ? getEffectiveStock(product, variant) : product.stock;
  const effPrice = variant ? getEffectivePrice(product, variant) : getCurrentPrice(product);
  const effWeight = variant ? getEffectiveWeight(product, variant) : product.weight;

  const stockInfo = getStockInfo({ stock: effStock });
  if (!stockInfo.available) {
    showToast(`${product.name} is out of stock.`, 'error');
    return;
  }

  const totalInCart = getQuantityInCart(productId, variant);
  const remainingCanAdd = effStock - totalInCart;

  if (remainingCanAdd <= 0) {
    showToast(`You already have the max available quantity of ${product.name} in your bag.`, 'error');
    return;
  }

  const qtyToAdd = Math.min(quantity, remainingCanAdd);

  const existing = cart.find(item => item.id === productId && item.color === color && item.size === size && item.variant === variant);

  if (existing) {
    existing.quantity += qtyToAdd;
  } else {
    cart.push({
      ...product,
      price: effPrice,
      originalPrice: variant ? effPrice : product.price,
      weight: effWeight,
      quantity: qtyToAdd,
      color,
      size,
      variant,
      variantLabel: variant && product.variants ? product.variants.label : null
    });
  }

  updateCartUI();
  saveCart();

  if (qtyToAdd < quantity) {
    showToast(`Only ${qtyToAdd} more ${product.name} available — added what's left in stock.`, 'info', 4000);
  } else {
    showToast(`${product.name} added to bag!`, 'success');
  }
}

// ===== REMOVE FROM CART =====
function removeFromCart(productId, color = null, size = null, variant = null) {
  const product = cart.find(item => item.id === productId && item.color === color && item.size === size && item.variant === variant);
  cart = cart.filter(item => !(item.id === productId && item.color === color && item.size === size && item.variant === variant));
  updateCartUI();
  saveCart();

  if (document.getElementById('checkout-modal').classList.contains('show')) {
    updateCheckoutSummary();
  }

  if (product) {
    showToast(`${product.name} removed`, 'info', 2000);
  }
}

// ===== QUANTITY CONTROLS (stock-aware) =====
function changeQuantity(productId, delta, color = null, size = null, variant = null) {
  const item = cart.find(i => i.id === productId && i.color === color && i.size === size && i.variant === variant);
  if (!item) return;

  const product = products.find(p => p.id === productId);
  const totalInCart = getQuantityInCart(productId, variant);
  const cap = variant && product ? getEffectiveStock(product, variant) : (product ? product.stock : 0);

  if (delta > 0 && product && totalInCart >= cap) {
    showToast(`Only ${cap} ${product.name} in stock.`, 'error');
    return;
  }

  item.quantity += delta;

  if (item.quantity <= 0) {
    removeFromCart(productId, color, size, variant);
    return;
  }

  updateCartUI();
  saveCart();

  if (document.getElementById('checkout-modal').classList.contains('show')) {
    updateCheckoutSummary();
  }
}

// ===== UPDATE CART UI =====
function updateCartUI() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  const cartTotal = document.getElementById('cart-total-amount');
  const savingsRow = document.getElementById('cart-savings-row');
  const savingsAmount = document.getElementById('cart-savings-amount');
  const cartIconContainer = document.getElementById('cart-icon-container');

  cartItemsContainer.innerHTML = '';

  let totalCount = 0;
  let totalPrice = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
    <div class="cart-empty">
      <i class="fas fa-dumbbell" aria-hidden="true"></i>
      <p>Your training bag is empty.<br>Add some gear to get started!</p>
    </div>`;
  } else {
    cart.forEach(item => {
      totalCount += item.quantity;
      totalPrice += item.price * item.quantity;

      const product = products.find(p => p.id === item.id);
      const itemCap = item.variant && product ? getEffectiveStock(product, item.variant) : (product ? product.stock : 0);
      const atMaxStock = product && getQuantityInCart(item.id, item.variant) >= itemCap;
      const itemOnSale = item.originalPrice && item.originalPrice > item.price;

      const priceHTML = itemOnSale
        ? `<div class="cart-item-price">
             <span class="cart-item-price-original"><span class="sr-only">Original price: </span>${item.originalPrice.toLocaleString()} tk</span>
             <span class="cart-item-price-sale"><span class="sr-only">Sale price: </span>${item.price.toLocaleString()} tk</span>
           </div>`
        : `<div class="cart-item-price">${item.price.toLocaleString()} tk</div>`;

      const variantLabel = [
        item.color ? `Color: ${item.color}` : null,
        item.size ? `Size: ${item.size}` : null,
        item.variant ? `${item.variantLabel || 'Option'}: ${item.variant}` : null
      ].filter(Boolean).join(' · ');

      // Safely embed the color/size/variant strings as JS string literals
      // inside the inline onclick handlers (falls back to the bare word
      // null when unset).
      const colorArg = item.color ? `'${String(item.color).replace(/'/g, "\\'")}'` : 'null';
      const sizeArg = item.size ? `'${String(item.size).replace(/'/g, "\\'")}'` : 'null';
      const variantArg = item.variant ? `'${String(item.variant).replace(/'/g, "\\'")}'` : 'null';

      const itemRow = document.createElement('div');
      itemRow.classList.add('cart-item');
      itemRow.innerHTML = `
        <img src="${item.img}" alt="${item.name}" class="cart-item-img"
        onerror="this.src='https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400'">
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          ${variantLabel ? `<div class="cart-item-variant">${variantLabel}</div>` : ''}
          ${priceHTML}
          <div class="cart-quantity-controls">
            <button class="qty-btn" onclick="changeQuantity(${item.id}, -1, ${colorArg}, ${sizeArg}, ${variantArg})" aria-label="Decrease quantity of ${item.name}"><i class="fas fa-minus" aria-hidden="true"></i></button>
            <span class="qty-display" aria-live="polite">${item.quantity}</span>
            <button class="qty-btn" onclick="changeQuantity(${item.id}, 1, ${colorArg}, ${sizeArg}, ${variantArg})" aria-label="Increase quantity of ${item.name}" ${atMaxStock ? 'disabled title="Max stock reached"' : ''}><i class="fas fa-plus" aria-hidden="true"></i></button>
          </div>
          ${atMaxStock ? '<div class="cart-item-stock-note">Max stock in bag</div>' : ''}
        </div>
        <button class="remove-item" onclick="removeFromCart(${item.id}, ${colorArg}, ${sizeArg}, ${variantArg})" aria-label="Remove ${item.name} from bag" title="Remove item">
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
        </button>
      `;
      cartItemsContainer.appendChild(itemRow);
    });
  }

  cartCount.textContent = totalCount;
  cartTotal.textContent = `${totalPrice.toLocaleString()} tk`;
  if (cartIconContainer) {
    cartIconContainer.setAttribute('aria-label', `Open cart, ${totalCount} item${totalCount !== 1 ? 's' : ''}`);
  }

  const savings = getCartSavings();
  if (savings > 0) {
    savingsRow.style.display = 'flex';
    savingsAmount.textContent = `You saved ${savings.toLocaleString()} tk with active deals`;
  } else {
    savingsRow.style.display = 'none';
  }

  const weightRow = document.getElementById('cart-weight-row');
  const weightAmount = document.getElementById('cart-weight-amount');
  if (weightRow && weightAmount) {
    if (cart.length === 0) {
      weightRow.style.display = 'none';
    } else {
      weightRow.style.display = 'flex';
      weightAmount.textContent = formatWeight(getCartTotalWeight());
    }
  }
}

// ===== CHECKOUT FLOW =====
function checkoutAlert() {
  if (cart.length === 0) {
    showToast('Your bag is empty! Add some gear first.', 'error');
    return;
  }

  toggleCart();
  toggleCheckoutModal();
  updateCheckoutSummary();
  loadSavedInformation();
}

// ===== CHECKOUT SUMMARY =====
function updateCheckoutSummary() {
  const summaryContainer = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('summary-subtotal');
  const shippingEl = document.getElementById('summary-shipping');
  const grandTotalEl = document.getElementById('summary-grand-total');
  const savingsRow = document.getElementById('summary-savings-row');
  const savingsAmountEl = document.getElementById('summary-savings-amount');

  summaryContainer.innerHTML = '';
  let subtotal = 0;

  cart.forEach(item => {
    subtotal += item.price * item.quantity;
    const variantLabel = [item.color, item.size, item.variant].filter(Boolean).join(', ');
    const row = document.createElement('div');
    row.classList.add('summary-item');
    row.innerHTML = `
      <span class="item-name">${item.name}${variantLabel ? ` (${variantLabel})` : ''} <strong>×${item.quantity}</strong></span>
      <span>${(item.price * item.quantity).toLocaleString()} tk</span>
    `;
    summaryContainer.appendChild(row);
  });

  const selectedShipping = document.querySelector('input[name="shipping"]:checked');
  const shippingCost = selectedShipping ? parseInt(selectedShipping.value) : 70;

  const totalWeight = getCartTotalWeight();
  const weightSurcharge = getWeightShippingSurcharge(totalWeight);
  const grandTotal = subtotal + shippingCost + weightSurcharge;

  subtotalEl.textContent = `${subtotal.toLocaleString()} tk`;
  shippingEl.textContent = `${shippingCost} tk`;
  grandTotalEl.textContent = `${grandTotal.toLocaleString()} tk`;

  const weightEl = document.getElementById('summary-weight');
  if (weightEl) weightEl.textContent = formatWeight(totalWeight);

  const surchargeRow = document.getElementById('summary-shipping-surcharge-row');
  const surchargeEl = document.getElementById('summary-shipping-surcharge');
  if (surchargeRow && surchargeEl) {
    if (weightSurcharge > 0) {
      surchargeRow.classList.remove('hidden');
      surchargeEl.textContent = `${weightSurcharge.toLocaleString()} tk`;
    } else {
      surchargeRow.classList.add('hidden');
      surchargeEl.textContent = '0 tk';
    }
  }

  const savings = getCartSavings();
  if (savings > 0) {
    savingsRow.style.display = 'flex';
    savingsAmountEl.textContent = `- ${savings.toLocaleString()} tk`;
  } else {
    savingsRow.style.display = 'none';
  }
}

// ===== SUBMIT TRANSACTION =====
function submitTransaction(event) {
  event.preventDefault();

  if (cart.length === 0) {
    showToast('Error: Your cart is empty.', 'error');
    return;
  }

  for (const item of cart) {
    const product = products.find(p => p.id === item.id);
    const cap = item.variant && product ? getEffectiveStock(product, item.variant) : (product ? product.stock : 0);
    if (!product || item.quantity > cap) {
      showToast(`Sorry, ${item.name} no longer has enough stock. Please update your bag.`, 'error', 5000);
      return;
    }
  }

  const saveCheckbox = document.getElementById('save-info');
  if (saveCheckbox && saveCheckbox.checked) {
    const userInfo = {
      contact: document.getElementById('contact-info').value,
      firstName: document.getElementById('first-name').value,
      lastName: document.getElementById('last-name').value,
      address: document.getElementById('address').value,
      apartment: document.getElementById('apartment').value,
      city: document.getElementById('city').value,
      thana: document.getElementById('thana').value,
      phone: document.getElementById('delivery-phone').value,
    };
    localStorage.setItem('uplift_saved_user', JSON.stringify(userInfo));
  }

  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;
    if (item.variant && product.variants) {
      const opt = getVariantOption(product, item.variant);
      if (opt) opt.stock = Math.max(opt.stock - item.quantity, 0);
    } else {
      product.stock = Math.max(product.stock - item.quantity, 0);
    }
  });

  const firstName = document.getElementById('first-name').value;
  const lastName = document.getElementById('last-name').value;
  const finalAmount = document.getElementById('summary-grand-total').textContent;
  const phone = document.getElementById('delivery-phone').value;
  const address = document.getElementById('address').value;
  const region = document.getElementById('delivery-region').value;
  const thana = document.getElementById('thana').value;
  const contact = document.getElementById('contact-info').value.trim();
  const orderItems = cart.map(item => {
    const variantLabel = [
      item.color ? `Color: ${item.color}` : null,
      item.size ? `Size: ${item.size}` : null,
      item.variant ? `${item.variantLabel || 'Option'}: ${item.variant}` : null
    ].filter(Boolean).join(', ');
    return `• ${item.name}${variantLabel ? ` (${variantLabel})` : ''} ×${item.quantity} — ${(item.price * item.quantity).toLocaleString()} tk`;
  }).join('\n');

  const totalWeight = getCartTotalWeight();
  const weightSurcharge = getWeightShippingSurcharge(totalWeight);

  const whatsappMessage = encodeURIComponent(
    `💪 UpLift Fitness — New COD Order\n\n` +
    
    `First Name: ${firstName}\n` +
    `Last Name: ${lastName}\n` +
    `Contact: ${contact}\n` +
    `Address: ${address}\n` +
    `Region: ${region}\n` +
    `Thana: ${thana}\n` +
    `Phone Number: ${phone}\n\n` +

    `Order:\n${orderItems}\n\n` +

    `Approximate Total Weight: ${formatWeight(totalWeight)}\n` +
    `Estimated Shipping Charge: ${weightSurcharge.toLocaleString()} tk\n` +
    `Grand Total: ${finalAmount}\n` +
    `Payment: Cash on Delivery\n\n` +

    `*Shipping charge is estimated. Final shipping charge will be confirmed after final product weight (cost wont change much)`
  );

  window.open(`https://wa.me/+8801979019938?text=${whatsappMessage}`, '_blank');

  showToast(`Order confirmed, ${firstName}! Total: ${finalAmount}. We'll contact you soon.`, 'success', 5000);

  cart = [];
  updateCartUI();
  saveCart();
  applyFilters();
  document.getElementById('checkout-form').reset();
  toggleCheckoutModal();
}

// ===== LOAD SAVED USER INFO =====
function loadSavedInformation() {
  const saved = localStorage.getItem('uplift_saved_user');
  if (!saved) return;

  try {
    const data = JSON.parse(saved);
    document.getElementById('contact-info').value = data.contact || '';
    document.getElementById('first-name').value = data.firstName || '';
    document.getElementById('last-name').value = data.lastName || '';
    document.getElementById('address').value = data.address || '';
    document.getElementById('apartment').value = data.apartment || '';
    document.getElementById('city').value = data.city || '';
    document.getElementById('thana').value = data.thana || '';
    document.getElementById('delivery-phone').value = data.phone || '';
    document.getElementById('save-info').checked = true;
  } catch (e) {
    // Ignore parse errors
  }
}


