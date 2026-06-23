/**
 * 🔮 타로냥 Analytics Module
 *
 * Two-layer tracking:
 *   1. Cloudflare Web Analytics beacon — privacy-friendly, cookie-free pageviews
 *   2. Custom event tracking — sends structured events to backend /api/analytics/event
 *
 * Usage:
 *   TaronyangAnalytics.track('tarot_reading_complete', { category: 'love' });
 *   TaronyangAnalytics.pageView('/tarot');
 */

(function () {
  'use strict';

  var CFG = (window.__TARONYANG_CONFIG__ = window.__TARONYANG_CONFIG__ || {});
  var CF_TOKEN = CFG.analyticsToken || '';
  var API_BASE = CFG.apiBase || window.location.origin + '/api';

  // --- Cloudflare Web Analytics beacon ---
  function loadCloudflareBeacon() {
    if (!CF_TOKEN) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token": "' + CF_TOKEN + '"}');
    document.head.appendChild(s);
  }

  // --- Anonymous session ID (localStorage, no PII) ---
  var SESSION_KEY = 'taronyang_sid';
  function getSessionId() {
    try {
      var sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch (_) {
      return 's_unknown';
    }
  }

  // --- Queue + flush: batch events to avoid request flooding ---
  var QUEUE = [];
  var FLUSH_DELAY = 2000;
  var MAX_QUEUE = 10;
  var flushTimer = null;

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flush();
    }, FLUSH_DELAY);
  }

  function flush() {
    if (QUEUE.length === 0) return;
    var batch = QUEUE.splice(0, MAX_QUEUE);
    // navigator.sendBeacon for reliability on page unload
    var payload = JSON.stringify({ events: batch });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        var ok = navigator.sendBeacon(API_BASE + '/analytics/event', blob);
        if (ok) return;
      }
    } catch (_) {
      /* fall through to fetch */
    }
    // Fallback: fetch with keepalive
    try {
      fetch(API_BASE + '/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    } catch (_) {
      /* analytics failure must never break the app */
    }
  }

  // Flush remaining events when the page unloads
  window.addEventListener('pagehide', function () {
    if (QUEUE.length > 0) flush();
  });

  // --- Public API ---
  var TaronyangAnalytics = {
    /**
     * Track a custom event.
     * @param {string} name  — event name (e.g. 'tarot_reading_complete')
     * @param {object} [props] — additional properties
     */
    track: function (name, props) {
      var event = {
        name: name,
        props: props || {},
        path: window.location.pathname,
        referrer: document.referrer || '',
        session_id: getSessionId(),
        ts: new Date().toISOString(),
      };
      QUEUE.push(event);
      if (QUEUE.length >= MAX_QUEUE) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flush();
      } else {
        scheduleFlush();
      }
    },

    /**
     * Manually trigger a pageview event (for SPA-like navigations).
     * Cloudflare beacon handles initial pageviews automatically.
     */
    pageView: function (path) {
      this.track('page_view', { path: path || window.location.pathname });
    },
  };

  // Expose globally
  window.TaronyangAnalytics = TaronyangAnalytics;

  // Auto-load Cloudflare beacon
  loadCloudflareBeacon();
})();
