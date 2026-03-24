const params = new URLSearchParams(window.location.search);
const patientId = Number(params.get('patient_id')) || 0;

const patientNameEl = document.getElementById('patientName');
const patientMetaEl = document.getElementById('patientMeta');
const patientDetailsEl = document.getElementById('patientDetails');
const profileAvatar = document.getElementById('profileAvatar');
const scanTimeline = document.getElementById('scanTimeline');
const btnStartScan = document.getElementById('btnStartScan');
const scanOverlay = document.getElementById('scanOverlay');
const overlaySub = document.getElementById('scanOverlaySub');
const btnUploadCsv = document.getElementById('btnUploadCsv');
const btnDeletePatient = document.getElementById('btnDeletePatient');
const csvFileInput = document.getElementById('csvFileInput');

const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editError = document.getElementById('editError');
const btnSaveEdit = document.getElementById('btnSaveEdit');
const trendChartCanvas = document.getElementById('trendChart');
const trendEmpty = document.getElementById('trendEmpty');
const trendWrap = document.getElementById('trendWrap');

let patient = null;
let scans = [];
let trendChart = null;
let pollInterval = null;
let pollTimeout = null;
let lastKnownScanId = 0;
let triggerEpochMs = 0;
let scanSeconds = 20;
let countdownInterval = null;

function nullable(value) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function renderPatient() {
  if (!patient) return;

  profileAvatar.textContent = initials(patient.name);
  patientNameEl.textContent = nullable(patient.name);
  patientMetaEl.textContent = `Age: ${nullable(patient.age)} | ${nullable(patient.gender)}`;

  patientDetailsEl.innerHTML = `
    <div>Blood Group: ${nullable(patient.blood_group)}</div>
    <div>Phone: ${nullable(patient.phone)}</div>
    <div>Created: ${CardioApp.formatDateTime(patient.created_at)}</div>
    <div>Last Scan: ${patient.last_scan_date ? CardioApp.formatDateTime(patient.last_scan_date) : '--'}</div>
  `;

  document.getElementById('edit_name').value = patient.name || '';
  document.getElementById('edit_age').value = patient.age ?? '';
  document.getElementById('edit_gender').value = patient.gender || '';
  document.getElementById('edit_blood_group').value = patient.blood_group || '';
  document.getElementById('edit_phone').value = patient.phone || '';
}

function metricValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '--';
  return `${value}${suffix}`;
}

function renderTimeline() {
  if (!scans.length) {
    scanTimeline.innerHTML = `
      <article class="timeline-item">
        <p class="muted" style="margin:0;">No scans available for this patient yet.</p>
      </article>
    `;
    return;
  }

  scanTimeline.innerHTML = '';

  scans.forEach((scan) => {
    const pred = CardioApp.riskLabel(scan.prediction);

    const item = document.createElement('article');
    item.className = 'timeline-item';
    item.innerHTML = `
      <div class="timeline-top">
        <strong>${CardioApp.formatDateTime(scan.started_at)}</strong>
        <span class="badge ${pred.className}">${pred.text}</span>
      </div>

      <div class="metrics-inline">
        <span class="metric-chip">HR: ${metricValue(scan.hr, ' BPM')}</span>
        <span class="metric-chip">PR Level: ${metricValue(scan.pr_level)}</span>
        <span class="metric-chip">BP: ${metricValue(scan.sbp)}/${metricValue(scan.dbp)} mmHg</span>
        <span class="metric-chip">SpO2: ${metricValue(scan.spo2, '%')}</span>
      </div>

      <div class="actions-row" style="margin-top:0.7rem;">
        <a class="btn btn-secondary" href="report.html?scan_id=${scan.id}">View Full Report</a>
      </div>
    `;
    scanTimeline.appendChild(item);
  });

  lastKnownScanId = Number(scans[0].id || 0);
}

function formatTrendLabel(value) {
  if (!value) return '--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const hour = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hour}:${min}`;
}

