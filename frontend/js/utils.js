/**
 * Shared frontend utilities for Taronyang.
 * Loaded via <script src="/static/js/utils.js"> before inline page scripts.
 */
(function () {
    'use strict';

    var toastTimeout = null;

    /**
     * Display a transient toast message at the bottom of the screen.
     * Requires a <div id="toast"> element in the page.
     * @param {string} msg - Message to display.
     */
    window.showToast = function (msg) {
        var t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.remove('opacity-0', 'pointer-events-none');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(function () {
            t.classList.add('opacity-0', 'pointer-events-none');
        }, 2500);
    };

    window.logout = async function () {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (_) {}
        localStorage.removeItem('user');
        window.location.href = '/login';
    };
})();
