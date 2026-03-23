(function () {
  'use strict';

  var STORAGE_KEY = 'playtimePetsCart';

  function readCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      /* ignore quota */
    }
  }

  function formatMoney(n) {
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

  function updateHeaderBadge() {
    var badge = document.getElementById('header-cart-badge');
    if (!badge) return;
    var items = readCart();
    var count = items.reduce(function (n, line) {
      return n + Math.max(1, parseInt(line.qty, 10) || 1);
    }, 0);
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function addToCart(product) {
    if (!product || product.id == null) return;
    var items = readCart();
    var id = String(product.id);
    var price = parseFloat(product.price, 10);
    if (isNaN(price)) price = 0;
    var found = items.find(function (l) {
      return String(l.id) === id;
    });
    if (found) {
      found.qty = Math.max(1, (parseInt(found.qty, 10) || 1) + 1);
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
        qty: 1
      });
    }
    writeCart(items);
    updateHeaderBadge();
  }

  function setLineQty(id, qty) {
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
    renderCartPage();
  }

  function removeLine(id) {
    var items = readCart().filter(function (l) {
      return String(l.id) !== String(id);
    });
    writeCart(items);
    updateHeaderBadge();
    renderCartPage();
  }

  function accentClass(id) {
    var n = parseInt(id, 10);
    if (isNaN(n)) n = 0;
    return 'cart-page__line--accent-' + (Math.abs(n) % 6);
  }

  function renderCartPage() {
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
      unit.textContent = formatMoney(parseFloat(line.price, 10));
      priceRow.appendChild(unit);

      if (line.comparePrice != null && line.comparePrice !== '') {
        var cmp = document.createElement('span');
        cmp.className = 'cart-page__line-compare';
        cmp.textContent = formatMoney(parseFloat(line.comparePrice, 10));
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
        setLineQty(lid, v);
      });
      inc.addEventListener('click', function () {
        var v = (parseInt(qtyInput.value, 10) || 1) + 1;
        qtyInput.value = String(v);
        setLineQty(lid, v);
      });
      qtyInput.addEventListener('change', function () {
        setLineQty(lid, qtyInput.value);
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
        removeLine(lid);
      });
      controls.appendChild(removeBtn);

      var lineTot = document.createElement('div');
      lineTot.className = 'cart-page__line-total';
      lineTot.textContent = formatMoney(lineTotal(line));
      controls.appendChild(lineTot);

      li.appendChild(controls);
      listEl.appendChild(li);
    });

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (totalEl) totalEl.textContent = formatMoney(subtotal);

    if (shipMsg) {
      if (subtotal >= FREE_SHIP) {
        shipMsg.textContent = 'You qualify for free shipping.';
        shipMsg.className = 'cart-page__summary-note cart-page__summary-note--highlight';
      } else {
        var need = FREE_SHIP - subtotal;
        shipMsg.textContent =
          'Add ' + formatMoney(need) + ' more for free shipping (orders $' + FREE_SHIP + '+).';
        shipMsg.className = 'cart-page__summary-note';
      }
    }
  }

  function bindAddToCartButtons() {
    document.querySelectorAll('.js-add-to-cart').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-product-id');
        var title = btn.getAttribute('data-product-title') || '';
        var price = btn.getAttribute('data-product-price');
        var image = btn.getAttribute('data-product-image') || '';
        var compare = btn.getAttribute('data-product-compare-price');
        addToCart({
          id: id,
          title: title,
          price: price,
          image: image,
          comparePrice: compare || null
        });
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
    updateHeaderBadge();
    bindAddToCartButtons();
    renderCartPage();
  });
})();
