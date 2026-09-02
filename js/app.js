const state = {
  rows: [],
  filtered: [],
  selected: null
};

const els = {
  search: document.querySelector('#searchInput'),
  hostFamily: document.querySelector('#hostFamilyFilter'),
  method: document.querySelector('#methodFilter'),
  studyType: document.querySelector('#studyTypeFilter'),
  reset: document.querySelector('#resetFilters'),
  body: document.querySelector('#resultsBody'),
  empty: document.querySelector('#emptyState'),
  status: document.querySelector('#statusMessage'),
  recordCount: document.querySelector('#recordCount'),
  hostCount: document.querySelector('#hostCount'),
  virusCount: document.querySelector('#virusCount'),
  associationCount: document.querySelector('#associationCount'),
  networkSvg: document.querySelector('#networkSvg'),
  networkEmpty: document.querySelector('#networkEmpty'),
  networkStatus: document.querySelector('#networkStatus'),
  networkDetail: document.querySelector('#networkDetail')
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || record.length) {
    record.push(field);
    if (record.some((value) => value.trim())) records.push(record);
  }

  if (records.length < 2) return [];
  const headers = records[0].map((header) => header.trim());
  return records.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, (values[index] || '').trim()])
  ));
}

function uniqueValues(key) {
  return [...new Set(state.rows.map((row) => row[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
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

function associationKey(row) {
  return `${row.host_taxon}\u0000${row.virus_taxon}`;
}

function validAssociations(rows) {
  return rows.filter((row) => row.host_taxon && row.virus_taxon);
}

function updateStats(rows) {
  els.recordCount.textContent = rows.length;
  els.hostCount.textContent = countUnique(rows, 'host_taxon');
  els.virusCount.textContent = countUnique(rows, 'virus_taxon');
  els.associationCount.textContent = new Set(validAssociations(rows).map(associationKey)).size;
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function truncateLabel(label, maximum = 25) {
  return label.length > maximum ? `${label.slice(0, maximum - 1)}…` : label;
}

function groupNetwork(rows) {
  const links = new Map();
  const hostDegrees = new Map();
  const virusDegrees = new Map();

  validAssociations(rows).forEach((row) => {
    const key = associationKey(row);
    if (!links.has(key)) {
      links.set(key, { host: row.host_taxon, virus: row.virus_taxon, rows: [] });
    }
    links.get(key).rows.push(row);
    hostDegrees.set(row.host_taxon, (hostDegrees.get(row.host_taxon) || 0) + 1);
    virusDegrees.set(row.virus_taxon, (virusDegrees.get(row.virus_taxon) || 0) + 1);
  });

  const byDegreeThenName = (degrees) => (a, b) =>
    (degrees.get(b) - degrees.get(a)) || a.localeCompare(b);

  return {
    links: [...links.values()],
    hosts: [...hostDegrees.keys()].sort(byDegreeThenName(hostDegrees)),
    viruses: [...virusDegrees.keys()].sort(byDegreeThenName(virusDegrees)),
    hostDegrees,
    virusDegrees
  };
}

function evenlySpaced(index, total, top, bottom) {
  if (total <= 1) return (top + bottom) / 2;
  return top + (index * (bottom - top)) / (total - 1);
}

function curvePath(source, target) {
  const bend = (target.x - source.x) * .46;
  return `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${target.x - bend} ${target.y}, ${target.x} ${target.y}`;
}

function selectionMatchesLink(link) {
  if (!state.selected) return true;
  if (state.selected.type === 'host') return link.host === state.selected.value;
  if (state.selected.type === 'virus') return link.virus === state.selected.value;
  return link.host === state.selected.host && link.virus === state.selected.virus;
}

function updateNetworkDetail(network) {
  if (!state.selected) {
    els.networkDetail.innerHTML = `
      <p class="detail-label">Selection details</p>
      <h3>Select a node or link</h3>
      <p>Choose a host, virus or connecting line to isolate its evidence and inspect the associated records.</p>`;
    return;
  }

  let title;
  let type;
  let rows;
  let partners;

  if (state.selected.type === 'host') {
    title = state.selected.value;
    type = 'Host taxon';
    rows = state.filtered.filter((row) => row.host_taxon === title);
    partners = [...new Set(rows.map((row) => row.virus_taxon).filter(Boolean))].sort();
  } else if (state.selected.type === 'virus') {
    title = state.selected.value;
    type = 'Virus taxon';
    rows = state.filtered.filter((row) => row.virus_taxon === title);
    partners = [...new Set(rows.map((row) => row.host_taxon).filter(Boolean))].sort();
  } else {
    title = `${state.selected.host} ↔ ${state.selected.virus}`;
    type = 'Host–virus association';
    rows = state.filtered.filter((row) => associationKey(row) === `${state.selected.host}\u0000${state.selected.virus}`);
    partners = [];
  }

  const countries = [...new Set(rows.map((row) => row.country).filter(Boolean))].sort();
  const methods = [...new Set(rows.map((row) => row.detection_method).filter(Boolean))].sort();
  const partnerMarkup = partners.length
    ? `<dt>Connected taxa</dt><dd><ul>${partners.map((partner) => `<li>${escapeHtml(partner)}</li>`).join('')}</ul></dd>`
    : '';

  els.networkDetail.innerHTML = `
    <p class="detail-label">${escapeHtml(type)}</p>
    <h3>${escapeHtml(title)}</h3>
    <dl>
      <dt>Evidence records</dt><dd>${rows.length}</dd>
      <dt>Countries</dt><dd>${escapeHtml(countries.join(', ') || 'Not reported')}</dd>
      <dt>Methods</dt><dd>${escapeHtml(methods.join(', ') || 'Not reported')}</dd>
      ${partnerMarkup}
    </dl>`;
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function selectNetworkItem(selection, network) {
  const sameSelection = JSON.stringify(state.selected) === JSON.stringify(selection);
  state.selected = sameSelection ? null : selection;

  els.networkSvg.querySelectorAll('.network-edge').forEach((element) => {
    const matches = selectionMatchesLink({ host: element.dataset.host, virus: element.dataset.virus });
    element.classList.toggle('is-muted', Boolean(state.selected) && !matches);
    element.classList.toggle('is-selected', Boolean(state.selected) && matches);
  });

  els.networkSvg.querySelectorAll('.network-node').forEach((element) => {
    const type = element.dataset.type;
    const value = element.dataset.value;
    const exact = state.selected && state.selected.type === type && state.selected.value === value;
    let connected = true;
    if (state.selected) {
      connected = network.links.some((link) => selectionMatchesLink(link)
        && ((type === 'host' && link.host === value) || (type === 'virus' && link.virus === value)));
    }
    element.classList.toggle('is-selected', Boolean(exact));
    element.classList.toggle('is-muted', Boolean(state.selected) && !connected);
  });

  updateNetworkDetail(network);
}

function renderNetwork(rows) {
  const network = groupNetwork(rows);
  const hasData = network.links.length > 0;
  els.networkSvg.replaceChildren();
  els.networkEmpty.hidden = hasData;
  state.selected = null;
  updateNetworkDetail(network);

  if (!hasData) {
    els.networkSvg.setAttribute('viewBox', '0 0 900 410');
    els.networkStatus.textContent = state.rows.length
      ? 'No complete host–virus associations match the filters'
      : 'Waiting for review data';
    return;
  }

  const width = 940;
  const top = 62;
  const rowGap = 46;
  const height = Math.max(410, top * 2 + (Math.max(network.hosts.length, network.viruses.length) - 1) * rowGap);
  const hostX = 250;
  const virusX = 690;
  els.networkSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  els.networkSvg.style.height = `${height}px`;

  const hostPositions = new Map(network.hosts.map((host, index) => [host, {
    x: hostX,
    y: evenlySpaced(index, network.hosts.length, top, height - top)
  }]));
  const virusPositions = new Map(network.viruses.map((virus, index) => [virus, {
    x: virusX,
    y: evenlySpaced(index, network.viruses.length, top, height - top)
  }]));

  const hostHeading = createSvgElement('text', { x: 24, y: 28, class: 'network-column-label' });
  hostHeading.textContent = `Hosts · ${network.hosts.length}`;
  const virusHeading = createSvgElement('text', { x: width - 24, y: 28, class: 'network-column-label', 'text-anchor': 'end' });
  virusHeading.textContent = `Viruses · ${network.viruses.length}`;
  els.networkSvg.append(hostHeading, virusHeading);

  const maxLinkRecords = Math.max(...network.links.map((link) => link.rows.length));
  network.links.forEach((link) => {
    const path = createSvgElement('path', {
      d: curvePath(hostPositions.get(link.host), virusPositions.get(link.virus)),
      class: 'network-edge',
      'stroke-width': String(1.5 + (link.rows.length / maxLinkRecords) * 5),
      tabindex: '0',
      role: 'button',
      'aria-label': `${link.host} linked to ${link.virus}: ${link.rows.length} evidence records`
    });
    path.dataset.host = link.host;
    path.dataset.virus = link.virus;
    const selection = { type: 'link', host: link.host, virus: link.virus };
    path.addEventListener('click', () => selectNetworkItem(selection, network));
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectNetworkItem(selection, network);
      }
    });
    els.networkSvg.append(path);
  });

  const drawNodes = (names, positions, degrees, type) => {
    const maxDegree = Math.max(...names.map((name) => degrees.get(name)));
    names.forEach((name) => {
      const position = positions.get(name);
      const radius = 7 + (degrees.get(name) / maxDegree) * 8;
      const group = createSvgElement('g', {
        class: `network-node ${type}`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${type === 'host' ? 'Host' : 'Virus'} ${name}: ${degrees.get(name)} evidence records`
      });
      group.dataset.type = type;
      group.dataset.value = name;
      const circle = createSvgElement('circle', { cx: position.x, cy: position.y, r: radius });
      const text = createSvgElement('text', {
        x: type === 'host' ? position.x - radius - 9 : position.x + radius + 9,
        y: position.y + 4,
        'text-anchor': type === 'host' ? 'end' : 'start'
      });
      text.textContent = truncateLabel(name);
      const title = createSvgElement('title');
      title.textContent = name;
      group.append(circle, text, title);
      const selection = { type, value: name };
      group.addEventListener('click', () => selectNetworkItem(selection, network));
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNetworkItem(selection, network);
        }
      });
      els.networkSvg.append(group);
    });
  };

  drawNodes(network.hosts, hostPositions, network.hostDegrees, 'host');
  drawNodes(network.viruses, virusPositions, network.virusDegrees, 'virus');
  els.networkStatus.textContent = `${network.links.length} associations in the current selection`;
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
  if (state.rows.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = 'The data schema is ready; no biological records have been added yet.';
    els.status.textContent = 'Waiting for review data';
  } else {
    els.empty.textContent = 'No records match the current filters.';
    els.status.textContent = `${rows.length} of ${state.rows.length} records shown`;
  }
  updateStats(rows);
  renderNetwork(rows);
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

function resetFilters() {
  els.search.value = '';
  els.hostFamily.value = '';
  els.method.value = '';
  els.studyType.value = '';
  applyFilters();
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
  } catch (error) {
    console.error(error);
    els.status.textContent = 'Could not load data/detections.csv.';
    els.networkStatus.textContent = 'Data could not be loaded';
    els.empty.hidden = false;
    els.empty.textContent = 'The data file could not be loaded.';
    els.networkEmpty.hidden = false;
    els.networkEmpty.querySelector('span').textContent = 'Check that data/detections.csv exists and is valid.';
  }
}

[els.search, els.hostFamily, els.method, els.studyType].forEach((control) => {
  control.addEventListener('input', applyFilters);
  control.addEventListener('change', applyFilters);
});
els.reset.addEventListener('click', resetFilters);

init();
