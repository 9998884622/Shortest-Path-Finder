/**
 * dijkstra.js
 * ------------------------------------------------------------
 * A self-contained implementation of Dijkstra's shortest path
 * algorithm using a binary min-heap priority queue.
 *
 * The function records every step so the UI can replay the
 * execution (visit / relax / skip / done).
 *
 * Graph format expected:
 *   {
 *     nodes: ['A', 'B', ...],
 *     adj:   { A: [{ to: 'B', weight: 4 }, ...], ... }
 *   }
 * ------------------------------------------------------------
 */

/** Simple binary min-heap keyed on `dist`. */
class MinHeap {
  constructor() { this.items = []; }

  get size() { return this.items.length; }

  push(item) {
    this.items.push(item);
    this._bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    const items = this.items;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].dist <= items[i].dist) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const items = this.items;
    const n = items.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && items[l].dist < items[smallest].dist) smallest = l;
      if (r < n && items[r].dist < items[smallest].dist) smallest = r;
      if (smallest === i) break;
      [items[smallest], items[i]] = [items[i], items[smallest]];
      i = smallest;
    }
  }
}

/**
 * Run Dijkstra's algorithm.
 *
 * @param {{nodes: string[], adj: Object<string, {to:string, weight:number}[]>}} graph
 * @param {string} source
 * @param {string} destination  (optional – if omitted, computes to all nodes)
 * @returns {{
 *   found: boolean,
 *   path: string[],
 *   distance: number,
 *   dist: Object<string, number>,
 *   prev: Object<string, string|null>,
 *   visitedOrder: string[],
 *   steps: Array<Object>
 * }}
 */
function dijkstra(graph, source, destination) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const visitedOrder = [];
  const steps = [];

  for (const node of graph.nodes) {
    dist[node] = Infinity;
    prev[node] = null;
  }

  if (!(source in dist)) {
    return { found: false, path: [], distance: Infinity, dist, prev, visitedOrder, steps,
             error: `Source node "${source}" does not exist.` };
  }
  if (destination && !(destination in dist)) {
    return { found: false, path: [], distance: Infinity, dist, prev, visitedOrder, steps,
             error: `Destination node "${destination}" does not exist.` };
  }

  dist[source] = 0;
  steps.push({
    type: 'init',
    text: `Initialise: dist[${source}] = 0, all other distances = ∞.`,
    dist: { ...dist }, prev: { ...prev }, visited: [], current: null
  });

  const heap = new MinHeap();
  heap.push({ node: source, dist: 0 });

  while (heap.size > 0) {
    const { node: u, dist: d } = heap.pop();

    // Stale heap entry (we already found a shorter route to u)
    if (visited.has(u) || d > dist[u]) continue;

    visited.add(u);
    visitedOrder.push(u);

    steps.push({
      type: 'visit',
      text: `Visit <code>${u}</code> — smallest tentative distance (${d}). Mark as visited.`,
      dist: { ...dist }, prev: { ...prev }, visited: [...visited], current: u
    });

    if (destination && u === destination) {
      steps.push({
        type: 'done',
        text: `Destination <code>${destination}</code> reached with distance ${dist[destination]}. Stop.`,
        dist: { ...dist }, prev: { ...prev }, visited: [...visited], current: u
      });
      break;
    }

    const neighbours = graph.adj[u] || [];
    for (const { to: v, weight } of neighbours) {
      if (visited.has(v)) continue;
      const candidate = dist[u] + weight;
      if (candidate < dist[v]) {
        const oldText = dist[v] === Infinity ? '∞' : dist[v];
        dist[v] = candidate;
        prev[v] = u;
        heap.push({ node: v, dist: candidate });
        steps.push({
          type: 'relax',
          text: `Relax edge <code>${u} → ${v}</code> (w=${weight}): ${dist[u]} + ${weight} = ${candidate} &lt; ${oldText} → update dist[${v}] = ${candidate}, prev[${v}] = ${u}.`,
          dist: { ...dist }, prev: { ...prev }, visited: [...visited], current: u, edge: [u, v]
        });
      } else {
        steps.push({
          type: 'skip',
          text: `Check edge <code>${u} → ${v}</code> (w=${weight}): ${dist[u]} + ${weight} = ${candidate} ≥ ${dist[v]} → no change.`,
          dist: { ...dist }, prev: { ...prev }, visited: [...visited], current: u, edge: [u, v]
        });
      }
    }
  }

  // Reconstruct path
  let path = [];
  let found = false;
  if (destination) {
    if (dist[destination] !== Infinity) {
      found = true;
      let cur = destination;
      while (cur !== null) {
        path.unshift(cur);
        cur = prev[cur];
      }
    } else {
      steps.push({
        type: 'done',
        text: `All reachable nodes visited. <code>${destination}</code> is unreachable from <code>${source}</code>.`,
        dist: { ...dist }, prev: { ...prev }, visited: [...visited], current: null
      });
    }
  } else {
    found = true;
    steps.push({
      type: 'done',
      text: 'All reachable nodes visited. Algorithm complete.',
      dist: { ...dist }, prev: { ...prev }, visited: [...visited], current: null
    });
  }

  return {
    found,
    path,
    distance: destination ? dist[destination] : 0,
    dist,
    prev,
    visitedOrder,
    steps
  };
}

/**
 * Helper: rebuild the path to any node from a prev map.
 */
function reconstructPath(prev, target) {
  const path = [];
  let cur = target;
  while (cur !== null && cur !== undefined) {
    path.unshift(cur);
    cur = prev[cur];
  }
  return path;
}
