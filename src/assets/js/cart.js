(function () {
  'use strict';

  var LEGACY_KEY = 'playtimePetsCart';
  var SHOPIFY_CART_KEY = 'playtimePetsShopifyCartId';

  function shopifyStorefrontToken() {
    var s = window.__SHOPIFY__;
    if (!s) return '';
    if (s.storefrontToken) return s.storefrontToken;
    if (s.storefrontTokenParts && s.storefrontTokenParts.length) {
      return s.storefrontTokenParts.join('');
    }
    return '';
  }

  function shopifyMode() {
    return Boolean(
      window.__SHOPIFY__ &&
        window.__SHOPIFY__.configured &&
        window.__SHOPIFY__.domain &&
        shopifyStorefrontToken()
    );
  }

  function shopifyEndpoint() {
    var v = window.__SHOPIFY__.apiVersion || '2024-10';
    return 'https://' + window.__SHOPIFY__.domain + '/api/' + v + '/graphql.json';
  }

  function shopifyGraphql(query, variables) {
    return fetch(shopifyEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': shopifyStorefrontToken()
      },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (res) {
      return res.json();
    });
  }

  function getStoredCartId() {
    try {
      return localStorage.getItem(SHOPIFY_CART_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setStoredCartId(id) {
    try {
      if (id) localStorage.setItem(SHOPIFY_CART_KEY, id);
      else localStorage.removeItem(SHOPIFY_CART_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  var CART_QUERY =
    'query CartQuery($id: ID!) { cart(id: $id) { id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { edges { node { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title image { url } price { amount } compareAtPrice { amount } product { title handle } } } } } } } }';

  var CART_CREATE =
    'mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } } lines(first: 100) { edges { node { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title image { url } price { amount } compareAtPrice { amount } product { title handle } } } } } } } userErrors { field message } } }';

  var CART_LINES_ADD =
    'mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { edges { node { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title image { url } price { amount } compareAtPrice { amount } product { title handle } } } } } } } userErrors { field message } } }';

  var CART_LINES_UPDATE =
    'mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { edges { node { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title image { url } price { amount } compareAtPrice { amount } product { title handle } } } } } } } userErrors { field message } } }';

  var CART_LINES_REMOVE =
    'mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { edges { node { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title image { url } price { amount } compareAtPrice { amount } product { title handle } } } } } } } userErrors { field message } } }';

  function parseCartPayload(body) {
    if (!body || typeof body !== 'object') {
      console.error('[Shopify] Invalid response', body);
      return null;
    }
    if (body.errors && body.errors.length) {
      console.error('[Shopify]', body.errors);
      // Top-level GraphQL errors often omit `data` — returning undefined caused
      // "Cannot read properties of undefined (reading 'cartCreate')".
      if (body.data == null) {
        throw new Error((body.errors[0] && body.errors[0].message) || 'Shopify request failed');
      }
    }
    if (body.data === undefined) {
      throw new Error('Invalid response from store');
    }
    return body.data;
  }

  function fetchShopifyCart() {
    var id = getStoredCartId();
    if (!id) return Promise.resolve(null);
    return shopifyGraphql(CART_QUERY, { id: id }).then(function (body) {
      var data;
      try {
        data = parseCartPayload(body);
      } catch (e) {
        setStoredCartId('');
        return null;
      }
      if (!data || !data.cart) {
        setStoredCartId('');
        return null;
      }
      return data.cart;
    });
  }

  function formatMoney(amountStr, currencyCode) {
    var n = parseFloat(amountStr, 10);
    if (isNaN(n)) return '$0.00';
    var cur = currencyCode || 'USD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n);
    } catch (e) {
      return '$' + n.toFixed(2);
    }
  }

  function accentFromId(str) {
    var h = 0;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 6;
  }

  // ——— Legacy localStorage cart ———

  function readCart() {
    try {
      var raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(items));
    } catch (e) {
      /* ignore */
    }
  }

  function formatMoneyPlain(n) {
    var num = typeof n === 'number' && !isNaN(n) ? n : 0;
    return '$' + num.toFixed(2);
  }

  function lineTotal(line) {
    var p = parseFloat(line.price, 10);
    var qty = Math.max(1, parseInt(line.qty, 10) || 1);
    return (isNaN(p) ? 0 : p) * qty;
  }

  function cartSubtotal(items) {
    return items.reduce(function (sum, line) {
      return sum + lineTotal(line);
    }, 0);
  }

  function updateHeaderBadgeFromCount(count) {
    var badge = document.getElementById('header-cart-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function updateHeaderBadge() {
    if (shopifyMode()) {
      fetchShopifyCart().then(function (cart) {
        var n = cart && cart.totalQuantity != null ? cart.totalQuantity : 0;
        updateHeaderBadgeFromCount(n);
      });
    } else {
      var items = readCart();
      var count = items.reduce(function (n, line) {
        return n + Math.max(1, parseInt(line.qty, 10) || 1);
      }, 0);
      updateHeaderBadgeFromCount(count);
    }
  }

  function legacyAddToCart(product, addQty) {
    if (!product || product.id == null) return;
    var q = Math.max(1, Math.min(99, parseInt(addQty, 10) || 1));
    var items = readCart();
    var id = String(product.id);
    var price = parseFloat(product.price, 10);
    if (isNaN(price)) price = 0;
    var found = items.find(function (l) {
      return String(l.id) === id;
    });
    if (found) {
      found.qty = Math.max(1, (parseInt(found.qty, 10) || 1) + q);
      found.title = product.title || found.title;
      found.image = product.image || found.image;
      found.price = price;
      if (product.comparePrice != null) found.comparePrice = product.comparePrice;
    } else {
      items.push({
        id: id,
        title: product.title || 'Item',
        price: price,
        comparePrice: product.comparePrice != null ? product.comparePrice : null,
        image: product.image || '',
        qty: q
      });
    }
    writeCart(items);
    updateHeaderBadge();
  }

  function shopifyAddLine(variantId, quantity) {
    var q = Math.max(1, parseInt(quantity, 10) || 1);
    var existingId = getStoredCartId();

    if (!existingId) {
      return shopifyGraphql(CART_CREATE, {
        input: {
          lines: [{ merchandiseId: variantId, quantity: q }]
        }
      }).then(function (body) {
        var data = parseCartPayload(body);
        if (!data || !data.cartCreate) {
          throw new Error('Could not create cart');
        }
        var err = data.cartCreate.userErrors;
        if (err && err.length) {
          console.error('[cartCreate]', err);
          throw new Error(err[0].message || 'Cart error');
        }
        var cart = data.cartCreate.cart;
        if (!cart || !cart.id) throw new Error('No cart returned');
        setStoredCartId(cart.id);
        return cart;
      });
    }

    return shopifyGraphql(CART_LINES_ADD, {
      cartId: existingId,
      lines: [{ merchandiseId: variantId, quantity: q }]
    }).then(function (body) {
      var data = parseCartPayload(body);
      if (!data || !data.cartLinesAdd) {
        throw new Error('Could not update cart');
      }
      var err = data.cartLinesAdd.userErrors;
      if (err && err.length) {
        console.error('[cartLinesAdd]', err);
        throw new Error(err[0].message || 'Cart error');
      }
      var cart = data.cartLinesAdd.cart;
      if (!cart) {
        setStoredCartId('');
        throw new Error('Cart not found');
      }
      return cart;
    });
  }

  function shopifyUpdateLineQuantity(lineId, quantity) {
    var cartId = getStoredCartId();
    if (!cartId) return Promise.resolve(null);
    var qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    return shopifyGraphql(CART_LINES_UPDATE, {
      cartId: cartId,
      lines: [{ id: lineId, quantity: qty }]
    }).then(function (body) {
      var data = parseCartPayload(body);
      if (!data || !data.cartLinesUpdate) {
        throw new Error('Could not update cart');
      }
      var err = data.cartLinesUpdate.userErrors;
      if (err && err.length) {
        console.error('[cartLinesUpdate]', err);
        throw new Error(err[0].message || 'Update error');
      }
      return data.cartLinesUpdate.cart;
    });
  }

  function shopifyRemoveLine(lineId) {
    var cartId = getStoredCartId();
    if (!cartId) return Promise.resolve(null);
    return shopifyGraphql(CART_LINES_REMOVE, {
      cartId: cartId,
      lineIds: [lineId]
    }).then(function (body) {
      var data = parseCartPayload(body);
      if (!data || !data.cartLinesRemove) {
        throw new Error('Could not update cart');
      }
      var err = data.cartLinesRemove.userErrors;
      if (err && err.length) {
        console.error('[cartLinesRemove]', err);
        throw new Error(err[0].message || 'Remove error');
      }
      var cart = data.cartLinesRemove.cart;
      if (cart && cart.totalQuantity === 0) setStoredCartId('');
      return cart;
    });
  }

  function renderShopifyCartPage() {
    var root = document.querySelector('[data-cart-page]');
    if (!root) return;

    var emptyEl = document.getElementById('cart-empty-state');
    var filledEl = document.getElementById('cart-filled-state');
    var listEl = document.getElementById('cart-line-items');
    var subtotalEl = document.getElementById('cart-subtotal');
    var totalEl = document.getElementById('cart-total');
    var shipMsg = document.getElementById('cart-shipping-msg');

    if (!listEl) return;

    fetchShopifyCart().then(function (cart) {
      if (!cart || !cart.lines || !cart.lines.edges || cart.lines.edges.length === 0) {
        if (emptyEl) {
          emptyEl.classList.remove('is-hidden');
          emptyEl.hidden = false;
        }
        if (filledEl) {
          filledEl.classList.add('is-hidden');
          filledEl.hidden = true;
        }
        listEl.innerHTML = '';
        updateHeaderBadgeFromCount(0);
        return;
      }

      if (emptyEl) {
        emptyEl.classList.add('is-hidden');
        emptyEl.hidden = true;
      }
      if (filledEl) {
        filledEl.classList.remove('is-hidden');
        filledEl.hidden = false;
      }

      listEl.innerHTML = '';

      var currency =
        (cart.cost && cart.cost.subtotalAmount && cart.cost.subtotalAmount.currencyCode) || 'USD';
      var subtotal = cart.cost && cart.cost.subtotalAmount && cart.cost.subtotalAmount.amount;
      var FREE_SHIP = 50;

      cart.lines.edges.forEach(function (edge) {
        var node = edge.node;
        var merch = node.merchandise;
        if (!merch || !merch.product) return;

        var li = document.createElement('li');
        li.className =
          'cart-page__line cart-page__line--accent-' + accentFromId(node.id);

        var thumb = document.createElement('div');
        thumb.className = 'cart-page__line-thumb';
        if (merch.image && merch.image.url) {
          var img = document.createElement('img');
          img.src = merch.image.url;
          img.alt = '';
          thumb.appendChild(img);
        }
        li.appendChild(thumb);

        var body = document.createElement('div');
        body.className = 'cart-page__line-body';

        var title = document.createElement('h3');
        title.className = 'cart-page__line-title';
        var link = document.createElement('a');
        link.href = '/shop/' + encodeURIComponent(merch.product.handle) + '/';
        link.textContent = merch.product.title;
        title.appendChild(link);
        body.appendChild(title);

        var priceRow = document.createElement('div');
        priceRow.className = 'cart-page__line-price-row';

        var unit = document.createElement('span');
        unit.className = 'cart-page__line-unit';
        unit.textContent = formatMoney(merch.price && merch.price.amount, currency);
        priceRow.appendChild(unit);

        if (merch.compareAtPrice && merch.compareAtPrice.amount) {
          var cmp = parseFloat(merch.compareAtPrice.amount, 10);
          var cur = parseFloat(merch.price.amount, 10);
          if (cmp > cur) {
            var cmpEl = document.createElement('span');
            cmpEl.className = 'cart-page__line-compare';
            cmpEl.textContent = formatMoney(merch.compareAtPrice.amount, currency);
            priceRow.appendChild(cmpEl);
          }
        }
        body.appendChild(priceRow);
        li.appendChild(body);

        var controls = document.createElement('div');
        controls.className = 'cart-page__line-controls';

        var qtyWrap = document.createElement('div');
        qtyWrap.className = 'cart-page__qty';

        var dec = document.createElement('button');
        dec.type = 'button';
        dec.className = 'cart-page__qty-btn';
        dec.setAttribute('aria-label', 'Decrease quantity');
        dec.textContent = '−';

        var qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.className = 'cart-page__qty-input';
        qtyInput.min = '1';
        qtyInput.value = String(node.quantity);
        qtyInput.setAttribute('aria-label', 'Quantity for ' + merch.product.title);

        var inc = document.createElement('button');
        inc.type = 'button';
        inc.className = 'cart-page__qty-btn';
        inc.setAttribute('aria-label', 'Increase quantity');
        inc.textContent = '+';

        var lineId = node.id;

        function refreshAfter(promise) {
          promise
            .then(function () {
              renderShopifyCartPage();
              updateHeaderBadge();
            })
            .catch(function (e) {
              console.error(e);
              alert(e.message || 'Could not update cart');
            });
        }

        dec.addEventListener('click', function () {
          var v = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
          if (v < 1) return;
          qtyInput.value = String(v);
          refreshAfter(shopifyUpdateLineQuantity(lineId, v));
        });
        inc.addEventListener('click', function () {
          var v = (parseInt(qtyInput.value, 10) || 1) + 1;
          qtyInput.value = String(v);
          refreshAfter(shopifyUpdateLineQuantity(lineId, v));
        });
        qtyInput.addEventListener('change', function () {
          refreshAfter(shopifyUpdateLineQuantity(lineId, qtyInput.value));
        });

        qtyWrap.appendChild(dec);
        qtyWrap.appendChild(qtyInput);
        qtyWrap.appendChild(inc);
        controls.appendChild(qtyWrap);

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'cart-page__remove';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', function () {
          refreshAfter(shopifyRemoveLine(lineId));
        });
        controls.appendChild(removeBtn);

        var lineTot = document.createElement('div');
        lineTot.className = 'cart-page__line-total';
        var lineAmt =
          node.cost && node.cost.totalAmount && node.cost.totalAmount.amount
            ? node.cost.totalAmount.amount
            : null;
        lineTot.textContent = lineAmt
          ? formatMoney(lineAmt, currency)
          : formatMoneyPlain(parseFloat(merch.price.amount, 10) * node.quantity);
        controls.appendChild(lineTot);

        li.appendChild(controls);
        listEl.appendChild(li);
      });

      if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal, currency);
      if (totalEl) {
        var totalAmt =
          cart.cost && cart.cost.totalAmount && cart.cost.totalAmount.amount
            ? cart.cost.totalAmount.amount
            : subtotal;
        var totalCur =
          (cart.cost && cart.cost.totalAmount && cart.cost.totalAmount.currencyCode) || currency;
        totalEl.textContent = formatMoney(totalAmt, totalCur);
      }

      if (shipMsg) {
        var subNum = parseFloat(subtotal, 10);
        if (subNum >= FREE_SHIP) {
          shipMsg.textContent = 'You qualify for free shipping.';
          shipMsg.className = 'cart-page__summary-note cart-page__summary-note--highlight';
        } else {
          var need = FREE_SHIP - subNum;
          shipMsg.textContent =
            'Add ' +
            formatMoneyPlain(need) +
            ' more for free shipping (orders $' +
            FREE_SHIP +
            '+).';
          shipMsg.className = 'cart-page__summary-note';
        }
      }

      updateHeaderBadgeFromCount(cart.totalQuantity || 0);
    });
  }

  function renderLegacyCartPage() {
    var root = document.querySelector('[data-cart-page]');
    if (!root) return;

    var emptyEl = document.getElementById('cart-empty-state');
    var filledEl = document.getElementById('cart-filled-state');
    var listEl = document.getElementById('cart-line-items');
    var subtotalEl = document.getElementById('cart-subtotal');
    var totalEl = document.getElementById('cart-total');
    var shipMsg = document.getElementById('cart-shipping-msg');

    if (!listEl) return;

    var items = readCart();
    var subtotal = cartSubtotal(items);
    var FREE_SHIP = 50;

    function accentClass(id) {
      var n = parseInt(id, 10);
      if (isNaN(n)) n = 0;
      return 'cart-page__line--accent-' + (Math.abs(n) % 6);
    }

    if (items.length === 0) {
      if (emptyEl) {
        emptyEl.classList.remove('is-hidden');
        emptyEl.hidden = false;
      }
      if (filledEl) {
        filledEl.classList.add('is-hidden');
        filledEl.hidden = true;
      }
      listEl.innerHTML = '';
      return;
    }

    if (emptyEl) {
      emptyEl.classList.add('is-hidden');
      emptyEl.hidden = true;
    }
    if (filledEl) {
      filledEl.classList.remove('is-hidden');
      filledEl.hidden = false;
    }

    listEl.innerHTML = '';

    items.forEach(function (line) {
      var li = document.createElement('li');
      li.className = 'cart-page__line ' + accentClass(line.id);

      var thumb = document.createElement('div');
      thumb.className = 'cart-page__line-thumb';
      if (line.image) {
        var img = document.createElement('img');
        img.src = line.image;
        img.alt = '';
        thumb.appendChild(img);
      }
      li.appendChild(thumb);

      var body = document.createElement('div');
      body.className = 'cart-page__line-body';

      var title = document.createElement('h3');
      title.className = 'cart-page__line-title';
      var link = document.createElement('a');
      link.href = '/shop/' + encodeURIComponent(line.id) + '/';
      link.textContent = line.title;
      title.appendChild(link);
      body.appendChild(title);

      var priceRow = document.createElement('div');
      priceRow.className = 'cart-page__line-price-row';

      var unit = document.createElement('span');
      unit.className = 'cart-page__line-unit';
      unit.textContent = formatMoneyPlain(parseFloat(line.price, 10));
      priceRow.appendChild(unit);

      if (line.comparePrice != null && line.comparePrice !== '') {
        var cmp = document.createElement('span');
        cmp.className = 'cart-page__line-compare';
        cmp.textContent = formatMoneyPlain(parseFloat(line.comparePrice, 10));
        priceRow.appendChild(cmp);
      }
      body.appendChild(priceRow);

      li.appendChild(body);

      var controls = document.createElement('div');
      controls.className = 'cart-page__line-controls';

      var qtyWrap = document.createElement('div');
      qtyWrap.className = 'cart-page__qty';

      var dec = document.createElement('button');
      dec.type = 'button';
      dec.className = 'cart-page__qty-btn';
      dec.setAttribute('aria-label', 'Decrease quantity');
      dec.textContent = '−';
      var qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.className = 'cart-page__qty-input';
      qtyInput.min = '1';
      qtyInput.value = String(Math.max(1, parseInt(line.qty, 10) || 1));
      qtyInput.setAttribute('aria-label', 'Quantity for ' + line.title);

      var inc = document.createElement('button');
      inc.type = 'button';
      inc.className = 'cart-page__qty-btn';
      inc.setAttribute('aria-label', 'Increase quantity');
      inc.textContent = '+';

      var lid = line.id;
      dec.addEventListener('click', function () {
        var v = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
        qtyInput.value = String(v);
        legacySetLineQty(lid, v);
      });
      inc.addEventListener('click', function () {
        var v = (parseInt(qtyInput.value, 10) || 1) + 1;
        qtyInput.value = String(v);
        legacySetLineQty(lid, v);
      });
      qtyInput.addEventListener('change', function () {
        legacySetLineQty(lid, qtyInput.value);
      });

      qtyWrap.appendChild(dec);
      qtyWrap.appendChild(qtyInput);
      qtyWrap.appendChild(inc);
      controls.appendChild(qtyWrap);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'cart-page__remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', function () {
        legacyRemoveLine(lid);
      });
      controls.appendChild(removeBtn);

      var lineTot = document.createElement('div');
      lineTot.className = 'cart-page__line-total';
      lineTot.textContent = formatMoneyPlain(lineTotal(line));
      controls.appendChild(lineTot);

      li.appendChild(controls);
      listEl.appendChild(li);
    });

    if (subtotalEl) subtotalEl.textContent = formatMoneyPlain(subtotal);
    if (totalEl) totalEl.textContent = formatMoneyPlain(subtotal);

    if (shipMsg) {
      if (subtotal >= FREE_SHIP) {
        shipMsg.textContent = 'You qualify for free shipping.';
        shipMsg.className = 'cart-page__summary-note cart-page__summary-note--highlight';
      } else {
        var need = FREE_SHIP - subtotal;
        shipMsg.textContent =
          'Add ' +
          formatMoneyPlain(need) +
          ' more for free shipping (orders $' +
          FREE_SHIP +
          '+).';
        shipMsg.className = 'cart-page__summary-note';
      }
    }
  }

  function legacySetLineQty(id, qty) {
    var items = readCart();
    var line = items.find(function (l) {
      return String(l.id) === String(id);
    });
    if (!line) return;
    var q = parseInt(qty, 10);
    if (isNaN(q) || q < 1) q = 1;
    line.qty = q;
    writeCart(items);
    updateHeaderBadge();
    renderLegacyCartPage();
  }

  function legacyRemoveLine(id) {
    var items = readCart().filter(function (l) {
      return String(l.id) !== String(id);
    });
    writeCart(items);
    updateHeaderBadge();
    renderLegacyCartPage();
  }

  function bindCheckout() {
    var btn = document.getElementById('cart-checkout-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (shopifyMode()) {
        fetchShopifyCart().then(function (cart) {
          if (!cart || !cart.checkoutUrl) {
            alert('Your cart is empty or checkout is unavailable.');
            return;
          }
          window.location.href = cart.checkoutUrl;
        });
      } else {
        var items = readCart();
        if (items.length === 0) return;
        alert('Connect Shopify (see .env.example) to use checkout.');
      }
    });
  }

  function qtyForAddToCartButton(btn) {
    var row = btn.closest('[data-shop-card-cart]');
    if (row) {
      var input = row.querySelector('.shop-view__qty-input');
      if (input) {
        var n = parseInt(input.value, 10);
        if (!isNaN(n) && n >= 1) return Math.min(99, n);
      }
    }
    return 1;
  }

  function bindShopCardQtyControls() {
    var grid = document.getElementById('shop-product-grid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var dec = e.target.closest('.shop-view__qty-dec');
      var inc = e.target.closest('.shop-view__qty-inc');
      if (!dec && !inc) return;
      e.preventDefault();
      e.stopPropagation();
      var wrap = e.target.closest('[data-shop-card-cart]');
      if (!wrap) return;
      var input = wrap.querySelector('.shop-view__qty-input');
      if (!input || input.disabled) return;
      var v = parseInt(input.value, 10) || 1;
      if (dec) input.value = String(Math.max(1, v - 1));
      if (inc) input.value = String(Math.min(99, v + 1));
    });
    grid.addEventListener('change', function (e) {
      if (!e.target.classList || !e.target.classList.contains('shop-view__qty-input')) return;
      var n = parseInt(e.target.value, 10);
      if (isNaN(n) || n < 1) e.target.value = '1';
      else if (n > 99) e.target.value = '99';
      else e.target.value = String(n);
    });
  }

  function bindAddToCartButtons() {
    document.querySelectorAll('.js-add-to-cart').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var qty = qtyForAddToCartButton(btn);
        var variantId = btn.getAttribute('data-variant-id');
        if (shopifyMode() && variantId) {
          var original = btn.textContent;
          btn.disabled = true;
          shopifyAddLine(variantId, qty)
            .then(function () {
              btn.textContent = 'Added!';
              updateHeaderBadge();
              window.setTimeout(function () {
                btn.textContent = original;
                btn.disabled = false;
              }, 1600);
            })
            .catch(function (e) {
              btn.disabled = false;
              alert(e.message || 'Could not add to cart');
            });
          return;
        }

        var id = btn.getAttribute('data-product-id');
        var title = btn.getAttribute('data-product-title') || '';
        var price = btn.getAttribute('data-product-price');
        var image = btn.getAttribute('data-product-image') || '';
        var compare = btn.getAttribute('data-product-compare-price');
        legacyAddToCart(
          {
            id: id,
            title: title,
            price: price,
            image: image,
            comparePrice: compare || null
          },
          qty
        );
        var original = btn.textContent;
        btn.textContent = 'Added!';
        btn.disabled = true;
        window.setTimeout(function () {
          btn.textContent = original;
          btn.disabled = false;
        }, 1600);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindShopCardQtyControls();
    bindAddToCartButtons();
    bindCheckout();
    updateHeaderBadge();
    if (shopifyMode()) {
      renderShopifyCartPage();
    } else {
      renderLegacyCartPage();
    }
  });
})();
