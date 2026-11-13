// Public static copy only. Never read account data or cache application responses.
try {
  if (localStorage.getItem('buscag.language') === 'en') {
    document.documentElement.lang = 'en';
    document.title = 'BuscAG · Offline';
    document.getElementById('offline-heading').textContent = "We'll meet again when the connection returns.";
    document.getElementById('offline-privacy').textContent = 'To protect your privacy, we do not cache posts or messages for offline access.';
    document.getElementById('offline-retry').textContent = 'Try again';
  }
} catch { /* Spanish is available even when browser storage is blocked. */ }