function drawTrendChart(trend) {
  const labels = Array.isArray(trend.labels) ? trend.labels.map(formatTrendLabel) : [];
  if (labels.length < 2) {
    trendWrap.style.display = 'none';
    trendEmpty.style.display = 'block';
    return;
  }

  trendWrap.style.display = 'block';
  trendEmpty.style.display = 'none';

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  trendChart = new Chart(trendChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Heart Rate (BPM)',
          data: trend.hr || [],
          yAxisID: 'yHR',
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.2)',
          pointRadius: 3,
          tension: 0.35,
        },
        {
          label: 'SpO2 (%)',
          data: trend.spo2 || [],
          yAxisID: 'ySpO2',
          borderColor: '#10B981',
          backgroundColor: 'rgba(16,185,129,0.2)',
          pointRadius: 3,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#E5E7EB' } },
      },
      scales: {
        x: {
          ticks: { color: '#9CA3AF' },
          grid: { color: 'rgba(255,255,255,0.08)' },
        },
        yHR: {
          position: 'left',
          ticks: { color: '#93C5FD' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          title: { display: true, text: 'HR', color: '#93C5FD' },
        },
        ySpO2: {
          position: 'right',
          ticks: { color: '#6EE7B7' },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'SpO2', color: '#6EE7B7' },
        },
      },
    },
  });
}

async function loadTrend() {
  try {
    const trend = await CardioApp.api(`/api/patients/${patientId}/trend`);
    drawTrendChart(trend || {});
  } catch (_err) {
    trendWrap.style.display = 'none';
    trendEmpty.style.display = 'block';
  }
}

async function loadPatient() {
  if (!patientId) {
    patientNameEl.textContent = 'Invalid patient id';
    return;
  }

  try {
    CardioApp.clearOfflineBanner();
    const [patientRes, scansRes] = await Promise.all([
      CardioApp.api(`/api/patients/${patientId}`),
      CardioApp.api(`/api/patients/${patientId}/scans`),
    ]);

    patient = patientRes.patient;
    scans = Array.isArray(scansRes.scans) ? scansRes.scans : [];

    renderPatient();
    renderTimeline();
    await loadTrend();
  } catch (err) {
    CardioApp.setOfflineBanner(err.message);
    patientNameEl.textContent = 'Unable to load patient';
    patientMetaEl.textContent = err.message;
    scanTimeline.innerHTML = '';
    trendWrap.style.display = 'none';
    trendEmpty.style.display = 'block';
  }
}

function setScanOverlay(visible) {
  scanOverlay.classList.toggle('show', visible);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

async function pollLiveScan() {
  try {
    const [runningRes, liveRes] = await Promise.all([
      CardioApp.api('/api/scan/running'),
      CardioApp.api(`/api/scan/live?patient_id=${patientId}`),
    ]);

    const elapsedSec = Math.max(0, Math.floor((Date.now() - triggerEpochMs) / 1000));
    if (elapsedSec <= scanSeconds) {
      const remaining = Math.max(0, scanSeconds - elapsedSec);
      overlaySub.textContent = `Scan in progress... ${remaining}s remaining`;
    } else if (runningRes.running) {
      overlaySub.textContent = 'Finalizing scan data...';
    } else {
      overlaySub.textContent = 'Waiting for scan result...';
    }

    if (liveRes.status === 'completed' && liveRes.scan && Number(liveRes.scan.patient_id) === patientId) {
      const scanId = Number(liveRes.scan.id || 0);
      const startedAtMs = liveRes.scan.started_at ? Date.parse(liveRes.scan.started_at) : 0;
      const isNewScan = scanId > lastKnownScanId || startedAtMs >= triggerEpochMs;
      if (isNewScan) {
        stopPolling();
        window.location.href = `report.html?scan_id=${scanId}`;
      }
    }
  } catch (err) {
    stopPolling();
    setScanOverlay(false);
    btnStartScan.disabled = false;
    btnStartScan.textContent = 'Start Scan';
    CardioApp.setOfflineBanner(err.message);
    alert(err.message);
  }
}

async function startScan() {
  btnStartScan.disabled = true;
  btnStartScan.textContent = 'Starting...';

  try {
    CardioApp.clearOfflineBanner();
    await CardioApp.api('/api/scan/trigger', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId }),
    });

    triggerEpochMs = Date.now();
    overlaySub.textContent = `Scan in progress... ${scanSeconds}s remaining`;

    setScanOverlay(true);
    btnStartScan.textContent = 'Scanning...';

    stopPolling();
    pollInterval = setInterval(pollLiveScan, 2000);
    countdownInterval = setInterval(() => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - triggerEpochMs) / 1000));
      if (elapsedSec <= scanSeconds) {
        overlaySub.textContent = `Scan in progress... ${scanSeconds - elapsedSec}s remaining`;
      }
    }, 1000);

    const timeoutMs = (scanSeconds + 20) * 1000;

    pollTimeout = setTimeout(() => {
      stopPolling();
      setScanOverlay(false);
      btnStartScan.disabled = false;
      btnStartScan.textContent = 'Start Scan';
      alert(`Scan timeout after ${scanSeconds + 20} seconds. Please retry.`);
    }, timeoutMs);

    pollLiveScan();
  } catch (err) {
    btnStartScan.disabled = false;
    btnStartScan.textContent = 'Start Scan';
    CardioApp.setOfflineBanner(err.message);
    alert(err.message);
  }
}

