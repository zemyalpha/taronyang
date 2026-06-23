(function () {
  'use strict';

  function initShareButtons() {
    var containers = document.querySelectorAll('[data-share]');
    containers.forEach(function (container) {
      if (container.dataset.shareInitialized) return;
      container.dataset.shareInitialized = 'true';

      var url = container.dataset.shareUrl || window.location.href;
      var title = container.dataset.shareTitle || document.title;
      var desc = container.dataset.shareDesc || '';
      var via = 'taronyang';

      container.innerHTML = ''
        + '<p class="share-label">이 페이지 공유하기</p>'
        + '<div class="share-buttons">'
        +   '<button type="button" class="share-btn share-btn-kakao" data-share-target="kakao" aria-label="카카오톡으로 공유">'
        +     '<span class="share-btn-icon" aria-hidden="true">💬</span> 카카오톡'
        +   '</button>'
        +   '<a class="share-btn share-btn-twitter" target="_blank" rel="noopener" aria-label="트위터(X)로 공유" href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title) + '&via=' + via + '">'
        +     '<span class="share-btn-icon" aria-hidden="true">𝕏</span> X'
        +   '</a>'
        +   '<a class="share-btn share-btn-facebook" target="_blank" rel="noopener" aria-label="페이스북으로 공유" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">'
        +     '<span class="share-btn-icon" aria-hidden="true">f</span> Facebook'
        +   '</a>'
        +   '<button type="button" class="share-btn share-btn-copy" data-share-target="copy" aria-label="링크 복사">'
        +     '<span class="share-btn-icon" aria-hidden="true">🔗</span> 링크 복사'
        +   '</button>'
        + '</div>';

      var kakaoBtn = container.querySelector('[data-share-target="kakao"]');
      if (kakaoBtn) {
        kakaoBtn.addEventListener('click', function () {
          if (window.Kakao && window.Kakao.Share) {
            window.Kakao.Share.sendDefault({
              objectType: 'feed',
              content: {
                title: title,
                description: desc,
                imageUrl: container.dataset.shareImage || '',
                link: { mobileWebUrl: url, webUrl: url }
              }
            });
          } else {
            window.open('https://sharer.kakao.com/talk/friends/picker/link?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title), '_blank', 'noopener');
          }
        });
      }

      var copyBtn = container.querySelector('[data-share-target="copy"]');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
              copyBtn.classList.add('share-btn-copied');
              copyBtn.innerHTML = '<span class="share-btn-icon" aria-hidden="true">✓</span> 복사됨';
              setTimeout(function () {
                copyBtn.classList.remove('share-btn-copied');
                copyBtn.innerHTML = '<span class="share-btn-icon" aria-hidden="true">🔗</span> 링크 복사';
              }, 2000);
            }).catch(function () {
              fallbackCopy(url, copyBtn);
            });
          } else {
            fallbackCopy(url, copyBtn);
          }
        });
      }
    });
  }

  function fallbackCopy(url, btn) {
    var textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(textarea);
    btn.classList.add('share-btn-copied');
    btn.innerHTML = '<span class="share-btn-icon" aria-hidden="true">✓</span> 복사됨';
    setTimeout(function () {
      btn.classList.remove('share-btn-copied');
      btn.innerHTML = '<span class="share-btn-icon" aria-hidden="true">🔗</span> 링크 복사';
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareButtons);
  } else {
    initShareButtons();
  }

  window.TaronyangShare = { init: initShareButtons };
})();
