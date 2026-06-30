(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  function syncToggles(theme) {
    const isDark = theme === 'dark';
    document.querySelectorAll('.theme-toggle input[type="checkbox"]').forEach(cb => {
      cb.checked = !isDark;
    });
  }
  syncToggles(saved);

  document.addEventListener('change', function(e) {
    if (!e.target.classList.contains('theme-toggle') && !e.target.closest('.theme-toggle')) return;
    const theme = e.target.checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    syncToggles(theme);
    window.dispatchEvent(new Event('themechange'));
  });
})();
