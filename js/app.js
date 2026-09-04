const DEFAULT_EVIDENCE_GROUP = 'Natural direct detection';
const MAX_TABLE_ROWS = 150;
const MAX_DETAILED_VIRUS_NODES = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  rows: [],
  studies: [],
  hostReference: [],
  filtered: [],
  selected: null
};

const els = {
  search: document.querySelector('#searchInput'),
  evidenceGroup: document.querySelector('#evidenceGroupFilter'),
  result: document.querySelector('#resultFilter'),
  hostFamily: document.querySelector('#hostFamilyFilter'),
  virusFamily: document.querySelector('#virusFamilyFilter'),
  country: document.querySelector('#countryFilter'),
  method: document.querySelector('#methodFilter'),
  reset: document.querySelector('#resetFilters'),
  recordCount: document.querySelector('#recordCount'),
  articleCount: document.querySelector('#articleCount'),
  hostCount: document.querySelector('#hostCount'),
  virusCount: document.querySelector('#virusCount'),
  coverageGrid: document.querySelector('#coverageGrid'),
  networkSvg: document.querySelector('#networkSvg'),
  networkEmpty: document.querySelector('#networkEmpty'),
  networkStatus: document.querySelector('#networkStatus'),
  networkMode: document.querySelector('#networkMode'),
  networkDetail: document.querySelector('#networkDetail'),
  body: document.querySelector('#resultsBody'),
  empty: document.querySelector('#emptyState'),
  status: document.querySelector('#statusMessage')
};

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

function isReported(value) {
  const string = String(value || '').trim();
  return Boolean(string) && !/^(not reported|not applicable|cannot be determined)/i.test(string);
}

