document.addEventListener('submit', function (event) {
  var form = event.target;
  if (!form.matches('.quick-add-form')) return;
  event.preventDefault();
  var button = form.querySelector('button[type="submit"]');
  var data = new FormData(form);
  button.disabled = true;
  fetch(window.routes ? window.routes.cart_add_url + '.js' : '/cart/add.js', { method: 'POST', headers: { Accept: 'application/json' }, body: data })
    .then(function (response) { if (!response.ok) throw new Error('Could not add item'); return fetch('/cart.js'); })
    .then(function (response) { return response.json(); })
    .then(function (cart) { document.querySelectorAll('[data-cart-count]').forEach(function (node) { node.textContent = cart.item_count; }); button.textContent = 'Added!'; setTimeout(function () { button.textContent = 'Add to cart'; button.disabled = false; }, 1200); })
    .catch(function () { button.textContent = 'Try again'; button.disabled = false; });
});

document.addEventListener('click', function (event) {
  var filterToggle = event.target.closest('[data-filter-panel] .shop-filters__toggle');
  if (filterToggle) {
    var panel = filterToggle.closest('[data-filter-panel]');
    var isOpen = panel.classList.toggle('shop-filters-panel--open');
    filterToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    return;
  }
  var button = event.target.closest('[data-quantity-step]');
  if (!button) return;
  var input = button.parentElement.querySelector('input[type="number"]');
  if (!input) return;
  var next = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(button.dataset.quantityStep, 10));
  input.value = next;
});
