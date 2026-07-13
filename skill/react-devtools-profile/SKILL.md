---
name: react-devtools-profile
description: Use when analyzing a React DevTools Profiler export (.json with "dataForRoots"/"commitData") — re-render storms, commit fan-out, "why did this component render", send/interaction render cost. NOT for Chrome Performance traces (those have "traceEvents" — use electron-profile).
---

# React DevTools Profiler Export Analysis

Parse React DevTools Profiler exports (version 4/5 JSON, top-level `dataForRoots`) with Python scripts in `scripts/` — no DevTools UI needed. Works for React Native and web/Electron profiles alike.

Distinguish from a Chrome Performance trace: profiler export has `{"version": N, "dataForRoots": [...]}`; a trace has `traceEvents` (use the electron-profile skill for those).

## Workflow

1. **Overview** — commit totals, top commits with updaters, component ranking by aggregate self duration, timeline buckets:
   ```bash
   python3 scripts/profile-overview.py <profile.json> [--top 25] [--bucket-ms 500]
   ```
2. **Per-commit detail** — full updater list, fiber counts, top fibers with ancestor paths, changeDescriptions if recorded:
   ```bash
   python3 scripts/profile-commits.py <profile.json> [--commit N] [--top 10] [--root 0]
   ```

Run from the skill directory (or use absolute script paths); both scripts need `scripts/rdtlib.py` alongside. The overview's top-commit list prints `#N` — that is the index to pass as `--commit N` (commits are chronological).

## Interpreting results

| Signal | Meaning |
|---|---|
| `updaters` on a commit | Fibers that *scheduled* the update — setState / store subscription (useSyncExternalStore) firing. The render entry point, not necessarily where time went. |
| Same broad updater set repeated across several commits | Shared-store fan-out: many components' selectors woke for one logical change. Find the common denominator subscription (here it was conversation meta) and fix identity churn there. |
| Unnamed fibers `#1234` | Fiber absent from the end-of-profiling snapshot = unmounted before profiling stopped (virtualized-list churn, pending rows replaced on server ack). Cross-reference the same id in `updaters`, which carries displayName. |
| `prio=Immediate` | Sync flush — store setState outside a React event (zustand, RPC callbacks). Each one blocks the frame; many small Immediate commits = stacked sync flushes worth batching. |
| High `x<count>` in component ranking | Component rendered in many commits — subscription too broad or unstable selector output (fresh object/closure identity per run defeats useShallow). |
| Large single-fiber self time in a big-fiber-count commit | Usually a subtree mount (new list row). Mount cost is mostly inherent; look at whether it mounts twice (key churn). |
| `changeDescriptions: null` | Profile recorded without "Record why each component rendered". Re-record with it enabled to get props/state/hooks/context attribution per fiber. |

**Scope caveat:** durations are React render/effect time only. Store selector runs, native layout, bridge, and app JS outside render are invisible here — a small total does NOT mean no perf problem; it means the problem isn't React commits.

**Fan-out diagnosis recipe:** overview → spot repeated updater sets → per-commit to list exact updater components → read their store selectors → find the shared subscription whose selected values change identity without changing content → preserve identity at the producer (deep-equal reuse on store write), not with deeper memo at consumers.

## Gotchas

- Timestamps are ms relative to profiling start; scripts print t= relative to first commit.
- `fiberActualDurations` = inclusive per fiber; `fiberSelfDurations` = self. Ranking uses self.
- Multiple roots possible (`dataForRoots`); overview iterates all, per-commit takes `--root`.
- Updater lists carry displayNames even for fibers missing from the snapshot — best way to name unmounted fibers.
