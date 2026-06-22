/* 타로냥 Service Worker
 * - 정적 자원: Cache First (stale-while-revalidate)
 * - HTML 문서: Network First, 오프라인 시 캐시/폴백
 * - API(/api/*): Network First, 실패 시 캐시 (있으면)
 */

const SW_VERSION = "taronyang-sw-v1";
const STATIC_CACHE = `${SW_VERSION}-static`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const API_CACHE = `${SW_VERSION}-api`;

// 사전 캐싱할 핵심 자산 (앱 셸)
const PRECACHE_URLS = [
  "/",
  "/tarot",
  "/daily",
  "/manifest.json",
  "/static/css/style.css",
  "/static/js/app.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
];

// 오프라인 폴백 페이지 (인라인으로 간단하게)
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>오프라인 — 타로냥</title>
<link rel="manifest" href="/manifest.json">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0a0a2e;
    color: #f8fafc;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }
  .box { max-width: 360px; }
  .moon { font-size: 64px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin-bottom: 12px; color: #a78bfa; }
  p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
  button {
    background: linear-gradient(135deg, #7c3aed, #a78bfa);
    color: #fff; border: none; padding: 14px 28px;
    border-radius: 999px; font-size: 15px; font-weight: 700;
    cursor: pointer;
  }
</style>
</head>
<body>
  <div class="box">
    <div class="moon">🌙</div>
    <h1>지금은 오프라인이에요</h1>
    <p>인터넷 연결이 끊겼어요. 이전에 본 페이지는 캐시에서 볼 수 있어요. 연결이 되면 다시 시도해 주세요.</p>
    <button onclick="location.reload()">다시 시도</button>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // 폴백 페이지를 먼저 캐시 (오프라인 HTML)
      const fallbackResponse = new Response(OFFLINE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      await cache.put("/offline.html", fallbackResponse);
      // 핵심 자산 사전 캐싱 (실패해도 설치는 계속)
      await Promise.allSettled(
        PRECACHE_URLS.filter((u) => u !== "/offline.html").map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (_) {
            /* 개별 자산 실패는 무시 */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(SW_VERSION))
          .map((k) => caches.delete(k))
      );
      // 네비게이션 프리로드가 가능하면 활성화
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

// 민감한 API 경로는 캐싱에서 제외 (보안: 인증/관리자/결제 데이터 유출 방지)
const SENSITIVE_API_PATHS = ["/api/auth", "/api/admin", "/api/payment"];

function isCacheableApiRequest(url) {
  if (!url.pathname.startsWith("/api/")) return false;
  return !SENSITIVE_API_PATHS.some((path) => url.pathname.startsWith(path));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    /\.(?:css|js|png|jpg|jpeg|svg|gif|woff2?|ttf|ico)$/.test(url.pathname)
  );
}

// 정적 자산: Cache First + 백그라운드 업데이트 (stale-while-revalidate)
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

// HTML 문서: Network First, 실패 시 캐시 → 오프라인 폴백
async function handlePage(event) {
  const { request } = event;
  const cache = await caches.open(PAGE_CACHE);
  try {
    // navigation preload 응답이 있으면 재사용
    const preloadResponse =
      event.preloadResponse instanceof Promise
        ? await event.preloadResponse
        : null;
    const networkResponse =
      preloadResponse || (await fetch(request));
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // 오프라인 폴백
    const offline = await caches.match("/offline.html");
    return (
      offline ||
      new Response(OFFLINE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

// API: Network First, 실패 시 캐시 (GET만)
async function handleApi(request) {
  if (request.method !== "GET") return fetch(request);
  const cache = await caches.open(API_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "오프라인 상태입니다. 잠시 후 다시 시도해 주세요." }),
      { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handlePage(event));
  } else if (isCacheableApiRequest(url)) {
    event.respondWith(handleApi(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  }
  // 그 외 요청은 브라우저 기본 동작
});

// 페이지에 업데이트 알림 (skipWaiting 후 클라이언트 제어)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
