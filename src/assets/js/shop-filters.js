/**
 * Shop filters: selections are staged until "Apply filters" is clicked (no reload).
 */
(function () {
  'use strict';

  /**
   * Multi-selects: all selected values.
   * Single-selects: [value] or [] when placeholder (empty value).
   */
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

  function matchesPrice(price, selectedRanges) {
    if (!selectedRanges.length) return true;
    var p = parseFloat(price, 10);
    return selectedRanges.some(function (rangeStr) {
      var parts = rangeStr.split('-');
      var min = parseFloat(parts[0], 10);
      var max = parseFloat(parts[1], 10);
      return p >= min && p <= max;
    });
  }

  function matchesRating(productRating, selectedMins) {
    if (!selectedMins.length) return true;
    var r = parseFloat(productRating, 10);
    var minRequired = Math.max.apply(
      null,
      selectedMins.map(function (x) {
        return parseFloat(x, 10);
      })
    );
    return r >= minRequired;
  }

  function applyFilters() {
    var cards = document.querySelectorAll('[data-shop-product]');
    var brands = getSelectValues('filter-brand');
    var animals = getSelectValues('filter-animal');
    var categories = getSelectValues('filter-category');
    var breedSizes = getSelectValues('filter-breed');
    var materials = getSelectValues('filter-material');
    var prices = getSelectValues('filter-price');
    var ratings = getSelectValues('filter-rating');

    var visible = 0;
    cards.forEach(function (card) {
      var ok =
        matchesOrAttr(card.getAttribute('data-brand') || '', brands) &&
        matchesAnimal(card.getAttribute('data-animal') || '', animals) &&
        matchesOrAttr(card.getAttribute('data-category') || '', categories) &&
        matchesBreedSize(card.getAttribute('data-breed-size') || '', breedSizes) &&
        matchesOrAttr(card.getAttribute('data-material') || '', materials) &&
        matchesPrice(card.getAttribute('data-price') || '0', prices) &&
        matchesRating(card.getAttribute('data-rating') || '0', ratings);

      card.hidden = !ok;
      if (ok) visible += 1;
    });

    var countEl = document.getElementById('shop-results-count');
    if (countEl) {
      countEl.textContent = visible === 1 ? '1 product' : visible + ' products';
    }

    var noMatch = document.getElementById('shop-no-matches');
    if (noMatch) {
      noMatch.hidden = visible !== 0;
    }
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

  document.addEventListener('DOMContentLoaded', function () {
    var applyBtn = document.getElementById('shop-filters-apply');
    var clearBtn = document.getElementById('shop-filters-clear');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    // Prevent accidental form submit (if wrapped in form later)
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
