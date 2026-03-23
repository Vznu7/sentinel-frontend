function resolveApiBase() {
  const configured = String(window.CARDIO_API_BASE || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const isFileMode = protocol === 'file:' || host === '';
  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (isFileMode || isLocalhost) {
    return 'http://localhost:5000';
  }

  if (isLanIp) {
    return `http://${host}:5000`;
  }

  // Default cloud backend placeholder; replace via frontend/config.js for deployment.
  return 'https://YOUR_BACKEND_URL_HERE';
}

const API_BASE = resolveApiBase();

const CardioApp = {
  API_BASE,

  async api(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const requestOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    };

    if (requestOptions.body instanceof FormData) {
      delete requestOptions.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, requestOptions);
      let data = null;
      try {
        data = await response.json();
      } catch (_err) {
        data = null;
      }

      if (!response.ok) {
        const message = data?.error || `Request failed (${response.status})`;
        throw new Error(message);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError') {
        throw new Error('Backend offline - please run api.py on your laptop');
      }
      throw err;
    }
  },

  formatDateTime(value) {
    if (!value) return '--';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '--';

    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, '0');
    const mins = String(dt.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${mins}`;
  },

  daysAgo(value) {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;

    const now = new Date();
    const diffMs = now - dt;
    const days = Math.floor(diffMs / 86400000);

    if (days <= 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  },

  riskLabel(prediction) {
    const val = String(prediction || '').toLowerCase();
    if (val === 'normal') return { text: 'Normal', className: 'badge-success' };
    if (!val) return { text: '--', className: 'badge-muted' };
    if (val === 'unknown' || val === 'invalid') return { text: val, className: 'badge-warning' };
    return { text: 'Risk Detected', className: 'badge-danger' };
  },

  setOfflineBanner(message) {
    const banner = document.getElementById('offlineBanner');
    if (!banner) return;
    banner.textContent = message;
    banner.classList.add('show');
  },

  clearOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    if (!banner) return;
    banner.classList.remove('show');
  },
};

window.CardioApp = CardioApp;
