const params = new URLSearchParams(window.location.search);
const scanId = Number(params.get('scan_id')) || 0;

const reportHeadMeta = document.getElementById('reportHeadMeta');
const statusBanner = document.getElementById('statusBanner');

const metricHr = document.getElementById('metricHr');
const metricHrStatus = document.getElementById('metricHrStatus');
const metricPrLevel = document.getElementById('metricPrLevel');
const metricPrLevelStatus = document.getElementById('metricPrLevelStatus');
const metricBp = document.getElementById('metricBp');
const metricBpStatus = document.getElementById('metricBpStatus');
const metricPtt = document.getElementById('metricPtt');
const metricSpo2 = document.getElementById('metricSpo2');
const metricSpo2Status = document.getElementById('metricSpo2Status');

const predictionLabel = document.getElementById('predictionLabel');
const healthStatus = document.getElementById('healthStatus');
const breathingLine = document.getElementById('breathingLine');
const featureBars = document.getElementById('featureBars');
const suggestionList = document.getElementById('suggestionList');
const btnBackPatient = document.getElementById('btnBackPatient');
const respBreathingValue = document.getElementById('respBreathingValue');
const respBreathingStatus = document.getElementById('respBreathingStatus');
const respSpo2Value = document.getElementById('respSpo2Value');
const respSpo2Status = document.getElementById('respSpo2Status');
const respHrValue = document.getElementById('respHrValue');
const respHrStatus = document.getElementById('respHrStatus');
const respOverallStatus = document.getElementById('respOverallStatus');
const respRecommendation = document.getElementById('respRecommendation');

function nullable(value) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeBadgeByText(text) {
  const v = String(text || '').toLowerCase();
  if (!v || v === '--') return 'badge-muted';
  if (v.includes('normal') || v.includes('stable')) return 'badge-success';
  if (v.includes('elevated') || v.includes('stage 1') || v.includes('unknown')) return 'badge-warning';
  return 'badge-danger';
}

function parseFeatureImportances(raw) {
  if (!raw) return [];
  const cleaned = String(raw).replace('Feature importances:', '').trim();
  if (!cleaned) return [];

  const entries = cleaned
    .split(',')
    .map((item) => item.trim())
    .map((item) => {
      const [namePart, valuePart] = item.split(':').map((x) => (x || '').trim());
      const value = Number(valuePart);
      if (!namePart || Number.isNaN(value)) return null;
      return { name: namePart, value };
    })
    .filter(Boolean);

  if (!entries.length) return [];

  const max = Math.max(...entries.map((e) => e.value), 1);
  return entries.map((e) => ({
    ...e,
    percent: Math.max(2, Math.round((e.value / max) * 100)),
  }));
}

function iconForSuggestion(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('diet') || value.includes('food') || value.includes('salt')) return '🥗';
  if (value.includes('exercise') || value.includes('walk')) return '🏃';
  if (value.includes('checkup') || value.includes('doctor') || value.includes('clinician')) return '🏥';
  if (value.includes('stress') || value.includes('sleep')) return '🧘';
  return '💡';
}

function splitSuggestions(raw) {
  if (!raw) return ['No recommendation available.'];

  const parts = String(raw)
    .split(/\n|\u2022|-/)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length ? parts : [String(raw).trim()];
}

function classifySpo2(value) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Unknown';
  if (n >= 95) return 'Normal';
  if (n >= 90) return 'Borderline';
  if (n >= 85) return 'Low';
  return 'Critical';
}

function classifyBreathing(value) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Unknown';
  if (n < 12) return 'Bradypnea';
  if (n <= 20) return 'Normal';
  return 'Elevated';
}

function badgeClassForSeverity(severity) {
  if (severity === 'green') return 'badge-success';
  if (severity === 'yellow') return 'badge-warning';
  if (severity === 'orange') return 'badge-attention';
  if (severity === 'red') return 'badge-danger';
  return 'badge-muted';
}

function breathingIndicator(value) {
  if (value === null) return { label: 'Unknown', severity: 'yellow' };
  if (value < 12) return { label: 'Below Normal', severity: 'yellow' };
  if (value <= 20) return { label: 'Normal', severity: 'green' };
  if (value <= 25) return { label: 'Slightly Elevated', severity: 'yellow' };
  return { label: 'Elevated', severity: 'orange' };
}

function spo2Indicator(value) {
  if (value === null) return { label: 'Unknown', severity: 'yellow' };
  if (value >= 95 && value <= 100) return { label: 'Normal', severity: 'green' };
  if (value >= 90 && value < 95) return { label: 'Below Normal', severity: 'orange' };
  return { label: 'Low', severity: 'red' };
}

function hrIndicator(value) {
  if (value === null) return { label: 'Unknown', severity: 'yellow' };
  if (value < 60) return { label: 'Below Normal', severity: 'yellow' };
  if (value <= 100) return { label: 'Normal', severity: 'green' };
  if (value <= 120) return { label: 'Slightly Elevated', severity: 'yellow' };
  return { label: 'Elevated', severity: 'orange' };
}

function prLevelFromHr(value) {
  if (value === null) return '--';
  if (value < 60) return 'Low';
  if (value <= 100) return 'Normal';
  return 'High';
}

