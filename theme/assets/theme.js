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
  var removeLink = event.target.closest('.cart-page__remove');
  if (removeLink) {
    event.preventDefault();
    var removeLine = removeLink.closest('.cart-page__line');
    var removeLines = Array.prototype.slice.call(document.querySelectorAll('.cart-page__line'));
    var removeInput = removeLine && removeLine.querySelector('input[type="number"]');
    if (removeLine && removeInput) updateCartLine(removeLine, removeLines.indexOf(removeLine) + 1, 0, removeInput, parseInt(removeInput.value, 10) || 0);
    return;
  }
  var button = event.target.closest('[data-quantity-step]');
  if (!button) return;
  var input = button.parentElement.querySelector('input[type="number"]');
  if (!input) return;
  var next = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(button.dataset.quantityStep, 10));
  var previous = parseInt(input.value, 10) || 0;
  input.value = next;
  var cartForm = button.closest('form[action*="/cart"]');
  if (!cartForm) return;
  var line = button.closest('.cart-page__line');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.cart-page__line'));
  var lineNumber = lines.indexOf(line) + 1;
  if (!line || !lineNumber) return;
  updateCartLine(line, lineNumber, next, input, previous);
});

function updateCartLine(line, lineNumber, next, input, previous) {
  line.querySelectorAll('[data-quantity-step]').forEach(function (control) { control.disabled = true; });
  fetch('/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ line: lineNumber, quantity: next })
  })
    .then(function (response) { if (!response.ok) throw new Error('Could not update cart'); return response.json(); })
    .then(function (cart) {
      var quantityError = line.querySelector('.cart-page__quantity-error');
      if (quantityError) quantityError.remove();
      updateCartCount(cart);
      updateCartSummary(cart);
      if (next === 0) {
        var cartLayout = line.closest('.cart-page__layout');
        line.remove();
        if (cart.item_count === 0 && cartLayout) {
          cartLayout.outerHTML = '<div class="cart-page__empty"><h2 class="cart-page__empty-title">Your cart is waiting</h2><p class="cart-page__empty-text">Add something fun from the shop — your pet will thank you.</p><a href="/collections/all" class="cart-page__empty-cta">Browse the shop</a></div>';
        }
        return;
      }
      var updatedItem = cart.items[lineNumber - 1];
      if (updatedItem) {
        input.value = updatedItem.quantity;
        line.querySelector('.cart-page__line-unit').textContent = formatCartMoney(updatedItem.final_price);
        line.querySelector('.cart-page__line-total').textContent = formatCartMoney(updatedItem.final_line_price);
      }
      line.querySelectorAll('[data-quantity-step]').forEach(function (control) { control.disabled = false; });
    })
    .catch(function () {
      input.value = previous;
      line.querySelectorAll('[data-quantity-step]').forEach(function (control) { control.disabled = false; });
      var quantityError = line.querySelector('.cart-page__quantity-error');
      if (!quantityError) {
        quantityError = document.createElement('p');
        quantityError.className = 'cart-page__quantity-error';
        line.querySelector('.cart-page__line-controls').appendChild(quantityError);
      }
      quantityError.textContent = 'This item cannot be increased further because of its available inventory.';
    });
}

function formatCartMoney(cents) {
  var currency = (window.themeCart && window.themeCart.currency) || 'USD';
  return new Intl.NumberFormat(document.documentElement.lang || 'en-US', { style: 'currency', currency: currency }).format(cents / 100);
}

function updateCartCount(cart) {
  document.querySelectorAll('[data-cart-count]').forEach(function (node) { node.textContent = cart.item_count; });
}

function updateCartSummary(cart) {
  var summary = document.querySelector('.cart-page__summary');
  if (!summary) return;
  var subtotal = summary.querySelector('.cart-page__summary-row:not(.cart-page__summary-row--discount):not(.cart-page__summary-row--emphasis) span:last-child');
  var total = summary.querySelector('.cart-page__summary-row--emphasis span:last-child');
  if (subtotal) subtotal.textContent = formatCartMoney(cart.original_total_price);
  if (total) total.textContent = formatCartMoney(cart.total_price);

  var status = summary.querySelector('[data-bundle-status]');
  if (!status) {
    Array.prototype.slice.call(summary.querySelectorAll('.cart-page__summary-note')).some(function (note) {
      if (/receive 10% off|10% off applied/.test(note.textContent)) { status = note; status.setAttribute('data-bundle-status', ''); return true; }
      return false;
    });
  }
  var discountRow = summary.querySelector('.cart-page__summary-row--discount');
  if (cart.total_discount > 0) {
    if (!discountRow) {
      discountRow = document.createElement('div');
      discountRow.className = 'cart-page__summary-row cart-page__summary-row--discount';
      discountRow.innerHTML = '<span>Bundle discount (10%)</span><span></span>';
      summary.querySelector('.cart-page__summary-row').insertAdjacentElement('afterend', discountRow);
    }
    discountRow.querySelector('span:last-child').textContent = '−' + formatCartMoney(cart.total_discount);
    if (!status) { status = document.createElement('p'); status.className = 'cart-page__summary-note cart-page__summary-note--success'; discountRow.insertAdjacentElement('afterend', status); }
    status.textContent = '10% off applied — you ordered ' + cart.item_count + ' items.';
  } else {
    if (discountRow) discountRow.remove();
    if (!status) { status = document.createElement('p'); status.className = 'cart-page__summary-note'; summary.querySelector('.cart-page__summary-row--emphasis').insertAdjacentElement('beforebegin', status); }
    status.textContent = 'Add ' + (3 - cart.item_count) + ' more item' + (cart.item_count === 2 ? '' : 's') + ' to receive 10% off.';
  }
  status.setAttribute('data-bundle-status', '');
}