function openEditModal() {
  editError.style.display = 'none';
  editModal.classList.add('show');
}

function closeEditModal() {
  editModal.classList.remove('show');
}

async function saveEdit(event) {
  event.preventDefault();
  editError.style.display = 'none';

  const payload = {
    name: document.getElementById('edit_name').value.trim(),
    age: document.getElementById('edit_age').value ? Number(document.getElementById('edit_age').value) : null,
    gender: document.getElementById('edit_gender').value || null,
    blood_group: document.getElementById('edit_blood_group').value || null,
    phone: document.getElementById('edit_phone').value.trim() || null,
  };

  if (!payload.name) {
    editError.textContent = 'Full Name is required.';
    editError.style.display = 'block';
    return;
  }

  btnSaveEdit.disabled = true;
  btnSaveEdit.textContent = 'Saving...';

  try {
    await CardioApp.api(`/api/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    closeEditModal();
    await loadPatient();
  } catch (err) {
    editError.textContent = err.message;
    editError.style.display = 'block';
    CardioApp.setOfflineBanner(err.message);
  } finally {
    btnSaveEdit.disabled = false;
    btnSaveEdit.textContent = 'Save Changes';
  }
}

async function uploadCsv(file) {
  if (!file) return;

  const formData = new FormData();
  formData.append('patient_id', String(patientId));
  formData.append('raw_csv', file);

  btnUploadCsv.disabled = true;
  btnUploadCsv.textContent = 'Analyzing...';
  setScanOverlay(true);
  overlaySub.textContent = 'Analyzing uploaded CSV data...';

  try {
    const result = await CardioApp.api('/api/scan/upload', {
      method: 'POST',
      body: formData,
    });

    if (result && result.scan_id) {
      window.location.href = `report.html?scan_id=${result.scan_id}`;
      return;
    }

    throw new Error('Prediction failed for uploaded CSV');
  } catch (err) {
    setScanOverlay(false);
    CardioApp.setOfflineBanner(err.message);
    alert(err.message);
  } finally {
    btnUploadCsv.disabled = false;
    btnUploadCsv.textContent = 'Upload CSV Scan';
    csvFileInput.value = '';
  }
}

async function deletePatient() {
  if (!patient) return;

  const name = patient.name || 'this patient';
  const ok = window.confirm(
    `Delete ${name}? This will permanently remove patient details and all scan records.`
  );
  if (!ok) return;

  btnDeletePatient.disabled = true;
  btnDeletePatient.textContent = 'Deleting...';

  try {
    await CardioApp.api(`/api/patients/${patientId}`, { method: 'DELETE' });
    window.location.href = 'index.html';
  } catch (err) {
    CardioApp.setOfflineBanner(err.message);
    alert(err.message);
    btnDeletePatient.disabled = false;
    btnDeletePatient.textContent = 'Delete Patient';
  }
}

function onUploadButtonClick() {
  csvFileInput.click();
}

function onCsvFileChange(event) {
  const file = event.target.files && event.target.files[0];
  uploadCsv(file);
}

function wireEvents() {
  btnStartScan.addEventListener('click', startScan);
  btnUploadCsv.addEventListener('click', onUploadButtonClick);
  btnDeletePatient.addEventListener('click', deletePatient);
  csvFileInput.addEventListener('change', onCsvFileChange);
  document.getElementById('btnEditPatient').addEventListener('click', openEditModal);
  document.getElementById('btnCloseEdit').addEventListener('click', closeEditModal);
  editForm.addEventListener('submit', saveEdit);

  editModal.addEventListener('click', (event) => {
    if (event.target === editModal) closeEditModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeEditModal();
  });
}

async function loadConfig() {
  try {
    const cfg = await CardioApp.api('/api/config');
    if (cfg && Number.isFinite(Number(cfg.scan_seconds)) && Number(cfg.scan_seconds) > 0) {
      scanSeconds = Number(cfg.scan_seconds);
    }
  } catch (_err) {
    scanSeconds = 20;
  }
}

wireEvents();
loadConfig().then(loadPatient);
