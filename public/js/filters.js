/**
 * Hoje.city — Public filters (minimal JS)
 * Filters work via URL query params for SSR + SEO compatibility.
 * This file handles progressive enhancement only.
 */
(function () {
  'use strict';

  // Smooth scroll to events section on filter click
  document.querySelectorAll('.filter-pill').forEach(function (pill) {
    pill.addEventListener('click', function (e) {
      // Filters navigate via href — let the browser handle it.
      // We just ensure the page scrolls to the top on navigation.
      // No interception needed since SSR renders the correct state.
    });
  });

  // On page load, if there's an active non-"todos" filter,
  // scroll the filter bar so the active pill is visible.
  const activePill = document.querySelector('.filter-pill--active');
  if (activePill && activePill.textContent.trim() !== 'Todos') {
    activePill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
})();