function validTaxon(value) {
  const string = String(value || '').trim();
  return isReported(string) && !/^(no current|not resolved|unresolved)/i.test(string);
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sourceKey(row) {
  return row.study_id || row.record_id;
}

function virusFamily(row) {
  return validTaxon(row.virus_family) ? row.virus_family : 'Unresolved virus family';
}

function uniqueValues(key, options = {}) {
  const values = state.rows.map((row) => row[key]).filter((value) => options.includeUnreported || isReported(value));
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, values, allLabel) {
  select.replaceChildren();
  const all = document.createElement('option');
  all.value = '';
  all.textContent = allLabel;
  select.append(all);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function countUnique(rows, key) {
  return new Set(rows.map((row) => row[key]).filter(isReported)).size;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(value < .01 ? 2 : 1)}%`;
}

function updateStats(rows) {
  els.recordCount.textContent = formatNumber(rows.length);
  els.articleCount.textContent = formatNumber(new Set(rows.map(sourceKey).filter(Boolean)).size);
  els.hostCount.textContent = formatNumber(countUnique(rows, 'host_latin'));
  els.virusCount.textContent = formatNumber(countUnique(rows, 'virus_current'));
}

function renderCoverage() {
  els.coverageGrid.replaceChildren();
  const referenceNames = new Set(state.hostReference.map((row) => row.host_latin));
  const testedSpecies = new Set(state.rows
    .filter((row) => referenceNames.has(row.host_latin) && numberOrNull(row.n_tested) !== null)
    .map((row) => row.host_latin));

  const families = new Map();
  state.hostReference.forEach((row) => {
    if (!families.has(row.host_family)) families.set(row.host_family, { total: 0, tested: 0 });
    const family = families.get(row.host_family);
    family.total += 1;
    if (testedSpecies.has(row.host_latin)) family.tested += 1;
  });

  [...families.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, counts]) => {
    const percentage = counts.total ? counts.tested / counts.total : 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'coverage-card';
    button.classList.toggle('is-active', els.hostFamily.value === name);
    button.setAttribute('aria-label', `Filter network to ${name}: ${counts.tested} of ${counts.total} species explicitly tested`);

    const heading = document.createElement('span');
    heading.className = 'coverage-name';
    heading.textContent = name;
    const count = document.createElement('strong');
    count.textContent = `${counts.tested} / ${counts.total}`;
    const caption = document.createElement('span');
    caption.className = 'coverage-caption';
    caption.textContent = `${formatPercent(percentage)} of recognized species`;
    const track = document.createElement('span');
    track.className = 'coverage-track';
    const bar = document.createElement('span');
    bar.className = 'coverage-bar';
    bar.style.width = `${percentage * 100}%`;
    track.append(bar);
    button.append(heading, count, caption, track);
    button.addEventListener('click', () => {
      els.hostFamily.value = els.hostFamily.value === name ? '' : name;
      applyFilters();
      document.querySelector('#network-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.coverageGrid.append(button);
  });
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function truncateLabel(label, maximum = 30) {
  return label.length > maximum ? `${label.slice(0, maximum - 1)}…` : label;
}

function quantitativeSummary(rows, detailed) {
  if (!detailed) return { tested: null, positive: null, prevalence: null };
  const eligible = rows.filter((row) => row.overall_prevalence === 'Yes'
    && numberOrNull(row.n_tested) !== null
    && numberOrNull(row.n_positive) !== null);
  const uniqueRecords = [...new Map(eligible.map((row) => [row.record_id, row])).values()];
  const tested = uniqueRecords.reduce((sum, row) => sum + numberOrNull(row.n_tested), 0);
  const positive = uniqueRecords.reduce((sum, row) => sum + numberOrNull(row.n_positive), 0);
  return { tested, positive, prevalence: tested > 0 ? positive / tested : null };
}

function buildNetwork(rows) {
  const detailed = Boolean(els.hostFamily.value);
  const links = new Map();

  rows.filter((row) => isReported(row.host_latin) && isReported(row.virus_current)).forEach((row) => {
    const host = detailed ? row.host_latin : row.host_family;
    const virus = detailed ? row.virus_current : virusFamily(row);
    if (!host || !virus) return;
    const key = `${host}\u0000${virus}`;
    if (!links.has(key)) links.set(key, { host, virus, rows: [] });
    links.get(key).rows.push(row);
  });

  let linkList = [...links.values()].map((link) => {
    const studies = new Set(link.rows.map(sourceKey).filter(Boolean)).size;
    const status = link.rows.some((row) => row.result_status === 'Positive')
      ? 'Positive'
      : link.rows.some((row) => row.result_status === 'Negative') ? 'Negative' : 'Uncertain / not applicable';
    return { ...link, studies, status, ...quantitativeSummary(link.rows, detailed) };
  });

  let truncated = false;
  if (detailed && !els.virusFamily.value && !els.search.value.trim()) {
    const virusWeights = new Map();
    linkList.forEach((link) => virusWeights.set(link.virus, (virusWeights.get(link.virus) || 0) + link.studies));
    if (virusWeights.size > MAX_DETAILED_VIRUS_NODES) {
      const keep = new Set([...virusWeights.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_DETAILED_VIRUS_NODES)
        .map(([virus]) => virus));
      linkList = linkList.filter((link) => keep.has(link.virus));
      truncated = true;
    }
  }

  const hostWeights = new Map();
  const virusWeights = new Map();
  linkList.forEach((link) => {
    hostWeights.set(link.host, (hostWeights.get(link.host) || 0) + link.studies);
    virusWeights.set(link.virus, (virusWeights.get(link.virus) || 0) + link.studies);
  });
  const sortNodes = (weights) => (a, b) => weights.get(b) - weights.get(a) || a.localeCompare(b);

  return {
    detailed,
    links: linkList,
    hosts: [...hostWeights.keys()].sort(sortNodes(hostWeights)),
    viruses: [...virusWeights.keys()].sort(sortNodes(virusWeights)),
    hostWeights,
    virusWeights,
    truncated
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

function edgeColor(link) {
  if (link.status === 'Negative') return '#9da7a1';
  if (link.status !== 'Positive') return '#c3a15a';
  if (link.prevalence === null) return '#287a58';
  const lightness = 72 - Math.min(.65, link.prevalence) * 62;
  return `hsl(14 67% ${lightness}%)`;
}

function edgeWidth(link, detailed) {
  const basis = detailed && link.tested ? Math.log1p(link.tested) : Math.log1p(link.studies);
  return Math.min(9, 1.4 + basis * 1.25);
}

function selectionMatchesLink(link) {
  if (!state.selected) return true;
  if (state.selected.type === 'host') return link.host === state.selected.value;
  if (state.selected.type === 'virus') return link.virus === state.selected.value;
  return link.host === state.selected.host && link.virus === state.selected.virus;
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}

function renderNetworkDetail(network) {
  if (!state.selected) {
    els.networkDetail.innerHTML = `
      <p class="detail-label">Selection details</p>
      <h3>Select a node or link</h3>
      <p>Choose a host, virus or connecting line to inspect its evidence.</p>`;
    return;
  }

  let title;
  let type;
  let links;
  if (state.selected.type === 'host') {
    title = state.selected.value;
    type = network.detailed ? 'Host taxon' : 'Host family';
    links = network.links.filter((link) => link.host === title);
  } else if (state.selected.type === 'virus') {
    title = state.selected.value;
    type = network.detailed ? 'Virus taxon' : 'Virus family';
    links = network.links.filter((link) => link.virus === title);
  } else {
    title = `${state.selected.host} ↔ ${state.selected.virus}`;
    type = 'Association';
    links = network.links.filter((link) => link.host === state.selected.host && link.virus === state.selected.virus);
  }

  const rows = links.flatMap((link) => link.rows);
  const studies = new Set(rows.map(sourceKey).filter(Boolean)).size;
  const countries = [...new Set(rows.map((row) => row.country).filter(isReported))].sort();
  const statuses = [...new Set(rows.map((row) => row.result_status))];
  const quantitative = quantitativeSummary(rows, network.detailed && state.selected.type === 'link');
  const prevalence = quantitative.prevalence === null
    ? 'Not combined at this level'
    : `${formatPercent(quantitative.prevalence)} (${formatNumber(quantitative.positive)}/${formatNumber(quantitative.tested)})`;
  const partners = state.selected.type === 'host'
    ? links.map((link) => link.virus)
    : state.selected.type === 'virus' ? links.map((link) => link.host) : [];

  els.networkDetail.innerHTML = `
    <p class="detail-label">${escapeHtml(type)}</p>
    <h3>${escapeHtml(title)}</h3>
    <dl>
      <dt>Articles</dt><dd>${formatNumber(studies)}</dd>
      <dt>Evidence status</dt><dd>${escapeHtml(statuses.join(', '))}</dd>
      <dt>Aggregated prevalence</dt><dd>${escapeHtml(prevalence)}</dd>
      <dt>Countries</dt><dd>${escapeHtml(countries.join(', ') || 'Not reported')}</dd>
      ${partners.length ? `<dt>Connected taxa</dt><dd><ul>${partners.slice(0, 14).map((partner) => `<li>${escapeHtml(partner)}</li>`).join('')}${partners.length > 14 ? `<li>+ ${partners.length - 14} more</li>` : ''}</ul></dd>` : ''}
    </dl>`;
}

function selectNetworkItem(selection, network) {
  state.selected = JSON.stringify(state.selected) === JSON.stringify(selection) ? null : selection;

  els.networkSvg.querySelectorAll('.network-edge').forEach((element) => {
    const matches = selectionMatchesLink({ host: element.dataset.host, virus: element.dataset.virus });
    element.classList.toggle('is-muted', Boolean(state.selected) && !matches);
    element.classList.toggle('is-selected', Boolean(state.selected) && matches);
  });
  els.networkSvg.querySelectorAll('.network-node').forEach((element) => {
    const type = element.dataset.type;
    const value = element.dataset.value;
    const exact = state.selected && state.selected.type === type && state.selected.value === value;
    const connected = !state.selected || network.links.some((link) => selectionMatchesLink(link)
      && ((type === 'host' && link.host === value) || (type === 'virus' && link.virus === value)));
    element.classList.toggle('is-selected', Boolean(exact));
    element.classList.toggle('is-muted', Boolean(state.selected) && !connected);
  });
  renderNetworkDetail(network);
}

function renderNetwork(rows) {
  const network = buildNetwork(rows);
  const hasData = network.links.length > 0;
  state.selected = null;
  els.networkSvg.replaceChildren();
  els.networkSvg.style.height = '';
  els.networkEmpty.hidden = hasData;
  renderNetworkDetail(network);

  els.networkMode.textContent = network.detailed
    ? `Species-to-virus view for ${els.hostFamily.value}. Edge width reflects non-overlapping host denominators where available.`
    : 'Overview by host family and virus family. Select a host family above to open the species-level network.';

  if (!hasData) {
    els.networkSvg.setAttribute('viewBox', '0 0 940 420');
    els.networkStatus.textContent = 'No associations match the filters';
    return;
  }

  const width = 980;
  const top = 62;
  const rowGap = network.detailed ? 39 : 48;
  const maximumNodes = Math.max(network.hosts.length, network.viruses.length);
  const height = Math.max(420, top * 2 + (maximumNodes - 1) * rowGap);
  const hostX = 275;
  const virusX = 705;
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

  const hostHeading = createSvgElement('text', { x: 24, y: 29, class: 'network-column-label' });
  hostHeading.textContent = `${network.detailed ? 'Host taxa' : 'Host families'} · ${network.hosts.length}`;
  const virusHeading = createSvgElement('text', { x: width - 24, y: 29, class: 'network-column-label', 'text-anchor': 'end' });
  virusHeading.textContent = `${network.detailed ? 'Virus taxa' : 'Virus families'} · ${network.viruses.length}`;
  els.networkSvg.append(hostHeading, virusHeading);

  network.links.forEach((link) => {
    const quantitative = link.prevalence === null ? 'no combined prevalence' : `${formatPercent(link.prevalence)} (${link.positive}/${link.tested})`;
    const path = createSvgElement('path', {
      d: curvePath(hostPositions.get(link.host), virusPositions.get(link.virus)),
      class: 'network-edge',
      stroke: edgeColor(link),
      'stroke-width': edgeWidth(link, network.detailed),
      tabindex: '0',
      role: 'button',
      'aria-label': `${link.host} linked to ${link.virus}; ${link.studies} articles; ${link.status}; ${quantitative}`
    });
    path.dataset.host = link.host;
    path.dataset.virus = link.virus;
    const title = createSvgElement('title');
    title.textContent = `${link.host} ↔ ${link.virus}\n${link.studies} articles · ${link.status}\n${quantitative}`;
    path.append(title);
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

  const drawNodes = (names, positions, weights, type) => {
    const maxWeight = Math.max(...names.map((name) => weights.get(name)));
    names.forEach((name) => {
      const position = positions.get(name);
      const radius = 6 + Math.sqrt(weights.get(name) / maxWeight) * 9;
      const group = createSvgElement('g', {
        class: `network-node ${type}`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${type === 'host' ? 'Host' : 'Virus'} ${name}`
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

  drawNodes(network.hosts, hostPositions, network.hostWeights, 'host');
  drawNodes(network.viruses, virusPositions, network.virusWeights, 'virus');
  const limitNote = network.truncated ? ` · top ${MAX_DETAILED_VIRUS_NODES} virus taxa shown; use virus-family or search filters to narrow` : '';
  els.networkStatus.textContent = `${formatNumber(network.links.length)} associations${limitNote}`;
}

function appendText(element, value, className) {
  const line = document.createElement('span');
  if (className) line.className = className;
  line.textContent = value || '—';
  element.append(line);
}

function studyLink(row) {
  if (/^\d+$/.test(row.pmid)) return `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`;
  if (row.doi) return `https://doi.org/${row.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;
  return '';
}

function renderRows(rows) {
  els.body.replaceChildren();
  const visible = rows.slice(0, MAX_TABLE_ROWS);

  visible.forEach((row) => {
    const tr = document.createElement('tr');

    const host = document.createElement('td');
    appendText(host, row.host_latin, 'taxon-name');
    appendText(host, row.host_family, 'cell-meta');

    const virus = document.createElement('td');
    appendText(virus, row.virus_current, 'taxon-name');
    appendText(virus, virusFamily(row), 'cell-meta');

    const evidence = document.createElement('td');
    appendText(evidence, row.evidence_group, 'evidence-pill');
    appendText(evidence, row.evidence_category, 'cell-meta');

    const result = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `result-badge ${row.result_status.toLowerCase().replace(/[^a-z]+/g, '-')}`;
    badge.textContent = row.result_status;
    result.append(badge);
    const nTested = numberOrNull(row.n_tested);
    const nPositive = numberOrNull(row.n_positive);
    if (nTested !== null && nPositive !== null) appendText(result, `${nPositive}/${nTested} hosts`, 'cell-meta');

    const place = document.createElement('td');
    appendText(place, [row.country, row.locality].filter(isReported).join(' · '), 'cell-primary');
    appendText(place, isReported(row.collection_period) ? row.collection_period : 'Period not reported', 'cell-meta');

    const method = document.createElement('td');
    appendText(method, row.method_group, 'cell-primary');
    appendText(method, row.sample_type, 'cell-meta');

    const study = document.createElement('td');
    appendText(study, `${row.first_author || 'Unknown author'} · ${row.publication_year || 'year not reported'}`, 'cell-meta');
    const url = studyLink(row);
    if (url) {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = row.article_title || row.pmid || row.doi;
      study.append(anchor);
    } else {
      appendText(study, row.article_title, 'cell-primary');
    }

    tr.append(host, virus, evidence, result, place, method, study);
    els.body.append(tr);
  });

  els.empty.hidden = rows.length > 0;
  els.status.textContent = rows.length > MAX_TABLE_ROWS
    ? `Showing first ${MAX_TABLE_ROWS} of ${formatNumber(rows.length)} matching records`
    : `${formatNumber(rows.length)} matching records`;
}

function applyFilters() {
  const query = els.search.value.trim().toLowerCase();
  state.filtered = state.rows.filter((row) => (!query || row._search.includes(query))
    && (!els.evidenceGroup.value || row.evidence_group === els.evidenceGroup.value)
    && (!els.result.value || row.result_status === els.result.value)
    && (!els.hostFamily.value || row.host_family === els.hostFamily.value)
    && (!els.virusFamily.value || virusFamily(row) === els.virusFamily.value)
    && (!els.country.value || row.country === els.country.value)
    && (!els.method.value || row.method_group === els.method.value));

  updateStats(state.filtered);
  renderCoverage();
  renderNetwork(state.filtered);
  renderRows(state.filtered);
}

function resetFilters() {
  els.search.value = '';
  els.evidenceGroup.value = DEFAULT_EVIDENCE_GROUP;
  els.result.value = '';
  els.hostFamily.value = '';
  els.virusFamily.value = '';
  els.country.value = '';
  els.method.value = '';
  applyFilters();
}

async function loadCsv(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return parseCsv(await response.text());
}

async function init() {
  try {
    [state.rows, state.studies, state.hostReference] = await Promise.all([
      loadCsv('data/detections.csv'),
      loadCsv('data/studies.csv'),
      loadCsv('data/host_reference.csv')
    ]);
    const studiesById = new Map(state.studies.map((study) => [study.study_id, study]));
    state.rows.forEach((row) => {
      Object.assign(row, studiesById.get(row.study_id) || {});
      row._search = Object.values(row).join(' ').toLowerCase();
    });

    const evidenceOrder = [
      'Natural direct detection',
      'Serology',
      'Pooled sequencing',
      'Experimental evidence',
      'Indirect or contextual evidence'
    ].filter((value) => state.rows.some((row) => row.evidence_group === value));
    fillSelect(els.evidenceGroup, evidenceOrder, 'All evidence layers');
    fillSelect(els.result, uniqueValues('result_status', { includeUnreported: true }), 'All results');
    fillSelect(els.hostFamily, uniqueValues('host_family'), 'All host families');
    fillSelect(els.virusFamily, [...new Set(state.rows.map(virusFamily))].sort(), 'All virus families');
    fillSelect(els.country, uniqueValues('country'), 'All countries');
    fillSelect(els.method, uniqueValues('method_group'), 'All methods');
    els.evidenceGroup.value = DEFAULT_EVIDENCE_GROUP;
    applyFilters();
  } catch (error) {
    console.error(error);
    els.status.textContent = 'The evidence data could not be loaded.';
    els.networkStatus.textContent = 'Data unavailable';
    els.empty.hidden = false;
    els.empty.textContent = 'The public data files could not be loaded.';
    els.networkEmpty.hidden = false;
    els.coverageGrid.textContent = 'Coverage data unavailable.';
  }
}

[els.search, els.evidenceGroup, els.result, els.hostFamily, els.virusFamily, els.country, els.method]
  .forEach((control) => {
    control.addEventListener('input', applyFilters);
    control.addEventListener('change', applyFilters);
  });
els.reset.addEventListener('click', resetFilters);

init();
