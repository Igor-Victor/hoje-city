/**
 * Hoje.city — Admin panel JS
 * Handles token refresh and minor UX enhancements.
 */
(function () {
  'use strict';

  // Proactive token refresh: attempt 5 minutes before expiry (every 50 min)
  setInterval(async function () {
    try {
      await fetch('/admin/refresh', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {
      // Silently fail — the auth middleware will redirect on next request
    }
  }, 50 * 60 * 1000);

  // Highlight active nav link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.admin-nav__link').forEach(function (link) {
    if (link.getAttribute('href') && currentPath.startsWith(link.getAttribute('href'))) {
      link.style.color = 'var(--text)';
      link.style.fontWeight = '500';
    }
  });
})();
