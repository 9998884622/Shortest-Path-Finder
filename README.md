# Shortest Path Finder — Dijkstra's Algorithm

A mini project built with **plain HTML + CSS + JavaScript** (no frameworks, no build step).
The user picks a **Source** and **Destination** node and the app displays:

```
Shortest Path:     A → C → E → F
Minimum Distance:  12
```

## Goals
- Demonstrate Dijkstra's single-source shortest path algorithm interactively.
- Keep the stack simple enough to open directly in a browser (`index.html`).

## Completed features
| Feature | Description |
|---|---|
| Source → Destination finder | Dropdowns for both nodes, swap button, Find / Reset. |
| Result banner | Shows the shortest path (node chips with arrows) and the minimum distance. Shows a clear error when no path exists. |
| SVG graph visualization | Nodes & weighted edges drawn from the edge list. Source (cyan), destination (pink), visited (indigo) and path (yellow) highlighting. Node labels show final distances. Click a node = set source, Shift+click = set destination. |
| Distance table | Final `dist[]`, `prev[]` and full path to every node from the source. |
| Step-by-step execution | Every init / visit / relax / skip / done step is recorded. Prev / Next / Auto-play controls replay the algorithm on the graph; click any step to jump to it. |
| Graph editor | Add or update edges (undirected or directed), remove edges, load sample graph, clear graph. New nodes are created automatically. Non-negative weights enforced. Graph persisted in `localStorage`. |
| Explanation section | Idea, steps and complexity of Dijkstra's algorithm. |
| Responsive layout | Works on desktop and phone widths. |

## Entry points
| Path | Purpose |
|---|---|
| `index.html` | The whole application (single page). |
| `css/style.css` | Styles (dark theme, responsive). |
| `js/dijkstra.js` | Pure algorithm: `dijkstra(graph, source, destination)` with a binary min-heap, returns path, distance, `dist`, `prev`, visited order and a step trace. Also `reconstructPath(prev, target)`. |
| `js/main.js` | UI: graph model, SVG rendering, result display, step replay, editor. |

No query parameters or server endpoints are used.

## Default sample graph (undirected)
```
A—B 4   A—C 2   B—C 5   B—D 10   C—E 3
D—F 11  E—D 4   E—F 7   E—G 6    G—F 5
```
Shortest path A → F = A → C → E → F with distance 2 + 3 + 7 = **12**.

## Data model & storage
- Graph is stored as an edge list: `{ from, to, weight, directed }[]`
- Persisted in the browser via `localStorage` (key `dijkstra-graph-edges-v1`). No backend / table API is used.

## Not yet implemented
- Drag-to-reposition nodes in the SVG.
- Import / export graph as JSON.
- Alternative algorithms for comparison (Bellman-Ford, A*).

## Recommended next steps
1. Add node dragging with persisted positions.
2. Add JSON import/export for sharing graphs.
3. Add a side-by-side Bellman-Ford mode to show negative-weight handling.

## Running / Deploying
Open `index.html` in any modern browser, or publish via the **Publish tab** to get a live URL.
