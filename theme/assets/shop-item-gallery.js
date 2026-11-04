(function () {
  'use strict';

  function init(root) {
    var main = root.querySelector('.js-product-gallery-main');
    var thumbs = root.querySelectorAll('.shop-item-show__thumb');
    var prevBtn = root.querySelector('.shop-item-show__gallery-nav--prev');
    var nextBtn = root.querySelector('.shop-item-show__gallery-nav--next');

    if (!main || thumbs.length < 2) return;

    var urls = Array.prototype.map.call(thumbs, function (btn) {
      var im = btn.querySelector('img');
      return im ? im.getAttribute('src') || '' : '';
    });

    var index = 0;

    function setIndex(i) {
      index = (i + urls.length) % urls.length;
      if (urls[index]) main.src = urls[index];
      Array.prototype.forEach.call(thumbs, function (btn, j) {
        var on = j === index;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    Array.prototype.forEach.call(thumbs, function (btn, j) {
      btn.addEventListener('click', function () {
        setIndex(j);
      });
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { setIndex(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { setIndex(index + 1); });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex(index + 1);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('.js-product-gallery');
    if (root) init(root);
  });
})();