function overallRespStatus(severities) {
  if (severities.includes('red')) {
    return {
      label: 'Consult Doctor',
      severity: 'red',
      recommendation: 'Immediate medical consultation recommended. Please visit a doctor or hospital.',
    };
  }

  if (severities.includes('orange')) {
    return {
      label: 'Needs Attention',
      severity: 'orange',
      recommendation: 'One or more indicators require attention. Please consult a qualified doctor for proper evaluation.',
    };
  }

  if (severities.includes('yellow')) {
    return {
      label: 'Needs Monitoring',
      severity: 'yellow',
      recommendation: 'Some indicators are slightly outside normal range. Monitor regularly and consult doctor if condition persists.',
    };
  }

  return {
    label: 'All Clear',
    severity: 'green',
    recommendation: 'All respiratory indicators are within normal range. Continue regular monitoring.',
  };
}


function renderReport(scan) {
  const patientName = nullable(scan.patient_name);
  const startedAt = CardioApp.formatDateTime(scan.started_at);

  reportHeadMeta.textContent = `${patientName} | ${startedAt}`;

  const prediction = String(scan.prediction || '').toLowerCase();
  const isNormal = prediction === 'normal';
  statusBanner.textContent = isNormal ? '✅ NORMAL' : '⚠️ RISK DETECTED';
  statusBanner.className = `status-banner ${isNormal ? 'status-normal' : 'status-risk'}`;

  const hr = numericOrNull(scan.hr);
  const prLevel = String(scan.pr_level || '').trim() || prLevelFromHr(hr);
  const sbp = numericOrNull(scan.sbp);
  const dbp = numericOrNull(scan.dbp);
  const ptt = numericOrNull(scan.ptt);
  const spo2 = numericOrNull(scan.spo2);
  const breathing = numericOrNull(scan.breathing_rate);

  metricHr.textContent = hr === null ? '--' : `${hr} BPM`;
  metricHrStatus.textContent = nullable(scan.hr_status);
  metricHrStatus.className = `badge ${normalizeBadgeByText(scan.hr_status)}`;

  metricPrLevel.textContent = nullable(prLevel);
  metricPrLevelStatus.textContent = nullable(prLevel);
  metricPrLevelStatus.className = `badge ${normalizeBadgeByText(prLevel)}`;

  metricBp.textContent = sbp === null || dbp === null ? '--/-- mmHg' : `${sbp}/${dbp} mmHg`;
  metricBpStatus.textContent = nullable(scan.bp_status);
  metricBpStatus.className = `badge ${normalizeBadgeByText(scan.bp_status)}`;

  metricPtt.textContent = ptt === null ? '--' : `${ptt}s`;

  const spo2Status = classifySpo2(spo2);
  const breathingStatus = classifyBreathing(breathing);

  metricSpo2.textContent = spo2 === null ? '--' : `${spo2}%`;
  metricSpo2Status.textContent = spo2Status;
  metricSpo2Status.className = `badge ${normalizeBadgeByText(spo2Status)}`;

  predictionLabel.textContent = nullable(scan.prediction);
  healthStatus.textContent = nullable(scan.health_status);
  healthStatus.className = `badge ${normalizeBadgeByText(scan.health_status)}`;
  breathingLine.textContent = `🫁 Breathing Rate: ${breathing === null ? '--' : breathing} breaths/min - ${breathingStatus}`;

  const features = parseFeatureImportances(scan.explainable);
  featureBars.innerHTML = '';
  if (!features.length) {
    featureBars.innerHTML = '<p class="muted" style="margin:0;">No explainable output available.</p>';
  } else {
    features.forEach((feature) => {
      const row = document.createElement('div');
      row.className = 'feature-row';
      row.innerHTML = `
        <span class="muted">${feature.name}</span>
        <div class="feature-track"><div class="feature-fill" style="width:${feature.percent}%;"></div></div>
        <strong>${feature.value.toFixed(2)}</strong>
      `;
      featureBars.appendChild(row);
    });
  }

  const suggestions = splitSuggestions(scan.suggestion);
  suggestionList.innerHTML = '';
  suggestions.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = `${iconForSuggestion(line)} ${line}`;
    suggestionList.appendChild(li);
  });

  const breathingInd = breathingIndicator(breathing);
  const spo2Ind = spo2Indicator(spo2);
  const hrInd = hrIndicator(hr);

  respBreathingValue.textContent = breathing === null ? '-- breaths/min' : `${breathing} breaths/min`;
  respBreathingStatus.textContent = breathingInd.label;
  respBreathingStatus.className = `badge ${badgeClassForSeverity(breathingInd.severity)}`;

  respSpo2Value.textContent = spo2 === null ? '--%' : `${spo2}%`;
  respSpo2Status.textContent = spo2Ind.label;
  respSpo2Status.className = `badge ${badgeClassForSeverity(spo2Ind.severity)}`;

  respHrValue.textContent = hr === null ? '-- BPM' : `${hr} BPM`;
  respHrStatus.textContent = hrInd.label;
  respHrStatus.className = `badge ${badgeClassForSeverity(hrInd.severity)}`;

  const overall = overallRespStatus([breathingInd.severity, spo2Ind.severity, hrInd.severity]);
  respOverallStatus.textContent = overall.label;
  respOverallStatus.className = `badge ${badgeClassForSeverity(overall.severity)}`;
  respRecommendation.textContent = overall.recommendation;

  btnBackPatient.href = `patient.html?patient_id=${scan.patient_id}`;
}

async function loadReport() {
  if (!scanId) {
    reportHeadMeta.textContent = 'Invalid scan id';
    return;
  }

  try {
    CardioApp.clearOfflineBanner();
    const data = await CardioApp.api(`/api/scans/${scanId}`);
    renderReport(data.scan);
  } catch (err) {
    CardioApp.setOfflineBanner(err.message);
    reportHeadMeta.textContent = err.message;
  }
}

function wireActions() {
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnPrintTop').addEventListener('click', () => window.print());
}

wireActions();
loadReport();
