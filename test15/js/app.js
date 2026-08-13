/* ==========================================================
   app.js — Entry point. Loads product data, then wires up
   the cart, catalog rendering, and all the cosmetic animations.
   Load this file last, after utils.js, products.js, cart.js,
   ui.js and animations.js have defined everything it calls.
   ========================================================== */

// Kick the preloader off immediately, same as the original
// single-file script did, so the progress bar starts the moment
// the page begins parsing rather than waiting for window.onload.
initPreloader();

// Was window.onload (waits for every image/font/stylesheet to finish loading
// before the product grid even starts fetching). Scripts are now `defer`red,
// so DOMContentLoaded already fires right after the DOM is parsed — this lets
// the product JSON fetch and first images start much sooner, which is the
// main driver of Largest Contentful Paint on this page.
document.addEventListener('DOMContentLoaded', async () => {
  await loadProductData();

  loadCart();
  loadWishlist();
  displayProducts();
  updateCartUI();
  updateWishlistUI();

  initScrollEffects();
  initScrollAnimations();
  initCustomCursor();
  initHeroReveal();
  initCounters();
  initMagneticButtons();
  initScrollReveal();
  setInterval(tickCountdowns, 1000);

  document.getElementById('mobile-menu-toggle').addEventListener('click', toggleMobileMenu);

  document.addEventListener('click', (e) => {
    const navMenu = document.getElementById('nav-menu');
    const toggle = document.getElementById('mobile-menu-toggle');
    if (navMenu.classList.contains('open') &&
        !navMenu.contains(e.target) &&
        !toggle.contains(e.target)) {
      closeMobileMenu();
    }
  });
});
