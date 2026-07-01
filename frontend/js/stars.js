(function () {
  'use strict';

  function initStars() {
    var starsEl = document.getElementById('stars');
    if (!starsEl) return;

    var count = parseInt(starsEl.getAttribute('data-star-count'), 10);
    if (isNaN(count)) count = 30;

    for (var i = 0; i < count; i++) {
      var star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDuration = (2 + Math.random() * 3) + 's';
      star.style.animationDelay = Math.random() * 3 + 's';
      starsEl.appendChild(star);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStars);
  } else {
    initStars();
  }
})();
