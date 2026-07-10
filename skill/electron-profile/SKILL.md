---
name: electron-profile
description: Use when analyzing a Chrome/Electron DevTools Performance trace export (.json) — slow renders, long tasks, jank, CPU sample attribution, "where is the time actually going".
---

# DevTools Performance Trace Analysis

Parse DevTools Performance panel exports with Python scripts in `scripts/` — no DevTools UI needed. A trace is one big JSON of `traceEvents`; a 400MB export loads in ~30s. The embedded sampling profile lives in `Profile`/`ProfileChunk` events.

## Workflow

1. **Overview** — processes, busiest renderer main thread, long tasks (with time offsets), X-event category totals:
   ```bash
   python3 scripts/trace-overview.py <trace.json> [--long-ms 50] [--top 30]
   ```
2. **Sample attribution** — self time, inclusive time, and nearest-app-frame attribution from the CPU sampling profile. Use `--window` (seconds, relative to first sample) to zoom into a long task found in step 1:
   ```bash
   python3 scripts/trace-samples.py <trace.json> [--window FROM_S TO_S] [--top 30]
   ```

Both auto-pick the busiest `CrRendererMain`; override with `--pid`/`--tid`. Both need `scripts/tracelib.py` alongside.

## Interpreting results (dev builds especially)

Dev-build traces are ~85-90% React dev instrumentation, NOT app code. Absolute numbers are meaningless; prod is ~10x faster. For real numbers profile the prod bundle (see prod-bundles skill), or at minimum disable the React DevTools extension while recording.

| Signal | Meaning |
|---|---|
| Huge `run (:-1)` self time, `createTask`, `measure` | React 19 dev component-performance tracks: `console.createTask().run()` inside `runWithFiberInDEV`/`logComponentRender`. Not app code. |
| `v8::Debugger::AsyncTaskRun` dominating X-event totals | Debugger async-stack tracking (DevTools open). Dev artifact. |
| Effects firing twice back-to-back | StrictMode double-invoke. Dev only. |
| 90%+ samples with no app frame on stack | Expected in dev — instrumentation + framework internals. Judge the app-frame report's *relative* ranking, not totals. |
| `performSyncWorkOnRoot` ≫ scheduler time in inclusive report | Most renders are sync (flushSync / discrete events), not concurrent. Structural signal — valid even in dev. |
| `pptr:internal` frames | CDP automation harness driving the app, not app code (excluded from app-frame report). |
| Layout / Paint / GC / EventDispatch totals in overview | Real browser work — valid signal even in dev. Compare against script time. |

**Judge structure, not magnitude** in dev traces: sync-vs-concurrent split, Layout/Paint/GC share, which app components rank highest, burst patterns around long tasks.

## Gotchas

- X-event name totals are nested-inclusive (parent contains child) — relative shape only, don't sum.
- Sample span < trace span is normal: sampling only covers the profiled window.
- App-frame attribution skips frames whose URL contains `node_modules` — with Vite dev this automatically excludes React (`node_modules/.vite/deps/...`).
- `--window` is relative to the first *sample*, not trace start; long-task `t=` offsets from the overview are relative to trace start. They usually differ by <1s but eyeball the sample span line.
- Trace timestamps are microseconds.
