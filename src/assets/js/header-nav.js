(function () {
  'use strict';

  var nav = document.querySelector('.site-header__nav--cascade');
  if (!nav) return;

  var mq = window.matchMedia('(max-width: 767px)');
  var branches = nav.querySelectorAll('.site-header__nav-branch--sub');

  function closeAll() {
    branches.forEach(function (branch) {
      branch.classList.remove('is-open');
      var btn = branch.querySelector('.site-header__nav-trigger');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function setOpen(branch, open) {
    if (!mq.matches) return;
    branches.forEach(function (b) {
      var isTarget = b === branch;
      b.classList.toggle('is-open', open && isTarget);
      var btn = b.querySelector('.site-header__nav-trigger');
      if (btn) btn.setAttribute('aria-expanded', open && isTarget ? 'true' : 'false');
    });
  }

  branches.forEach(function (branch) {
    var btn = branch.querySelector('.site-header__nav-trigger');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      if (!mq.matches) return;
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !branch.classList.contains('is-open');
      if (willOpen) setOpen(branch, true);
      else closeAll();
    });
  });

  document.addEventListener('click', function (e) {
    if (!mq.matches) return;
    if (!nav.contains(e.target)) closeAll();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAll();
  });

  mq.addEventListener('change', function () {
    if (!mq.matches) closeAll();
  });
})();
