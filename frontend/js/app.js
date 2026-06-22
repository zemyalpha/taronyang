// 🔮 타로냥 - 메인 JS
const API_BASE = window.location.origin + '/api';

console.log('🔮 타로냥 로딩 완료');

// === PWA: Service Worker 등록 ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // 업데이트 감지 시 자동 적용
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // 기존 SW가 제어 중이고 새 SW가 설치됨 → 즉시 활성화
              newWorker.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((err) => console.warn('[PWA] SW 등록 실패:', err));
  });
}

// === PWA: 홈스크린 설치 프롬프트 (Android Chrome) ===
let deferredInstallPrompt = null;
const INSTALL_DISMISS_KEY = 'taronyang_install_dismissed_at';
const INSTALL_SHOW_DELAY_MS = 8000; // 8초 후 배너 노출
const INSTALL_RESHOW_DAYS = 30; // 거부 후 30일 경과 시 재노출

function shouldShowInstallBanner() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
    if (!dismissedAt) return true;
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince >= INSTALL_RESHOW_DAYS;
  } catch (_) {
    return true;
  }
}

function markInstallDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  } catch (_) {
    /* localStorage 사용 불가 시 무시 */
  }
}

function buildInstallBanner() {
  const banner = document.createElement('div');
  banner.id = 'taronyang-install-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', '앱 설치');
  banner.innerHTML = `
    <div class="ti-icon" aria-hidden="true">🔮</div>
    <div class="ti-text">
      <strong>타로냥 앱으로 설치</strong>
      <span>홈스크린에 추가해 언제든 타로 보기</span>
    </div>
    <button type="button" class="ti-install" aria-label="설치">설치</button>
    <button type="button" class="ti-close" aria-label="닫기">×</button>
  `;
  return banner;
}

function injectInstallStyles() {
  if (document.getElementById('taronyang-install-styles')) return;
  const style = document.createElement('style');
  style.id = 'taronyang-install-styles';
  style.textContent = `
    #taronyang-install-banner{
      position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(120%);
      width:calc(100% - 24px);max-width:440px;
      background:#1a1a3e;border:1px solid rgba(167,139,250,.35);
      border-radius:16px;padding:12px 14px;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 10px 40px rgba(0,0,0,.45);
      z-index:9999;transition:transform .35s cubic-bezier(.2,.8,.2,1);
      font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;
    }
    #taronyang-install-banner.show{transform:translateX(-50%) translateY(0);}
    #taronyang-install-banner .ti-icon{font-size:28px;line-height:1;}
    #taronyang-install-banner .ti-text{flex:1;display:flex;flex-direction:column;gap:2px;}
    #taronyang-install-banner .ti-text strong{font-size:14px;color:#f8fafc;font-weight:700;}
    #taronyang-install-banner .ti-text span{font-size:12px;color:#94a3b8;}
    #taronyang-install-banner .ti-install{
      background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border:none;
      padding:9px 16px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;
      white-space:nowrap;
    }
    #taronyang-install-banner .ti-close{
      background:transparent;color:#94a3b8;border:none;font-size:22px;line-height:1;
      cursor:pointer;padding:0 4px;
    }
    @media(prefers-color-scheme:light){
      #taronyang-install-banner{background:#fff;border-color:rgba(124,58,237,.2);}
      #taronyang-install-banner .ti-text strong{color:#0a0a2e;}
      #taronyang-install-banner .ti-text span{color:#64748b;}
    }
  `;
  document.head.appendChild(style);
}

function showInstallBanner() {
  if (!deferredInstallPrompt) return;
  if (!shouldShowInstallBanner()) return;
  if (document.getElementById('taronyang-install-banner')) return;

  injectInstallStyles();
  const banner = buildInstallBanner();
  document.body.appendChild(banner);

  // 애니메이션 진입
  requestAnimationFrame(() => banner.classList.add('show'));

  const installBtn = banner.querySelector('.ti-install');
  const closeBtn = banner.querySelector('.ti-close');

  const dismiss = () => {
    banner.classList.remove('show');
    markInstallDismissed();
    setTimeout(() => banner.remove(), 400);
  };

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'dismissed') markInstallDismissed();
    } catch (_) {
      /* 무시 */
    }
    deferredInstallPrompt = null;
    dismiss();
  });

  closeBtn.addEventListener('click', dismiss);
}

window.addEventListener('beforeinstallprompt', (e) => {
  // 브라우저 기본 미니 인포바 방지 → 커스텀 배너 사용
  e.preventDefault();
  deferredInstallPrompt = e;
  setTimeout(showInstallBanner, INSTALL_SHOW_DELAY_MS);
});

// 설치 완료 시 배너 제거 + 플래그 정리
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const banner = document.getElementById('taronyang-install-banner');
  if (banner) banner.remove();
  try {
    localStorage.removeItem(INSTALL_DISMISS_KEY);
  } catch (_) {
    /* 무시 */
  }
});

// iOS는 beforeinstallprompt 미지원 → 별도 가이드 토스트 (Safari 홈추가)
function showIOSInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || isStandalone) return;
  if (!shouldShowInstallBanner()) return;

  injectInstallStyles();
  const banner = buildInstallBanner();
  // iOS는 prompt()가 없으므로 설치 버튼을 공유/가이드로 변경
  const installBtn = banner.querySelector('.ti-install');
  installBtn.textContent = '방법 보기';
  banner.querySelector('.ti-text span').textContent =
    'Safari 공유 버튼 → 홈 화면에 추가';
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));

  const dismiss = () => {
    banner.classList.remove('show');
    markInstallDismissed();
    setTimeout(() => banner.remove(), 400);
  };

  installBtn.addEventListener('click', dismiss);
  banner.querySelector('.ti-close').addEventListener('click', dismiss);
}

window.addEventListener('load', () => {
  setTimeout(showIOSInstallHint, INSTALL_SHOW_DELAY_MS);
});
