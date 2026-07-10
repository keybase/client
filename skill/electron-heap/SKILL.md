---
name: electron-heap
description: Use when analyzing a V8/Chrome/Electron .heapsnapshot file — memory leak hunting, detached DOM nodes, "why is this object retained", growing heap, retainer paths.
---

# Heap Snapshot Analysis

Parse DevTools `.heapsnapshot` files with Node scripts in `scripts/` — no DevTools UI needed. Snapshots are one big JSON: flat `nodes`/`edges` arrays. 100MB file ≈ 1.2M nodes, parses in ~30s.

## Workflow

1. **Overview** — object counts, sizes, detached DOM, big strings:
   ```bash
   node --max-old-space-size=8192 scripts/heap-stats.js <file.heapsnapshot>
   ```
2. **Pick suspects** from output (see interpretation table), then trace retention:
   ```bash
   node --max-old-space-size=8192 scripts/heap-retainers.js <file.heapsnapshot> '<name-substring>' \
     [--detached] [--type=object|native|closure] [--samples=N] [--props] \
     [--avoid=InspectorDOMAgent,DevToolsSession,DocumentState] [--js-only]
   ```
   - `--avoid=...` skips retainer nodes by name substring. Re-run with known-benign anchors avoided to see what *else* retains the object.
   - `--js-only` finds pure-JS retention paths (no native intermediates) — distinguishes app leaks from Blink-internal retention.
   - `--props` dumps property edges (e.g. Error `message`, ref `current`).

Both scripts require `scripts/snapshot-lib.js` (parser + reverse-edge index + BFS path-to-root).

## Interpreting results

| Signal | Meaning |
|---|---|
| Thousands of `Error` + huge `system / StackFrameInfo`, message `react-stack-top-frame`, retained via `_debugStack` | React 19 **dev-build** owner-stack instrumentation. Not a leak; absent in prod. |
| Retainer path through `blink::InspectorDOMAgent` / `DevToolsSession` | DevTools itself retains it (snapshot artifact — DevTools must be open to snapshot). Ignore; re-run with `--avoid`. |
| Path through `blink::DocumentState` → form control | Blink session-history form-state keeps removed input alive. Browser-internal, bounded. |
| Path through `blink::FrameSelection → SelectionEditor → Range` | Page selection/caret still points into detached tree. Released on next selection change; can force with `blur()`/`getSelection().removeAllRanges()` on unmount. |
| Detached DOM with **only native** retainer paths (`--js-only` finds nothing) | Not an app JS leak. One live leaf (via parent/child member pointers) pins the whole detached tree. |
| Detached DOM with a JS path (fiber `memoizedState`, module map, store, cache) | Real app leak — fix the JS retainer. |
| `FiberNode` via `__reactFiber$` expando on a retained DOM node | Normal: React never deletes expandos; fiber lives as long as its DOM node. Fix the DOM retention, not the fiber. |
| `PerformanceMeasure` accumulating under `blink::UserTiming` | `performance.measure()` entries never cleared (React dev tracks or app perf code). Bounded noise unless growing. |
| `system / ExternalStringData` large | Script sources + big JSON strings (e.g. emoji data). Usually expected. |

## Gotchas

- `edges[].to_node` is a byte offset into `nodes` — divide by node-field count (lib handles this).
- Shortest retainer path ≠ only path. Kill one anchor and the next takes over — enumerate direct retainers before concluding.
- Everything in a snapshot is live by definition; "leak" means *unexpected* retainer, not unreachable memory.
- Skip `weak` edges when tracing (lib does).
- Comparing two snapshots (before/after) beats staring at one: diff constructor counts from `heap-stats.js` runs.
