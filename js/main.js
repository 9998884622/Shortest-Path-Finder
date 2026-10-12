/**
 * main.js
 * ------------------------------------------------------------
 * UI logic for the Shortest Path Finder:
 *  - graph data model (edge list) + localStorage persistence
 *  - SVG rendering of nodes / edges
 *  - running Dijkstra and showing results
 *  - step-by-step replay
 *  - graph editor (add / remove edges)
 * ------------------------------------------------------------
 */

(function () {
  'use strict';

  /* ---------------------------------------------------------
   * Sample graph  (A → C → E → F = 2 + 3 + 7 = 12)
   * --------------------------------------------------------- */
  const SAMPLE_EDGES = [
    { from: 'A', to: 'B', weight: 4,  directed: false },
    { from: 'A', to: 'C', weight: 2,  directed: false },
    { from: 'B', to: 'C', weight: 5,  directed: false },
    { from: 'B', to: 'D', weight: 10, directed: false },
    { from: 'C', to: 'E', weight: 3,  directed: false },
    { from: 'D', to: 'F', weight: 11, directed: false },
    { from: 'E', to: 'D', weight: 4,  directed: false },
    { from: 'E', to: 'F', weight: 7,  directed: false },
    { from: 'E', to: 'G', weight: 6,  directed: false },
    { from: 'G', to: 'F', weight: 5,  directed: false }
  ];

  const SAMPLE_POSITIONS = {
    A: { x: 80,  y: 210 },
    B: { x: 230, y: 90  },
    C: { x: 230, y: 330 },
    D: { x: 410, y: 90  },
    E: { x: 410, y: 330 },
    F: { x: 560, y: 160 },
    G: { x: 560, y: 340 }
  };

  const VIEW_W = 640;
  const VIEW_H = 420;
  const NODE_R = 22;
  const STORAGE_KEY = 'dijkstra-graph-edges-v1';

  /* ---------------------------------------------------------
   * State
   * --------------------------------------------------------- */
  let edges = loadEdges();
  let lastResult = null;       // result of last dijkstra run
  let stepIndex = -1;          // index into lastResult.steps
  let playTimer = null;

  /* ---------------------------------------------------------
   * DOM refs
   * --------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  const sourceSelect = $('source-select');
  const destSelect = $('destination-select');
  const finderForm = $('finder-form');
  const swapBtn = $('swap-btn');
  const resetBtn = $('reset-btn');

  const resultPlaceholder = $('result-placeholder');
  const resultContent = $('result-content');
  const resultPath = $('result-path');
  const resultDistance = $('result-distance');
  const resultMeta = $('result-meta');
  const resultError = $('result-error');
  const resultErrorText = $('result-error-text');

  const svg = $('graph-svg');
  const tableBody = $('distance-table-body');

  const stepsList = $('steps-list');
  const stepPrevBtn = $('step-prev-btn');
  const stepNextBtn = $('step-next-btn');
  const stepPlayBtn = $('step-play-btn');
  const stepCounter = $('step-counter');

  const addEdgeForm = $('add-edge-form');
  const edgeFrom = $('edge-from');
  const edgeTo = $('edge-to');
  const edgeWeight = $('edge-weight');
  const edgeDirected = $('edge-directed');
  const edgeList = $('edge-list');
  const edgeCount = $('edge-count');
  const loadSampleBtn = $('load-sample-btn');
  const clearGraphBtn = $('clear-graph-btn');

  /* ---------------------------------------------------------
   * Persistence
   * --------------------------------------------------------- */
  function loadEdges() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) { /* ignore */ }
    return SAMPLE_EDGES.map(e => ({ ...e }));
  }

  function saveEdges() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(edges)); } catch (_) { /* ignore */ }
  }

  /* ---------------------------------------------------------
   * Graph helpers
   * --------------------------------------------------------- */
  function getNodes() {
    const set = new Set();
    edges.forEach(e => { set.add(e.from); set.add(e.to); });
    return [...set].sort();
  }

  function buildGraph() {
    const nodes = getNodes();
    const adj = {};
    nodes.forEach(n => { adj[n] = []; });
    edges.forEach(e => {
      adj[e.from].push({ to: e.to, weight: e.weight });
      if (!e.directed) adj[e.to].push({ to: e.from, weight: e.weight });
    });
    return { nodes, adj };
  }

  /** Compute positions: preset for sample nodes, otherwise circular layout. */
  function getPositions(nodes) {
    const allPreset = nodes.every(n => SAMPLE_POSITIONS[n]);
    if (allPreset) {
      const pos = {};
      nodes.forEach(n => { pos[n] = SAMPLE_POSITIONS[n]; });
      return pos;
    }
    const pos = {};
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const rx = VIEW_W / 2 - NODE_R - 40;
    const ry = VIEW_H / 2 - NODE_R - 30;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      pos[n] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
    });
    return pos;
  }

  function hasReverseDirected(e) {
    return e.directed && edges.some(o => o.directed && o.from === e.to && o.to === e.from);
  }

  /* ---------------------------------------------------------
   * SVG rendering
   * --------------------------------------------------------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function renderGraph() {
    svg.innerHTML = '';
    const nodes = getNodes();

    if (nodes.length === 0) {
      const t = svgEl('text', { x: VIEW_W / 2, y: VIEW_H / 2, 'text-anchor': 'middle', fill: '#94a3c4', 'font-size': 16 });
      t.textContent = 'Graph is empty — add edges below or load the sample.';
      svg.appendChild(t);
      return;
    }

    const pos = getPositions(nodes);

    // Arrow marker definition
    const defs = svgEl('defs');
    const marker = svgEl('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'arrow-head' }));
    defs.appendChild(marker);
    const markerPath = svgEl('marker', { id: 'arrow-path', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
    markerPath.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#fbbf24' }));
    defs.appendChild(markerPath);
    svg.appendChild(defs);

    const edgeLayer = svgEl('g', { id: 'edge-layer' });
    const nodeLayer = svgEl('g', { id: 'node-layer' });
    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);

    // Edges
    edges.forEach((e, idx) => {
      const p1 = pos[e.from];
      const p2 = pos[e.to];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      // shorten so the line stops at the circle edge
      const sx = p1.x + ux * NODE_R;
      const sy = p1.y + uy * NODE_R;
      const ex = p2.x - ux * (NODE_R + (e.directed ? 3 : 0));
      const ey = p2.y - uy * (NODE_R + (e.directed ? 3 : 0));

      const g = svgEl('g', { class: 'edge-group', 'data-from': e.from, 'data-to': e.to, 'data-directed': e.directed, 'data-index': idx });

      let midX, midY;
      if (hasReverseDirected(e)) {
        // curve to separate opposite directed edges
        const off = 28;
        const cx = (sx + ex) / 2 - uy * off;
        const cy = (sy + ey) / 2 + ux * off;
        const path = svgEl('path', { d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, class: 'edge-line', fill: 'none', 'marker-end': 'url(#arrow)' });
        g.appendChild(path);
        midX = 0.25 * sx + 0.5 * cx + 0.25 * ex;
        midY = 0.25 * sy + 0.5 * cy + 0.25 * ey;
      } else {
        const line = svgEl('line', { x1: sx, y1: sy, x2: ex, y2: ey, class: 'edge-line' });
        if (e.directed) line.setAttribute('marker-end', 'url(#arrow)');
        g.appendChild(line);
        midX = (sx + ex) / 2;
        midY = (sy + ey) / 2;
      }

      // weight label
      const label = String(e.weight);
      const w = Math.max(22, label.length * 8 + 10);
      g.appendChild(svgEl('rect', { x: midX - w / 2, y: midY - 10, width: w, height: 20, rx: 6, class: 'edge-weight-bg' }));
      const t = svgEl('text', { x: midX, y: midY, class: 'edge-weight-text' });
      t.textContent = label;
      g.appendChild(t);

      edgeLayer.appendChild(g);
    });

    // Nodes
    nodes.forEach(n => {
      const p = pos[n];
      const g = svgEl('g', { class: 'node-group', 'data-node': n, tabindex: 0, role: 'button', 'aria-label': `Node ${n}` });
      g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: NODE_R, class: 'node-circle' }));
      const label = svgEl('text', { x: p.x, y: p.y, class: 'node-label' });
      label.textContent = n;
      g.appendChild(label);
      const dist = svgEl('text', { x: p.x, y: p.y + NODE_R + 14, class: 'node-dist', 'data-dist-for': n });
      dist.textContent = '';
      g.appendChild(dist);

      g.addEventListener('click', (ev) => {
        if (ev.shiftKey) destSelect.value = n; else sourceSelect.value = n;
        showToast(ev.shiftKey ? `Destination set to ${n}` : `Source set to ${n}`);
        runSearch();
      });
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); g.click(); }
      });
      nodeLayer.appendChild(g);
    });
  }

  /** Reset all highlight classes. */
  function clearHighlights() {
    svg.querySelectorAll('.node-group').forEach(g => g.classList.remove('visited', 'current', 'on-path', 'source', 'dest'));
    svg.querySelectorAll('.edge-group').forEach(g => {
      g.classList.remove('on-path');
      const line = g.querySelector('.edge-line');
      line.classList.remove('relaxing');
      if (g.dataset.directed === 'true') line.setAttribute('marker-end', 'url(#arrow)');
    });
    svg.querySelectorAll('.node-dist').forEach(t => { t.textContent = ''; });
  }

  function edgeGroupFor(a, b) {
    // find matching edge group (respecting direction for directed edges)
    const groups = [...svg.querySelectorAll('.edge-group')];
    return groups.find(g => {
      const f = g.dataset.from, t = g.dataset.to, d = g.dataset.directed === 'true';
      if (f === a && t === b) return true;
      if (!d && f === b && t === a) return true;
      return false;
    }) || null;
  }

  function markEndpoints(src, dst) {
    const s = svg.querySelector(`.node-group[data-node="${CSS.escape(src)}"]`);
    const d = svg.querySelector(`.node-group[data-node="${CSS.escape(dst)}"]`);
    if (s) s.classList.add('source');
    if (d) d.classList.add('dest');
  }

  function highlightPath(path) {
    for (let i = 0; i < path.length; i++) {
      const g = svg.querySelector(`.node-group[data-node="${CSS.escape(path[i])}"]`);
      if (g) g.classList.add('on-path');
      if (i < path.length - 1) {
        const eg = edgeGroupFor(path[i], path[i + 1]);
        if (eg) {
          eg.classList.add('on-path');
          const line = eg.querySelector('.edge-line');
          if (eg.dataset.directed === 'true') line.setAttribute('marker-end', 'url(#arrow-path)');
        }
      }
    }
  }

  function updateDistLabels(dist) {
    Object.entries(dist).forEach(([n, d]) => {
      const t = svg.querySelector(`.node-dist[data-dist-for="${CSS.escape(n)}"]`);
      if (t) t.textContent = d === Infinity ? '∞' : String(d);
    });
  }

  /* ---------------------------------------------------------
   * Selects
   * --------------------------------------------------------- */
  function populateSelects() {
    const nodes = getNodes();
    const prevSrc = sourceSelect.value;
    const prevDst = destSelect.value;
    [sourceSelect, destSelect].forEach(sel => {
      sel.innerHTML = '';
      nodes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        sel.appendChild(opt);
      });
    });
    if (nodes.includes(prevSrc)) sourceSelect.value = prevSrc;
    if (nodes.includes(prevDst)) destSelect.value = prevDst;
    else if (nodes.length > 1) destSelect.value = nodes[nodes.length - 1];
    if (!nodes.includes(prevSrc) && nodes.length) sourceSelect.value = nodes[0];
  }

  /* ---------------------------------------------------------
   * Running the algorithm
   * --------------------------------------------------------- */
  function runSearch() {
    stopPlay();
    const src = sourceSelect.value;
    const dst = destSelect.value;
    const graph = buildGraph();

    if (!src || !dst) {
      showError('Please add at least one edge to the graph first.');
      return;
    }

    const result = dijkstra(graph, src, dst);
    lastResult = result;

    if (result.error) {
      showError(result.error);
      return;
    }

    // Visual
    clearHighlights();
    markEndpoints(src, dst);
    updateDistLabels(result.dist);
    result.visitedOrder.forEach(n => {
      const g = svg.querySelector(`.node-group[data-node="${CSS.escape(n)}"]`);
      if (g) g.classList.add('visited');
    });

    if (result.found) {
      highlightPath(result.path);
      showResult(result, src, dst);
    } else {
      showError(`No path exists from ${src} to ${dst}.`);
    }

    renderTable(result, src, dst);
    renderSteps(result.steps);
    stepIndex = result.steps.length - 1;
    updateStepControls();
  }

  function showResult(result, src, dst) {
    resultPlaceholder.classList.add('hidden');
    resultError.classList.add('hidden');
    resultContent.classList.remove('hidden');

    resultPath.innerHTML = '';
    result.path.forEach((n, i) => {
      const span = document.createElement('span');
      span.className = 'path-node';
      span.textContent = n;
      resultPath.appendChild(span);
      if (i < result.path.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'path-arrow';
        arrow.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
        resultPath.appendChild(arrow);
      }
    });

    resultDistance.textContent = String(result.distance);

    const hops = result.path.length - 1;
    const srcDstText = src === dst
      ? 'Source and destination are the same node.'
      : `${hops} edge${hops === 1 ? '' : 's'} · ${result.visitedOrder.length} node${result.visitedOrder.length === 1 ? '' : 's'} visited · ${result.steps.length} steps`;
    resultMeta.textContent = srcDstText;
  }

  function showError(msg) {
    resultPlaceholder.classList.add('hidden');
    resultContent.classList.add('hidden');
    resultError.classList.remove('hidden');
    resultErrorText.textContent = msg;
  }

  function resetResults() {
    stopPlay();
    lastResult = null;
    stepIndex = -1;
    clearHighlights();
    resultPlaceholder.classList.remove('hidden');
    resultContent.classList.add('hidden');
    resultError.classList.add('hidden');
    tableBody.innerHTML = '<tr><td colspan="4" class="muted center">Run the algorithm to fill this table.</td></tr>';
    stepsList.innerHTML = '<li class="muted">No steps yet — run the algorithm first.</li>';
    updateStepControls();
  }

  /* ---------------------------------------------------------
   * Distance table
   * --------------------------------------------------------- */
  function renderTable(result, src, dst) {
    tableBody.innerHTML = '';
    const nodes = Object.keys(result.dist).sort();
    nodes.forEach(n => {
      const tr = document.createElement('tr');
      const d = result.dist[n];
      const p = result.prev[n];
      const path = d === Infinity ? '—' : reconstructPath(result.prev, n).join(' → ');
      if (result.found && result.path.includes(n)) tr.classList.add('row-on-path');
      if (n === src) tr.classList.add('row-source');
      if (n === dst) tr.classList.add('row-dest');
      tr.innerHTML = `<td>${esc(n)}</td><td>${d === Infinity ? '∞' : d}</td><td>${p === null ? '—' : esc(p)}</td><td>${esc(path)}</td>`;
      tableBody.appendChild(tr);
    });
  }

  /* ---------------------------------------------------------
   * Steps replay
   * --------------------------------------------------------- */
  function renderSteps(steps) {
    stepsList.innerHTML = '';
    steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = `step-${s.type}`;
      li.innerHTML = s.text; // text is generated internally with escaped node names
      li.dataset.index = i;
      li.addEventListener('click', () => { stopPlay(); goToStep(i); });
      stepsList.appendChild(li);
    });
    stepsList.querySelectorAll('li').forEach(li => { li.style.cursor = 'pointer'; });
    highlightActiveStep();
  }

  function highlightActiveStep() {
    stepsList.querySelectorAll('li').forEach(li => li.classList.toggle('active', Number(li.dataset.index) === stepIndex));
    const active = stepsList.querySelector('li.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function goToStep(i) {
    if (!lastResult) return;
    const steps = lastResult.steps;
    if (i < 0 || i >= steps.length) return;
    stepIndex = i;
    const s = steps[i];
    const src = sourceSelect.value;
    const dst = destSelect.value;

    clearHighlights();
    markEndpoints(src, dst);
    updateDistLabels(s.dist);
    s.visited.forEach(n => {
      const g = svg.querySelector(`.node-group[data-node="${CSS.escape(n)}"]`);
      if (g) g.classList.add('visited');
    });
    if (s.current) {
      const g = svg.querySelector(`.node-group[data-node="${CSS.escape(s.current)}"]`);
      if (g) g.classList.add('current');
    }
    if (s.edge) {
      const eg = edgeGroupFor(s.edge[0], s.edge[1]);
      if (eg) eg.querySelector('.edge-line').classList.add('relaxing');
    }
    if (i === steps.length - 1 && lastResult.found) {
      highlightPath(lastResult.path);
    }
    highlightActiveStep();
    updateStepControls();
  }

  function updateStepControls() {
    const total = lastResult ? lastResult.steps.length : 0;
    stepCounter.textContent = `${total ? stepIndex + 1 : 0} / ${total}`;
    stepPrevBtn.disabled = !lastResult || stepIndex <= 0;
    stepNextBtn.disabled = !lastResult || stepIndex >= total - 1;
    stepPlayBtn.disabled = !lastResult || total === 0;
  }

  function startPlay() {
    if (!lastResult) return;
    if (stepIndex >= lastResult.steps.length - 1) stepIndex = -1;
    stepPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    playTimer = setInterval(() => {
      if (stepIndex >= lastResult.steps.length - 1) { stopPlay(); return; }
      goToStep(stepIndex + 1);
    }, 900);
    goToStep(stepIndex + 1);
  }

  function stopPlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    stepPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto-play';
  }

  /* ---------------------------------------------------------
   * Editor
   * --------------------------------------------------------- */
  function renderEdgeList() {
    edgeList.innerHTML = '';
    edgeCount.textContent = edges.length;
    if (edges.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No edges yet.';
      edgeList.appendChild(li);
      return;
    }
    edges.forEach((e, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${esc(e.from)} <span class="edge-dir">${e.directed ? '→' : '—'}</span> ${esc(e.to)} <span class="edge-w">(${e.weight})</span></span>
        <button type="button" class="edge-remove" data-index="${i}" title="Remove edge" aria-label="Remove edge ${esc(e.from)} to ${esc(e.to)}"><i class="fa-solid fa-xmark"></i></button>`;
      edgeList.appendChild(li);
    });
  }

  function refreshAll() {
    saveEdges();
    populateSelects();
    renderGraph();
    renderEdgeList();
    resetResults();
  }

  addEdgeForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const from = edgeFrom.value.trim().toUpperCase();
    const to = edgeTo.value.trim().toUpperCase();
    const weight = Number(edgeWeight.value);
    const directed = edgeDirected.checked;

    if (!from || !to) { showToast('Both node names are required.', true); return; }
    if (!/^[A-Z0-9]+$/.test(from) || !/^[A-Z0-9]+$/.test(to)) { showToast('Node names may only contain letters and digits.', true); return; }
    if (from === to) { showToast('Self-loops are not allowed.', true); return; }
    if (!Number.isFinite(weight) || weight < 0) { showToast('Weight must be a non-negative number.', true); return; }

    // Update existing edge if same pair exists
    const existing = edges.findIndex(e =>
      (e.from === from && e.to === to) || (!e.directed && e.from === to && e.to === from) || (!directed && e.from === to && e.to === from)
    );
    if (existing >= 0) {
      edges[existing] = { from, to, weight, directed };
      showToast(`Updated edge ${from} ${directed ? '→' : '—'} ${to} (${weight}).`);
    } else {
      edges.push({ from, to, weight, directed });
      showToast(`Added edge ${from} ${directed ? '→' : '—'} ${to} (${weight}).`);
    }

    edgeFrom.value = '';
    edgeTo.value = '';
    edgeWeight.value = '';
    edgeFrom.focus();
    refreshAll();
  });

  edgeList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.edge-remove');
    if (!btn) return;
    const i = Number(btn.dataset.index);
    const e = edges[i];
    edges.splice(i, 1);
    showToast(`Removed edge ${e.from} ${e.directed ? '→' : '—'} ${e.to}.`);
    refreshAll();
  });

  loadSampleBtn.addEventListener('click', () => {
    edges = SAMPLE_EDGES.map(e => ({ ...e }));
    refreshAll();
    sourceSelect.value = 'A';
    destSelect.value = 'F';
    showToast('Sample graph loaded.');
  });

  clearGraphBtn.addEventListener('click', () => {
    if (edges.length && !confirm('Remove all edges from the graph?')) return;
    edges = [];
    refreshAll();
  });

  /* ---------------------------------------------------------
   * Finder events
   * --------------------------------------------------------- */
  finderForm.addEventListener('submit', (ev) => { ev.preventDefault(); runSearch(); });
  resetBtn.addEventListener('click', resetResults);
  swapBtn.addEventListener('click', () => {
    const tmp = sourceSelect.value;
    sourceSelect.value = destSelect.value;
    destSelect.value = tmp;
    if (lastResult) runSearch();
  });

  stepPrevBtn.addEventListener('click', () => { stopPlay(); goToStep(stepIndex - 1); });
  stepNextBtn.addEventListener('click', () => { stopPlay(); goToStep(stepIndex + 1); });
  stepPlayBtn.addEventListener('click', () => { playTimer ? stopPlay() : startPlay(); });

  /* ---------------------------------------------------------
   * Utilities
   * --------------------------------------------------------- */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let toastEl = null;
  let toastTimer = null;
  function showToast(msg, isError = false) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------------------------------------------------------
   * Init
   * --------------------------------------------------------- */
  populateSelects();
  renderGraph();
  renderEdgeList();
  const initialNodes = getNodes();
  if (initialNodes.includes('A')) sourceSelect.value = 'A';
  if (initialNodes.includes('F')) destSelect.value = 'F';
  updateStepControls();
  if (initialNodes.length > 1) runSearch(); // show a result straight away
})();
