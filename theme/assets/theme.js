document.addEventListener('submit', function (event) {
  var form = event.target;
  if (!form.matches('.quick-add-form')) return;
  event.preventDefault();
  var button = form.querySelector('button[type="submit"]');
  var data = new FormData(form);
  var variantId = data.get('id');
  button.disabled = true;
  fetch(window.routes ? window.routes.cart_add_url + '.js' : '/cart/add.js', { method: 'POST', headers: { Accept: 'application/json' }, body: data })
    .then(function (response) { if (!response.ok) throw new Error('Could not add item'); return fetch('/cart.js'); })
    .then(function (response) { return response.json(); })
    .then(function (cart) { updateCartCount(cart); renderShopCardQuantity(form, cart, variantId); })
    .catch(function () { button.textContent = 'Try again'; button.disabled = false; });
});

document.addEventListener('DOMContentLoaded', function () {
  hydrateShopCardQuantities(document);
});

function hydrateShopCardQuantities(scope) {
  var forms = scope.querySelectorAll('.quick-add-form');
  if (!forms.length) return;
  fetch('/cart.js')
    .then(function (response) { return response.json(); })
    .then(function (cart) {
      forms.forEach(function (form) {
        var variant = form.querySelector('input[name="id"]');
        if (variant) renderShopCardQuantity(form, cart, variant.value);
      });
    })
    .catch(function () {});
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-server-product-search]').forEach(function (search) {
    var input = search.querySelector('input[name="q"]');
    var clear = search.querySelector('[data-server-product-search-clear]');
    var timer;
    var request;
    if (!input) return;

    function updateResults(url) {
      if (request) request.abort();
      request = new AbortController();

      var sectionUrl = new URL(url, window.location.origin);
      sectionUrl.searchParams.set('section_id', search.dataset.sectionId);

      fetch(sectionUrl.toString(), { signal: request.signal })
        .then(function (response) {
          if (!response.ok) throw new Error('Could not update search results');
          return response.text();
        })
        .then(function (html) {
          var responseDocument = new DOMParser().parseFromString(html, 'text/html');
          var replacementItems = responseDocument.querySelector('.shop-view__catalog-main');
          var replacementCount = responseDocument.querySelector('.shop-view__results-count');
          var replacementPagination = responseDocument.querySelector('[data-product-pagination]');
          var content = search.closest('.shop-view__content');
          var items = content.querySelector('.shop-view__catalog-main');
          var count = content.querySelector('.shop-view__results-count');
          var pagination = content.querySelector('[data-product-pagination]');
          if (!replacementItems || !items) throw new Error('Could not find search results');

          items.innerHTML = replacementItems.innerHTML;
          if (replacementCount && count) count.innerHTML = replacementCount.innerHTML;
          if (replacementPagination && pagination) {
            pagination.outerHTML = replacementPagination.outerHTML;
          } else if (replacementPagination) {
            content.appendChild(replacementPagination);
          } else if (pagination) {
            pagination.remove();
          }
          hydrateShopCardQuantities(items);

          var pageUrl = new URL(url, window.location.origin);
          pageUrl.searchParams.delete('page');
          window.history.replaceState({}, '', pageUrl.pathname + pageUrl.search + pageUrl.hash);
        })
        .catch(function (error) {
          if (error.name !== 'AbortError') console.error(error);
        });
    }

    function submitSearch() {
      var url;
      if (input.value.trim()) {
        url = new URL(search.action, window.location.origin);
        new FormData(search).forEach(function (value, key) { url.searchParams.append(key, value); });
      } else {
        url = new URL(search.dataset.clearUrl, window.location.origin);
      }
      updateResults(url);
    }

    function scheduleSearch() {
      window.clearTimeout(timer);
      if (clear) clear.hidden = !input.value.trim();
      timer = window.setTimeout(submitSearch, 350);
    }

    input.addEventListener('input', scheduleSearch);
    // `type="search"` dispatches this event when its native clear affordance
    // (or Escape) empties the field; some browsers do not dispatch `input`.
    input.addEventListener('search', scheduleSearch);
    search.addEventListener('submit', function (event) {
      event.preventDefault();
      window.clearTimeout(timer);
      submitSearch();
    });
    if (clear) clear.addEventListener('click', function () {
      input.value = '';
      clear.hidden = true;
      window.clearTimeout(timer);
      submitSearch();
    });
  });
});

document.addEventListener('click', function (event) {
  var filterExpand = event.target.closest('[data-filter-expand]');
  if (filterExpand) {
    var filterValues = document.getElementById(filterExpand.dataset.filterExpand);
    if (!filterValues) return;
    var isExpanded = filterValues.classList.toggle('shop-filters__values--expanded');
    filterExpand.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    filterExpand.textContent = isExpanded ? 'See less' : 'See more';
    return;
  }
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
  var cardQuantityButton = event.target.closest('[data-card-quantity-step]');
  if (cardQuantityButton) {
    var cardForm = cardQuantityButton.closest('.quick-add-form');
    var cardInput = cardForm && cardForm.querySelector('[data-card-quantity-input]');
    if (!cardForm || !cardInput) return;
    var cardNext = Math.max(0, (parseInt(cardInput.value, 10) || 0) + parseInt(cardQuantityButton.dataset.cardQuantityStep, 10));
    updateShopCardQuantity(cardForm, cardInput, cardNext);
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

document.addEventListener('change', function (event) {
  var control = event.target;
  if (!control.matches('.shop-filters__tag-input')) return;
  window.location.assign(control.dataset.tagUrl);
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
  document.querySelectorAll('[data-cart-count]').forEach(function (node) { node.textContent = cart.item_count; node.hidden = cart.item_count === 0; });
}

function renderShopCardQuantity(form, cart, variantId) {
  var item = cart.items.filter(function (cartItem) { return String(cartItem.variant_id) === String(variantId); })[0];
  if (!item) return;
  form.dataset.cartLineKey = item.key;
  form.innerHTML = '<input type="hidden" name="id" value="' + item.variant_id + '"><div class="shop-view__qty"><button type="button" class="shop-view__qty-btn" data-card-quantity-step="-1" aria-label="Decrease quantity">−</button><label class="shop-view__qty-label">Quantity</label><input class="shop-view__qty-input" data-card-quantity-input type="number" min="0" value="' + item.quantity + '" aria-label="Quantity"><button type="button" class="shop-view__qty-btn" data-card-quantity-step="1" aria-label="Increase quantity">+</button></div>';
}

function updateShopCardQuantity(form, input, quantity) {
  var previous = parseInt(input.value, 10) || 0;
  var controls = form.querySelectorAll('[data-card-quantity-step]');
  controls.forEach(function (control) { control.disabled = true; });
  fetch('/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: form.dataset.cartLineKey, quantity: quantity })
  })
    .then(function (response) { if (!response.ok) throw new Error('Could not update cart'); return response.json(); })
    .then(function (cart) {
      updateCartCount(cart);
      if (quantity === 0) {
        form.removeAttribute('data-cart-line-key');
        form.innerHTML = '<input type="hidden" name="id" value="' + form.querySelector('input[name="id"]').value + '"><button class="shop-view__add-btn" type="submit">Add to cart</button>';
        return;
      }
      renderShopCardQuantity(form, cart, form.querySelector('input[name="id"]').value);
    })
    .catch(function () {
      input.value = previous;
      controls.forEach(function (control) { control.disabled = false; });
    });
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
