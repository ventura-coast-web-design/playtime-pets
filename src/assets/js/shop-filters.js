/**
 * Shop filters: selections apply on "Apply filters". When any filter is active,
 * results come from the full catalog JSON (pagination only loads one page of HTML).
 */
(function () {
  'use strict';

  var CATALOG_URL = '/assets/data/shop-catalog.json';
  var PAGE_SIZE = 20;

  var grid = null;
  var gridSnapshot = '';
  var countEl = null;
  var originalCountText = '';
  var paginationEl = null;
  var paginationSnapshot = '';
  var noMatchEl = null;
  var catalog = null;
  var catalogPromise = null;
  var filteredMode = false;
  var filteredPage = 1;
  var lastMatchedProducts = [];
  var lastCatalogTotal = 0;

  function getSelectValues(name) {
    var el = document.querySelector('select[name="' + name + '"]');
    if (!el) return [];
    if (el.multiple) {
      return Array.from(el.selectedOptions).map(function (opt) {
        return opt.value;
      });
    }
    return el.value ? [el.value] : [];
  }

  function getFilterCriteria() {
    return {
      brands: getSelectValues('filter-brand'),
      animals: getSelectValues('filter-animal'),
      categories: getSelectValues('filter-collection'),
      breedSizes: getSelectValues('filter-breed'),
      materials: getSelectValues('filter-material'),
      prices: getSelectValues('filter-price'),
      ratings: getSelectValues('filter-rating')
    };
  }

  function criteriaActive(c) {
    return (
      c.brands.length > 0 ||
      c.animals.length > 0 ||
      c.categories.length > 0 ||
      c.breedSizes.length > 0 ||
      c.materials.length > 0 ||
      c.prices.length > 0 ||
      c.ratings.length > 0
    );
  }

  function matchesAnimal(productAnimal, selected) {
    if (!selected.length) return true;
    return selected.some(function (s) {
      if (s === 'dog') return productAnimal === 'dog' || productAnimal === 'both';
      if (s === 'cat') return productAnimal === 'cat' || productAnimal === 'both';
      if (s === 'both') return productAnimal === 'both';
      return productAnimal === s;
    });
  }

  function matchesBreedSize(productSize, selected) {
    if (!selected.length) return true;
    return selected.some(function (s) {
      return productSize === s || productSize === 'all';
    });
  }

  function matchesOrAttr(productValue, selected) {
    if (!selected.length) return true;
    return selected.indexOf(productValue) !== -1;
  }

  function parseCollectionTitles(raw) {
    if (!raw) return [];
    return String(raw)
      .split('|')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function collectionTitlesFromProduct(raw) {
    if (Array.isArray(raw)) {
      return raw
        .map(function (c) {
          if (typeof c === 'string') return c.trim();
          return c && c.title != null ? String(c.title).trim() : '';
        })
        .filter(Boolean);
    }
    return parseCollectionTitles(raw);
  }

  function collectionTitlesAttr(collections) {
    return collectionTitlesFromProduct(collections).join('|');
  }

  function matchesCollections(productCollections, selected) {
    if (!selected.length) return true;
    var titles = collectionTitlesFromProduct(productCollections);
    if (!titles.length) return false;
    return selected.some(function (s) {
      return titles.indexOf(s) !== -1;
    });
  }

  function matchesPrice(price, selectedRanges) {
    if (!selectedRanges.length) return true;
    var p = parseFloat(String(price), 10);
    return selectedRanges.some(function (rangeStr) {
      var parts = rangeStr.split('-');
      var min = parseFloat(parts[0], 10);
      var max = parseFloat(parts[1], 10);
      return p >= min && p <= max;
    });
  }

  function matchesRating(productRating, selectedMins) {
    if (!selectedMins.length) return true;
    var r = parseFloat(String(productRating), 10);
    var minRequired = Math.max.apply(
      null,
      selectedMins.map(function (x) {
        return parseFloat(x, 10);
      })
    );
    return r >= minRequired;
  }

  function productMatches(p, c) {
    var breed = p.breedSize != null ? String(p.breedSize) : '';
    return (
      matchesOrAttr(p.brand != null ? String(p.brand) : '', c.brands) &&
      matchesAnimal(p.animal != null ? String(p.animal) : '', c.animals) &&
      matchesCollections(p.collections, c.categories) &&
      matchesBreedSize(breed, c.breedSizes) &&
      matchesOrAttr(p.material != null ? String(p.material) : '', c.materials) &&
      matchesPrice(p.price != null ? p.price : '0', c.prices) &&
      matchesRating(p.rating != null ? p.rating : '0', c.ratings)
    );
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;');
  }

  function productImageUrls(p) {
    if (p.images && p.images.length) return p.images;
    if (p.image) return [p.image];
    return [];
  }

  function buildProductCard(p) {
    var urls = productImageUrls(p);
    var colorIx =
      typeof p.accentIndex === 'number'
        ? Math.abs(p.accentIndex) % 6
        : Math.abs(parseInt(p.id, 10) || 0) % 6;
    var inStock = Boolean(p.inStock);
    var priceStr = String(p.price != null ? p.price : '');
    var compare = p.comparePrice != null ? String(p.comparePrice) : '';
    var title = p.title != null ? String(p.title) : '';
    var handle = p.handle != null ? String(p.handle) : '';
    var id = p.id != null ? String(p.id) : '0';

    var article = document.createElement('article');
    article.className =
      'shop-view__product-card shop-view__product-card--color-' + colorIx;
    article.setAttribute('data-shop-product', '');
    article.setAttribute('data-brand', p.brand != null ? String(p.brand) : '');
    article.setAttribute('data-animal', p.animal != null ? String(p.animal) : '');
    article.setAttribute('data-collections', collectionTitlesAttr(p.collections));
    article.setAttribute('data-breed-size', p.breedSize != null ? String(p.breedSize) : '');
    article.setAttribute('data-material', p.material != null ? String(p.material) : '');
    article.setAttribute('data-price', priceStr);
    article.setAttribute('data-rating', p.rating != null ? String(p.rating) : '');

    var media = document.createElement('div');
    media.className = 'shop-view__product-media';

    var imgWrap = document.createElement('div');
    imgWrap.className = 'shop-view__product-image';

    var fillLink = document.createElement('a');
    fillLink.href = '/shop/' + encodeURIComponent(handle) + '/';
    fillLink.className = 'shop-view__product-link-fill';
    fillLink.setAttribute('aria-label', 'View ' + title);
    imgWrap.appendChild(fillLink);

    urls.forEach(function (url, i) {
      var img = document.createElement('img');
      img.className = 'shop-view__card-slide' + (i === 0 ? ' is-active' : '');
      img.src = url;
      img.alt = i === 0 ? title : '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 400;
      img.height = 400;
      imgWrap.appendChild(img);
    });

    if (compare) {
      var badge = document.createElement('span');
      badge.className = 'shop-view__sale-badge';
      badge.textContent = 'Sale';
      imgWrap.appendChild(badge);
    }

    media.appendChild(imgWrap);

    if (urls.length > 1) {
      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'shop-view__card-nav shop-view__card-nav--prev';
      prev.setAttribute('aria-label', 'Previous product image');
      prev.innerHTML = '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';
      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'shop-view__card-nav shop-view__card-nav--next';
      next.setAttribute('aria-label', 'Next product image');
      next.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';
      media.appendChild(prev);
      media.appendChild(next);
    }

    var info = document.createElement('div');
    info.className = 'shop-view__product-info';

    var titleLink = document.createElement('a');
    titleLink.href = '/shop/' + encodeURIComponent(handle) + '/';
    titleLink.className = 'shop-view__product-link-title';
    titleLink.title = title;
    var h3 = document.createElement('h3');
    h3.className = 'shop-view__product-title';
    h3.textContent = title;
    titleLink.appendChild(h3);
    info.appendChild(titleLink);

    var priceRow = document.createElement('div');
    priceRow.className = 'shop-view__product-price-row';

    var priceBlock = document.createElement('div');
    priceBlock.className = 'shop-view__product-price';
    if (compare) {
      var orig = document.createElement('span');
      orig.className = 'shop-view__price-original';
      orig.textContent = '$' + compare;
      var cur = document.createElement('span');
      cur.className = 'shop-view__price-current';
      cur.textContent = '$' + priceStr;
      priceBlock.appendChild(orig);
      priceBlock.appendChild(cur);
    } else {
      var curOnly = document.createElement('span');
      curOnly.className = 'shop-view__price-current';
      curOnly.textContent = '$' + priceStr;
      priceBlock.appendChild(curOnly);
    }
    priceRow.appendChild(priceBlock);

    var cartWrap = document.createElement('div');
    cartWrap.className = 'shop-view__card-cart';
    cartWrap.setAttribute('data-shop-card-cart', '');

    var qty = document.createElement('div');
    qty.className = 'shop-view__qty';
    var dec = document.createElement('button');
    dec.type = 'button';
    dec.className = 'shop-view__qty-btn shop-view__qty-dec';
    dec.setAttribute('aria-label', 'Decrease quantity');
    dec.textContent = '−';
    if (!inStock) dec.disabled = true;

    var lab = document.createElement('label');
    lab.className = 'shop-view__qty-label';
    lab.setAttribute('for', 'shop-qty-' + id);
    lab.textContent = 'Quantity';

    var input = document.createElement('input');
    input.id = 'shop-qty-' + id;
    input.className = 'shop-view__qty-input';
    input.type = 'number';
    input.name = 'quantity';
    input.value = '1';
    input.min = '1';
    input.max = '99';
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', 'Quantity for ' + title);
    if (!inStock) input.disabled = true;

    var inc = document.createElement('button');
    inc.type = 'button';
    inc.className = 'shop-view__qty-btn shop-view__qty-inc';
    inc.setAttribute('aria-label', 'Increase quantity');
    inc.textContent = '+';
    if (!inStock) inc.disabled = true;

    qty.appendChild(dec);
    qty.appendChild(lab);
    qty.appendChild(input);
    qty.appendChild(inc);

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'shop-view__add-btn js-add-to-cart';
    addBtn.setAttribute('data-product-handle', handle);
    if (p.variantId) addBtn.setAttribute('data-variant-id', String(p.variantId));
    addBtn.setAttribute('data-product-id', id);
    addBtn.setAttribute('data-product-title', escapeAttr(title));
    addBtn.setAttribute('data-product-price', priceStr);
    if (urls[0]) addBtn.setAttribute('data-product-image', urls[0]);
    if (compare) addBtn.setAttribute('data-product-compare-price', compare);
    if (!inStock) addBtn.disabled = true;
    addBtn.textContent = inStock ? 'Add to cart' : 'Out of stock';

    cartWrap.appendChild(qty);
    cartWrap.appendChild(addBtn);
    priceRow.appendChild(cartWrap);
    info.appendChild(priceRow);

    article.appendChild(media);
    article.appendChild(info);
    return article;
  }

  function setPaginationVisible(visible) {
    if (!paginationEl) return;
    if (visible) {
      paginationEl.hidden = false;
      paginationEl.classList.remove('shop-view__pagination--suppressed');
    } else {
      paginationEl.hidden = true;
      paginationEl.classList.add('shop-view__pagination--suppressed');
    }
  }

  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    var embedded = document.getElementById('shop-catalog-data');
    if (embedded && embedded.textContent.trim()) {
      try {
        var parsed = JSON.parse(embedded.textContent);
        if (Array.isArray(parsed) && parsed.length) {
          catalog = parsed;
          return Promise.resolve(catalog);
        }
      } catch (e) {
        /* fall through to fetch */
      }
    }
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch(CATALOG_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('catalog fetch ' + res.status);
        return res.json();
      })
      .then(function (data) {
        catalog = Array.isArray(data) ? data : [];
        return catalog;
      })
      .catch(function () {
        catalogPromise = null;
        return null;
      });
    return catalogPromise;
  }

  function bindGallery(root) {
    if (window.__playtimeBindShopCardGallery) {
      window.__playtimeBindShopCardGallery(root || grid);
    }
  }

  function setNoMatches(visible) {
    if (noMatchEl) noMatchEl.hidden = visible !== 0;
  }

  /** @returns {Array<number|string>} */
  function getPaginationPages(current, total) {
    if (total <= 7) {
      var all = [];
      for (var i = 1; i <= total; i++) all.push(i);
      return all;
    }
    var set = {};
    set[1] = true;
    set[total] = true;
    for (var p = current - 2; p <= current + 2; p++) {
      if (p >= 1 && p <= total) set[p] = true;
    }
    var nums = Object.keys(set)
      .map(function (k) {
        return parseInt(k, 10);
      })
      .sort(function (a, b) {
        return a - b;
      });
    var out = [];
    for (var j = 0; j < nums.length; j++) {
      if (j > 0 && nums[j] - nums[j - 1] > 1) out.push('ellipsis');
      out.push(nums[j]);
    }
    return out;
  }

  function shopPageUrl(page) {
    if (page <= 1) return '/shop/';
    return '/shop/page/' + page + '/';
  }

  function paginationJumpFormHtml(totalPages) {
    return (
      '<form class="shop-view__pagination-jump" data-shop-pagination-jump data-total-pages="' +
      totalPages +
      '" action="#" method="get">' +
      '<label class="shop-view__pagination-jump-label" for="shop-page-jump-input">Go to page</label>' +
      '<input id="shop-page-jump-input" class="shop-view__pagination-jump-input" name="page" type="number" min="1" max="' +
      totalPages +
      '" inputmode="numeric" aria-label="Page number">' +
      '<button type="submit" class="shop-view__pagination-link shop-view__pagination-link--control">Go</button>' +
      '</form>'
    );
  }

  function paginationControlLink(label, page) {
    return (
      '<a class="shop-view__pagination-link shop-view__pagination-link--control" href="#" data-filter-page="' +
      page +
      '">' +
      label +
      '</a>'
    );
  }

  function paginationDisabledControl(label) {
    return (
      '<span class="shop-view__pagination-link shop-view__pagination-link--control is-disabled" aria-disabled="true">' +
      label +
      '</span>'
    );
  }

  function renderFilteredPagination(totalMatched, page) {
    if (!paginationEl) return;
    var totalPages = Math.max(1, Math.ceil(totalMatched / PAGE_SIZE));
    page = Math.max(1, Math.min(page, totalPages));

    if (totalPages <= 1) {
      setPaginationVisible(false);
      return;
    }

    setPaginationVisible(true);
    var items = getPaginationPages(page, totalPages);
    var html = '<div class="shop-view__pagination-controls">';

    if (page > 1) {
      html += paginationControlLink('First', 1);
      html += paginationControlLink('Back', page - 1);
    } else {
      html += paginationDisabledControl('First');
      html += paginationDisabledControl('Back');
    }

    html += '<div class="shop-view__pagination-pages">';
    items.forEach(function (item) {
      if (item === 'ellipsis') {
        html += '<span class="shop-view__pagination-ellipsis" aria-hidden="true">…</span>';
      } else if (item === page) {
        html +=
          '<span class="shop-view__pagination-link is-current" aria-current="page">' +
          item +
          '</span>';
      } else {
        html +=
          '<a class="shop-view__pagination-link" href="#" data-filter-page="' +
          item +
          '">' +
          item +
          '</a>';
      }
    });
    html += '</div>';

    if (page < totalPages) {
      html += paginationControlLink('Next', page + 1);
      html += paginationControlLink('Last', totalPages);
    } else {
      html += paginationDisabledControl('Next');
      html += paginationDisabledControl('Last');
    }

    html += '</div>';
    html += paginationJumpFormHtml(totalPages);

    paginationEl.innerHTML = html;
  }

  function updateFilteredCountText(matchedCount, page, catalogTotal) {
    if (!countEl) return;
    if (matchedCount === 0) {
      countEl.textContent = 'Showing 0 of ' + catalogTotal + ' products';
      return;
    }
    var totalPages = Math.ceil(matchedCount / PAGE_SIZE) || 1;
    if (totalPages <= 1) {
      countEl.textContent =
        matchedCount === 1
          ? 'Showing 1 of ' + catalogTotal + ' products'
          : 'Showing ' + matchedCount + ' of ' + catalogTotal + ' products';
      return;
    }
    var start = (page - 1) * PAGE_SIZE;
    var from = start + 1;
    var to = Math.min(start + PAGE_SIZE, matchedCount);
    countEl.textContent =
      'Showing ' + from + '–' + to + ' of ' + matchedCount + ' products (' + catalogTotal + ' total)';
  }

  function renderFilteredPage(matched, page, catalogTotal) {
    if (!grid) return;
    var totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    page = Math.max(1, Math.min(page, totalPages));
    filteredPage = page;

    var start = (page - 1) * PAGE_SIZE;
    var slice = matched.slice(start, start + PAGE_SIZE);

    grid.innerHTML = '';
    slice.forEach(function (p) {
      grid.appendChild(buildProductCard(p));
    });

    filteredMode = true;
    updateFilteredCountText(matched.length, page, catalogTotal);
    renderFilteredPagination(matched.length, page);
    setNoMatches(matched.length);
    bindGallery(grid);
  }

  function goToFilteredPage(page) {
    if (!filteredMode || !lastMatchedProducts.length) return;
    renderFilteredPage(lastMatchedProducts, page, lastCatalogTotal);
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function bindFilteredPagination() {
    var main = document.querySelector('.shop-view__catalog-main');
    if (!main || main.getAttribute('data-filter-pagination-bound')) return;
    main.setAttribute('data-filter-pagination-bound', '1');
    main.addEventListener('click', function (e) {
      if (!filteredMode) return;
      var link = e.target.closest('[data-filter-page]');
      if (!link) return;
      e.preventDefault();
      var page = parseInt(link.getAttribute('data-filter-page'), 10);
      if (isNaN(page)) return;
      goToFilteredPage(page);
    });
    main.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-shop-pagination-jump]');
      if (!form) return;
      e.preventDefault();
      var total = parseInt(form.getAttribute('data-total-pages'), 10);
      var input = form.querySelector('input[name="page"]');
      var page = parseInt(input && input.value, 10);
      if (isNaN(page) || page < 1) return;
      if (!isNaN(total) && total > 0) page = Math.min(page, total);
      if (filteredMode) {
        goToFilteredPage(page);
        return;
      }
      window.location.href = shopPageUrl(page);
    });
  }

  function restorePaginationFromSnapshot() {
    if (!paginationSnapshot) return;
    var main = document.querySelector('.shop-view__catalog-main');
    if (!main) return;
    var existing = main.querySelector('nav.shop-view__pagination');
    var wrap = document.createElement('div');
    wrap.innerHTML = paginationSnapshot;
    var fresh = wrap.firstElementChild;
    if (!fresh) return;
    if (existing) {
      existing.replaceWith(fresh);
    } else {
      var gridWrapper = document.querySelector('.shop-view__grid-wrapper');
      if (gridWrapper && gridWrapper.nextElementSibling) {
        gridWrapper.parentNode.insertBefore(fresh, gridWrapper.nextElementSibling);
      } else if (gridWrapper) {
        gridWrapper.after(fresh);
      }
    }
    paginationEl = main.querySelector('nav.shop-view__pagination');
  }

  /** @returns {number} visible count */
  function updateCardVisibility(c) {
    var cards = document.querySelectorAll('[data-shop-product]');
    var visible = 0;
    cards.forEach(function (card) {
      var ok =
        matchesOrAttr(card.getAttribute('data-brand') || '', c.brands) &&
        matchesAnimal(card.getAttribute('data-animal') || '', c.animals) &&
        matchesCollections(card.getAttribute('data-collections') || '', c.categories) &&
        matchesBreedSize(card.getAttribute('data-breed-size') || '', c.breedSizes) &&
        matchesOrAttr(card.getAttribute('data-material') || '', c.materials) &&
        matchesPrice(card.getAttribute('data-price') || '0', c.prices) &&
        matchesRating(card.getAttribute('data-rating') || '0', c.ratings);
      card.hidden = !ok;
      if (ok) visible += 1;
    });
    return visible;
  }

  function applyFiltersDomOnly(c) {
    var visible = updateCardVisibility(c);
    if (countEl) {
      countEl.textContent =
        visible === 1 ? '1 product' : visible + ' products';
    }
    if (criteriaActive(c)) setPaginationVisible(false);
    setNoMatches(visible);
  }

  function restoreBrowseMode() {
    if (!grid || !gridSnapshot) return;
    grid.innerHTML = gridSnapshot;
    filteredMode = false;
    filteredPage = 1;
    lastMatchedProducts = [];
    restorePaginationFromSnapshot();
    if (countEl) countEl.textContent = originalCountText;
    setPaginationVisible(true);
    bindGallery(grid);
  }

  function renderFilteredGrid(list, c) {
    lastCatalogTotal = list.length;
    lastMatchedProducts = list.filter(function (p) {
      return productMatches(p, c);
    });
    renderFilteredPage(lastMatchedProducts, 1, lastCatalogTotal);
  }

  function applyFilters() {
    var c = getFilterCriteria();
    if (!grid) return;

    if (!criteriaActive(c)) {
      if (filteredMode) restoreBrowseMode();
      var visBrowse = updateCardVisibility(c);
      setNoMatches(visBrowse);
      if (countEl) countEl.textContent = originalCountText;
      return;
    }

    loadCatalog().then(function (list) {
      if (!list || !list.length) {
        if (filteredMode) restoreBrowseMode();
        applyFiltersDomOnly(c);
        return;
      }
      renderFilteredGrid(list, c);
    });
  }

  function clearFilters() {
    document.querySelectorAll('.shop-filters select').forEach(function (sel) {
      if (sel.multiple) {
        Array.from(sel.options).forEach(function (opt) {
          opt.selected = false;
        });
      } else {
        sel.selectedIndex = 0;
      }
    });
    applyFilters();
  }

  function bindFilterSelectChanges() {
    document.querySelectorAll('.shop-filters select').forEach(function (sel) {
      sel.addEventListener('change', applyFilters);
    });
  }

  function bindMobileFiltersDrawer() {
    var panel = document.querySelector('.shop-filters-panel');
    var toggle = document.getElementById('shop-filters-toggle');
    if (!panel || !toggle) return;

    var mq = window.matchMedia('(min-width: 992px)');

    function setDrawerOpen(open) {
      if (mq.matches) {
        panel.classList.remove('shop-filters-panel--open');
        toggle.setAttribute('aria-expanded', 'true');
        return;
      }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) panel.classList.add('shop-filters-panel--open');
      else panel.classList.remove('shop-filters-panel--open');
    }

    toggle.addEventListener('click', function () {
      if (mq.matches) return;
      setDrawerOpen(!panel.classList.contains('shop-filters-panel--open'));
    });

    mq.addEventListener('change', function () {
      if (mq.matches) {
        panel.classList.remove('shop-filters-panel--open');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    if (mq.matches) {
      toggle.setAttribute('aria-expanded', 'true');
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (mq.matches) return;
      if (!panel.classList.contains('shop-filters-panel--open')) return;
      setDrawerOpen(false);
      toggle.focus();
    });

    var applyBtn = document.getElementById('shop-filters-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        if (mq.matches) return;
        setDrawerOpen(false);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    grid = document.getElementById('shop-product-grid');
    countEl = document.getElementById('shop-results-count');
    paginationEl = document.querySelector('.shop-view__catalog-main nav.shop-view__pagination');
    if (paginationEl) paginationSnapshot = paginationEl.outerHTML;
    noMatchEl = document.getElementById('shop-no-matches');
    if (grid) gridSnapshot = grid.innerHTML;
    if (countEl) originalCountText = countEl.textContent;

    bindFilteredPagination();
    bindMobileFiltersDrawer();
    bindFilterSelectChanges();

    var applyBtn = document.getElementById('shop-filters-apply');
    var clearBtn = document.getElementById('shop-filters-clear');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    var form = document.getElementById('shop-filters-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        applyFilters();
      });
    }

    applyFilters();
  });
})();
