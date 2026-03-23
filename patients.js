const patientGrid = document.getElementById('patientGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('patientModal');
const form = document.getElementById('patientForm');
const formError = document.getElementById('formError');
const btnCreate = document.getElementById('btnCreatePatient');

let patients = [];

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function nullable(value) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function skeletonCards() {
  patientGrid.innerHTML = '';
  for (let i = 0; i < 6; i += 1) {
    const el = document.createElement('article');
    el.className = 'card skeleton-card';
    el.innerHTML = `
      <div class="skeleton" style="height:22px; width:45%;"></div>
      <div class="skeleton" style="height:14px; width:62%;"></div>
      <div class="skeleton" style="height:14px; width:70%;"></div>
      <div class="skeleton" style="height:14px; width:52%;"></div>
      <div class="skeleton" style="height:32px; width:100%; margin-top:10px;"></div>
    `;
    patientGrid.appendChild(el);
  }
}

function openModal() {
  form.reset();
  formError.style.display = 'none';
  modal.classList.add('show');
  document.getElementById('name').focus();
}

function closeModal() {
  modal.classList.remove('show');
}

function renderPatients() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = patients.filter((p) => String(p.name || '').toLowerCase().includes(query));

  patientGrid.innerHTML = '';

  if (!filtered.length) {
    emptyState.style.display = patients.length ? 'none' : 'block';
    if (patients.length && query) {
      const notFound = document.createElement('div');
      notFound.className = 'card empty-state';
      notFound.innerHTML = `
        <div class="empty-illustration">🔎</div>
        <h3>No matches</h3>
        <p class="muted">No patient matched your search.</p>
      `;
      patientGrid.appendChild(notFound);
    }
    return;
  }

  emptyState.style.display = 'none';

  filtered.forEach((patient) => {
    const card = document.createElement('article');
    card.className = 'card patient-card';

    const lastScanText = patient.last_scan_date
      ? `Last Scan: ${CardioApp.daysAgo(patient.last_scan_date) || CardioApp.formatDateTime(patient.last_scan_date)}`
      : 'No scans yet';

    const pred = CardioApp.riskLabel(patient.last_prediction);

    card.innerHTML = `
      <div class="patient-top">
        <div class="avatar">${initials(patient.name)}</div>
        <div>
          <h3 class="patient-name">${nullable(patient.name)}</h3>
          <p class="patient-meta">Age: ${nullable(patient.age)} | ${nullable(patient.gender)}</p>
        </div>
      </div>

      <div class="section-row" style="margin-top:0;">
        <span class="badge badge-warning">Blood Group: ${nullable(patient.blood_group)}</span>
      </div>

      <p class="muted" style="margin:0;">${lastScanText}</p>

      <div class="card-actions">
        <span class="badge ${pred.className}">${pred.text}</span>
        <a class="link-btn" href="patient.html?patient_id=${patient.id}">View Details →</a>
      </div>
    `;

    patientGrid.appendChild(card);
  });
}

async function loadPatients() {
  skeletonCards();

  try {
    CardioApp.clearOfflineBanner();
    const data = await CardioApp.api('/api/patients');
    patients = Array.isArray(data.patients) ? data.patients : [];
    renderPatients();
  } catch (err) {
    patientGrid.innerHTML = '';
    emptyState.style.display = 'none';

    const errorCard = document.createElement('section');
    errorCard.className = 'card empty-state';
    errorCard.innerHTML = `
      <div class="empty-illustration">⚠️</div>
      <h3>Unable to load patients</h3>
      <p class="muted">${err.message}</p>
      <button id="retryPatients" class="btn btn-primary">Retry</button>
    `;

    patientGrid.appendChild(errorCard);
    document.getElementById('retryPatients').addEventListener('click', loadPatients);
    CardioApp.setOfflineBanner(err.message);
  }
}

async function onCreatePatient(event) {
  event.preventDefault();
  formError.style.display = 'none';

  const payload = {
    name: document.getElementById('name').value.trim(),
    age: document.getElementById('age').value ? Number(document.getElementById('age').value) : null,
    gender: document.getElementById('gender').value || null,
    blood_group: document.getElementById('blood_group').value || null,
    phone: document.getElementById('phone').value.trim() || null,
  };

  if (!payload.name) {
    formError.textContent = 'Full Name is required.';
    formError.style.display = 'block';
    return;
  }

  btnCreate.disabled = true;
  btnCreate.textContent = 'Creating...';

  try {
    CardioApp.clearOfflineBanner();
    await CardioApp.api('/api/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    closeModal();
    await loadPatients();
  } catch (err) {
    formError.textContent = err.message;
    formError.style.display = 'block';
    CardioApp.setOfflineBanner(err.message);
  } finally {
    btnCreate.disabled = false;
    btnCreate.textContent = 'Create Patient';
  }
}

function wireEvents() {
  document.getElementById('btnOpenModal').addEventListener('click', openModal);
  document.getElementById('btnEmptyCreate').addEventListener('click', openModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  searchInput.addEventListener('input', renderPatients);
  form.addEventListener('submit', onCreatePatient);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

wireEvents();
loadPatients();
