(function () {
  'use strict';

  function bindCard(card) {
    if (card.getAttribute('data-shop-gallery-bound') === '1') return;
    card.setAttribute('data-shop-gallery-bound', '1');
    var prev = card.querySelector('.shop-view__card-nav--prev');
    var next = card.querySelector('.shop-view__card-nav--next');
    var slides = card.querySelectorAll('.shop-view__card-slide');
    if (!prev || !next || slides.length < 2) return;

    var index = 0;
    var titleEl = card.querySelector('.shop-view__product-title');
    var titleText = titleEl ? titleEl.textContent.trim() : '';

    function syncAlt() {
      Array.prototype.forEach.call(slides, function (slide, j) {
        slide.setAttribute('alt', j === index && titleText ? titleText : '');
      });
    }

    function go(delta) {
      index = (index + delta + slides.length) % slides.length;
      Array.prototype.forEach.call(slides, function (slide, j) {
        slide.classList.toggle('is-active', j === index);
      });
      syncAlt();
    }

    prev.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      go(-1);
    });

    next.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      go(1);
    });
  }

  function bindShopCardGallery(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-shop-product]').forEach(bindCard);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindShopCardGallery(document);
  });

  window.__playtimeBindShopCardGallery = bindShopCardGallery;
})();
