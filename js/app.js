const state = {
  rows: [],
  filtered: []
};

const els = {
  search: document.querySelector('#searchInput'),
  hostFamily: document.querySelector('#hostFamilyFilter'),
  method: document.querySelector('#methodFilter'),
  studyType: document.querySelector('#studyTypeFilter'),
  body: document.querySelector('#resultsBody'),
  empty: document.querySelector('#emptyState'),
  status: document.querySelector('#statusMessage'),
  recordCount: document.querySelector('#recordCount'),
  hostCount: document.querySelector('#hostCount'),
  virusCount: document.querySelector('#virusCount'),
  countryCount: document.querySelector('#countryCount')
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length || !lines[0]) return [];

  const parseLine = (line) => {
    const cells = [];
    let current = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = parseLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()]));
    });
}

function uniqueValues(key) {
  return [...new Set(state.rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function countUnique(rows, key) {
  return new Set(rows.map((row) => row[key]).filter(Boolean)).size;
}

function updateStats(rows) {
  els.recordCount.textContent = rows.length;
  els.hostCount.textContent = countUnique(rows, 'host_taxon');
  els.virusCount.textContent = countUnique(rows, 'virus_taxon');
  els.countryCount.textContent = countUnique(rows, 'country');
}

function renderRows(rows) {
  els.body.replaceChildren();

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    ['host_taxon', 'virus_taxon', 'country', 'sampling_year', 'detection_method', 'study_type'].forEach((key) => {
      const td = document.createElement('td');
      td.textContent = row[key] || '—';
      tr.append(td);
    });
    els.body.append(tr);
  });

  els.empty.hidden = rows.length > 0;
  els.status.textContent = `${rows.length} of ${state.rows.length} records shown`;
  updateStats(rows);
}

function applyFilters() {
  const query = els.search.value.trim().toLowerCase();
  const hostFamily = els.hostFamily.value;
  const method = els.method.value;
  const studyType = els.studyType.value;

  state.filtered = state.rows.filter((row) => {
    const haystack = Object.values(row).join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (!hostFamily || row.host_family === hostFamily)
      && (!method || row.detection_method === method)
      && (!studyType || row.study_type === studyType);
  });

  renderRows(state.filtered);
}

async function init() {
  try {
    const response = await fetch('data/detections.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    state.rows = parseCsv(text);
    state.filtered = [...state.rows];

    fillSelect(els.hostFamily, uniqueValues('host_family'));
    fillSelect(els.method, uniqueValues('detection_method'));
    fillSelect(els.studyType, uniqueValues('study_type'));

    renderRows(state.rows);
    if (state.rows.length === 0) {
      els.status.textContent = 'Dataset scaffold loaded; no biological records added yet.';
    }
  } catch (error) {
    console.error(error);
    els.status.textContent = 'Could not load data/detections.csv.';
    els.empty.hidden = false;
    els.empty.textContent = 'The data file could not be loaded.';
  }
}

[els.search, els.hostFamily, els.method, els.studyType].forEach((control) => {
  control.addEventListener('input', applyFilters);
  control.addEventListener('change', applyFilters);
});

init();
