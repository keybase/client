# Engine Improvements: Shared RPC Cache + Reconnect Refetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `useRPCLoad` TanStack-Query-style powers that fit this codebase: cross-component shared cache with in-flight dedup + stale-while-revalidate (by generalizing the existing `useCachedResource` cache), and automatic reload when the daemon reconnects.

**Architecture:** Three sequential tasks. (1) Move `teams/use-cached-resource.tsx` → `util/use-cached-resource.tsx` (mechanical, it is no longer teams-specific). (2) Add an optional `cache` option to `useRPCLoad` that consults a `CachedResourceCache` before firing the RPC: fresh cache → serve without RPC; in-flight request → piggyback on it; otherwise fire and populate the cache. (3) Add a `useReloadOnReconnect(cb)` helper driven by `useDaemonState.handshakeState` transitions, wired into both `useRPCLoad` and `useCachedResource` — this fixes the real bug where `engine.reset()` orphans in-flight RPC promises (they never settle) leaving hooks stuck `loading` forever.

**Tech Stack:** React 19 hooks (`React.useEffectEvent`), zustand store (`useDaemonState`), jest + @testing-library/react (`renderHook`), TypeScript (tsgo).

## Global Constraints

- Working dir for all commands: `/Users/chrisnojima/go/src/github.com/keybase/client2/shared` (`cd` there first for every Bash command).
- Package manager: `yarn` only, never `npm`.
- Validation after TS changes: `yarn lint` then `yarn tsc` (both from `shared/`).
- Unit tests: `yarn test:unit <file>` (jest; colocated `*.test.tsx`).
- Commit messages: conventional style like existing history (`feat(util): …`), **no `Co-Authored-By` line — ever**.
- No DOM elements in plain `.tsx` files (not relevant here — hooks only, no JSX).
- Comments only where context isn't obvious from code; no refactoring/change-history notes.
- In tests use placeholder data only, never real usernames.
- Remove unused code (imports, vars, params) in any file you touch.
- `React.useEffectEvent` returns a NEW wrapper identity every render — never put its return in a dep array, never hand it out directly to consumers (see existing comment in `util/use-rpc-load.tsx`).

---

### Task 1: Move use-cached-resource to util/

The cache primitive lives in `teams/` but is generic. Move it so `util/use-rpc-load.tsx` can import it without a `util → teams` dependency.

**Files:**
- Move (git mv): `teams/use-cached-resource.tsx` → `util/use-cached-resource.tsx`
- Modify: `chat/conversation/team-hooks.tsx` (import path)
- Modify: `teams/common/channel-hooks.tsx` (import path)
- Modify: `teams/common/activity.tsx` (import path)
- Modify: `teams/common/use-loaded-team-channels.tsx` (import path)
- Modify: `teams/team/use-loaded-team.tsx` (import path)
- Modify: `teams/use-teams-list.tsx` (import path)

**Interfaces:**
- Consumes: nothing new.
- Produces: `util/use-cached-resource.tsx` exporting (unchanged signatures): `type CachedResourceCache<T, K>`, `createCachedResourceCache<T, K>(initialData: T, key: K): CachedResourceCache<T, K>`, `getCachedResourceCache<T, K>(map, initialData, key)`, `useCachedResource<T, K>(props)`. Tasks 2 and 3 import from `./use-cached-resource` (relative, same dir as use-rpc-load).

- [ ] **Step 1: Move the file**

```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client2/shared
git mv teams/use-cached-resource.tsx util/use-cached-resource.tsx
```

- [ ] **Step 2: Update the six importers**

The file content itself needs no changes (its own imports are `@/constants`, `react`, `immer` — all location-independent).

In `chat/conversation/team-hooks.tsx` change:
```ts
} from '@/teams/use-cached-resource'
```
to:
```ts
} from '@/util/use-cached-resource'
```

In `teams/common/channel-hooks.tsx` and `teams/common/activity.tsx` change:
```ts
import {createCachedResourceCache, type CachedResourceCache, useCachedResource} from '../use-cached-resource'
```
to:
```ts
import {createCachedResourceCache, type CachedResourceCache, useCachedResource} from '@/util/use-cached-resource'
```

In `teams/common/use-loaded-team-channels.tsx` and `teams/team/use-loaded-team.tsx` change:
```ts
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../use-cached-resource'
```
to:
```ts
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '@/util/use-cached-resource'
```

In `teams/use-teams-list.tsx` change the multi-line import ending in:
```ts
} from './use-cached-resource'
```
to:
```ts
} from '@/util/use-cached-resource'
```

(If eslint import-order complains, let `yarn lint --fix`-style autofixes or manual reordering satisfy it.)

- [ ] **Step 3: Validate**

Run: `yarn lint` — expect clean (or only auto-fixable import-order, fix them).
Run: `yarn tsc` — expect `Done` with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(util): move use-cached-resource from teams/ to util/"
```

---

### Task 2: Optional shared cache in useRPCLoad

Add a `cache` option: `{store: CachedResourceCache<DATA, string | undefined>, staleMs: number}`. Behavior:
- Mount state seeds from cache when the store's key matches and it has loaded data (no spinner flash).
- Auto loads (mount/focus/key-change) become `load(false)`: fresh cache (within `staleMs`) → adopt cached data, **no RPC**; an in-flight request exists → piggyback on it; else fire RPC.
- `reload()` becomes `load(true)`: always fires the RPC (skips freshness check, still populates the cache).
- RPC success writes to the cache via `setDataLoaded` guarded by the generation captured at fire time (so `invalidate()`/`reset()` during flight wins).
- The in-flight promise resolves to the **mapped** DATA — hooks sharing a store must use equivalent `map` fns; callers keep using the module-map pattern (`getCachedResourceCache`) with one store per key and pass the store matching the current `key` option.
- `setData` stays local-only (optimistic overwrite for this component); cross-component invalidation goes through the store's own `invalidate`/`reset`.

**Files:**
- Modify: `util/use-rpc-load.tsx` (full new content below)
- Create: `util/use-rpc-load.test.tsx`

**Interfaces:**
- Consumes: `type CachedResourceCache` and `createCachedResourceCache` from `./use-cached-resource` (Task 1).
- Produces: `useRPCLoad(call, args, opts)` — same returns as today (`data`, `error`, `loaded`, `loading`, `loadCount`, `reload`, `setData`) plus new opt `cache?: {staleMs: number; store: CachedResourceCache<DATA, string | undefined>}`. Task 3 modifies this same file: the internal `load` effect-event takes `(force: boolean)`.

- [ ] **Step 1: Write the failing tests**

Create `util/use-rpc-load.test.tsx`:

```tsx
/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {createCachedResourceCache} from './use-cached-resource'
import {useRPCLoad} from './use-rpc-load'

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test('without cache: loads on mount and maps the result', async () => {
  const call = jest.fn(async (n: number) => n * 2)
  const {result} = renderHook(() => useRPCLoad(call, [21], {map: r => `got:${r}`}))
  expect(result.current.loading).toBe(true)
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  expect(result.current.data).toBe('got:42')
  expect(result.current.loaded).toBe(true)
})

test('cache: concurrent hooks share one in-flight rpc', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  let resolveCall: ((n: number) => void) | undefined
  const call = jest.fn(
    async () =>
      new Promise<number>(resolve => {
        resolveCall = resolve
      })
  )
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const a = renderHook(() => useRPCLoad(call, [], opts))
  const b = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  await act(async () => {
    resolveCall?.(7)
    await Promise.resolve()
  })
  expect(a.result.current.data).toBe('got:7')
  expect(b.result.current.data).toBe('got:7')
})

test('cache: fresh data serves without an rpc, stale refires', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  const call = jest.fn(async () => 1)
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const first = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  first.unmount()

  // fresh: second mount seeds from cache, no rpc
  const second = renderHook(() => useRPCLoad(call, [], opts))
  expect(second.result.current.data).toBe('got:1')
  expect(second.result.current.loaded).toBe(true)
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  second.unmount()

  // stale: third mount refires
  act(() => {
    jest.advanceTimersByTime(11_000)
  })
  renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
})

test('cache: reload() forces the rpc even when fresh', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  const call = jest.fn(async () => 1)
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const {result} = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  act(() => {
    result.current.reload()
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run tests to verify the cache ones fail**

Run: `yarn test:unit util/use-rpc-load.test.tsx`
Expected: first test PASSES (existing behavior), the three cache tests FAIL (unknown `cache` option / type error — if tsc-in-jest rejects the file outright that also counts as the failing state).

- [ ] **Step 3: Implement the cache option**

Replace the `Options` type and the body of `useRPCLoad` in `util/use-rpc-load.tsx` with:

```tsx
import * as React from 'react'
import * as C from '@/constants'
import type {CachedResourceCache} from './use-cached-resource'
import type {RPCError} from './errors'

type Options<RESULT, DATA> = {
  /**
   * share results across components: serve cached data when fresh (staleMs),
   * piggyback on an in-flight load, populate on success. The store's key must
   * match the `key` option (use one store per key via getCachedResourceCache).
   * The in-flight promise resolves to mapped DATA, so hooks sharing a store
   * must use equivalent `map` fns.
   */
  cache?: {staleMs: number; store: CachedResourceCache<DATA, string | undefined>}
  /** skips the mount/focus/key auto-load when false, checked when the trigger fires. reload() ignores this */
  enabled?: boolean
  /**
   * correlate results with the param they were requested for. data/error only
   * surface while the key still matches, and the load auto-refires when the
   * key changes (unless when is 'manual'). Don't combine with when: 'focus'
   */
  key?: string
  /** turn the raw rpc result into the data you want to keep */
  map: (result: RESULT) => DATA
  onError?: (error: RPCError) => void
  /** called after a successful load, with the mapped data */
  onResult?: (data: DATA) => void
  /** when to load: on mount (default), on every screen focus, or only via reload(). Fixed at mount */
  when?: 'mount' | 'focus' | 'manual'
}

/**
 * Load data via an rpc and keep it in local state. Wraps the common
 * useRPC + useState + load-on-mount/focus dance. Like useRPC this skips the
 * state layer entirely; pass a waitingKey inside `args` if you want spinners
 * driven by the waiting store.
 * @returns data: mapped result of the last successful load (for the current key, if keyed)
 * @returns error: error from the last load, cleared on the next success
 * @returns loaded: true once a load attempt finished (success or error; for the current key, if keyed)
 * @returns loading: enabled and no finished attempt yet, spinner-friendly
 * @returns loadCount: number of successful loads, useful as a refresh token
 * @returns reload: kick off a load manually, always firing the rpc even if the cache is fresh
 * @returns setData: overwrite data locally, for optimistic updates; the next load result wins.
 *   Local-only: shared caches are invalidated via their own invalidate/reset
 */
export function useRPCLoad<F extends (...rest: any[]) => Promise<any>, DATA>(
  call: F,
  args: Parameters<F>,
  opts: Options<Awaited<ReturnType<F>>, DATA>
) {
  const {cache, enabled = true, key, map, onError, onResult, when = 'mount'} = opts
  const [state, setState] = React.useState<{
    data?: DATA
    dataKey?: string
    error?: RPCError
    errorKey?: string
    loadCount: number
    loaded: boolean
  }>(() => {
    const store = cache?.store
    if (store && Object.is(store.getKey(), key) && store.getLoadedAt()) {
      return {data: store.getData(), dataKey: key, loadCount: 0, loaded: true}
    }
    return {loadCount: 0, loaded: false}
  })

  // ignore out-of-order responses when reload fires while a load is in flight
  const requestID = React.useRef(0)
  const load = React.useEffectEvent((force: boolean) => {
    const id = ++requestID.current
    const keyAtCall = key
    const adopt = (data: DATA) => {
      setState(s => ({
        data,
        dataKey: keyAtCall,
        error: undefined,
        errorKey: undefined,
        loadCount: s.loadCount + 1,
        loaded: true,
      }))
      onResult?.(data)
    }
    const fail = (error: RPCError) => {
      setState(s => ({...s, error, errorKey: keyAtCall, loaded: true}))
      onError?.(error)
    }

    const store = cache?.store
    if (store && Object.is(store.getKey(), keyAtCall)) {
      const loadedAt = store.getLoadedAt()
      if (!force && loadedAt && Date.now() - loadedAt < (cache?.staleMs ?? 0)) {
        adopt(store.getData())
        return
      }
      const inFlight = store.getInFlight()
      if (inFlight) {
        inFlight
          .then(data => {
            if (requestID.current === id) adopt(data)
          })
          .catch((error: RPCError) => {
            if (requestID.current === id) fail(error)
          })
        return
      }
    }
    if (store && !Object.is(store.getKey(), keyAtCall)) {
      store.invalidate(keyAtCall)
    }

    const generation = store?.getGeneration()
    const request: Promise<DATA> = call(...args).then((result: Awaited<ReturnType<F>>) => {
      const data = map(result)
      if (store && generation !== undefined) {
        store.setDataLoaded(data, generation)
      }
      return data
    })
    if (store) {
      store.setInFlight(request)
    }
    const clearInFlight = () => store?.clearInFlight(request)
    request
      .then(data => {
        clearInFlight()
        if (requestID.current === id) adopt(data)
      })
      .catch((error: RPCError) => {
        clearInFlight()
        if (requestID.current === id) fail(error)
      })
  })

  const setData = React.useEffectEvent(
    (next: DATA | undefined | ((prev: DATA | undefined) => DATA | undefined)) => {
      const keyNow = key
      setState(s => {
        const prev = key !== undefined && s.dataKey !== keyNow ? undefined : s.data
        return {
          ...s,
          data: typeof next === 'function' ? (next as (p: DATA | undefined) => DATA | undefined)(prev) : next,
          dataKey: keyNow,
        }
      })
    }
  )

  const autoLoad = React.useEffectEvent(() => {
    if (enabled) load(false)
  })
  // `when` and key-presence are locked at mount so the subscriptions stay stable
  const [onMountOrFocus] = React.useState(() => ({
    focus: () => {
      if (when === 'focus') autoLoad()
      return undefined
    },
    mount: () => {
      // keyed loads fire from the key effect below instead
      if (when === 'mount' && key === undefined) autoLoad()
    },
  }))
  C.useOnMountOnce(onMountOrFocus.mount)
  C.Router2.useSafeFocusEffect(onMountOrFocus.focus)
  const keyed = key !== undefined
  React.useEffect(() => {
    if (keyed && when !== 'manual') autoLoad()
  }, [keyed, when, key])

  const data = keyed ? (state.dataKey === key ? state.data : undefined) : state.data
  const error = keyed ? (state.errorKey === key ? state.error : undefined) : state.error
  const loaded = keyed
    ? state.dataKey === key || (state.error !== undefined && state.errorKey === key)
    : state.loaded

  // useEffectEvent returns a NEW wrapper identity every render (only its inner ref is
  // stable), so handing load/setData out directly poisons consumers' dep arrays and can
  // loop effects. Freeze the first wrapper; it stays valid because all wrappers share
  // the same ref.
  const [stableApi] = React.useState(() => ({
    reload: () => load(true),
    setData: (next: Parameters<typeof setData>[0]) => setData(next),
  }))

  return {
    data,
    error,
    loadCount: state.loadCount,
    loaded,
    loading: enabled && !loaded,
    reload: stableApi.reload,
    setData: stableApi.setData,
  }
}
```

Notes for the implementer:
- This is the complete file content except the import lines shown at the top replace the old imports.
- The cache-seeded `useState` initializer runs once at mount — that's intended; later cache changes flow through loads.
- `clearInFlight` runs in the same handlers that adopt/fail so no floating `.finally` chain is created (a bare `request.finally(...)` would produce an unhandled rejection).

- [ ] **Step 4: Run the tests, verify all pass**

Run: `yarn test:unit util/use-rpc-load.test.tsx`
Expected: all 4 tests PASS.

- [ ] **Step 5: Validate types + lint**

Run: `yarn lint` then `yarn tsc` — both clean.

- [ ] **Step 6: Commit**

```bash
git add util/use-rpc-load.tsx util/use-rpc-load.test.tsx
git commit -m "feat(util): optional shared cache for useRPCLoad (dedup + stale-while-revalidate)"
```

---

### Task 3: Reload on daemon reconnect

`engine.reset()` (user switch, service restart) orphans in-flight RPC promises — they never settle, so `useRPCLoad`/`useCachedResource` consumers can sit on stale data or a forever-spinner. After every reconnect the daemon handshake re-runs (`onEngineConnected` → `startHandshake()` → `handshakeState: 'loading'` → `'done'` in `stores/daemon.tsx`). A transition **into** `'done'` from any other observed state is therefore the "connection (re)established" signal. New helper `useReloadOnReconnect(cb)` encapsulates that; wire it into both hooks.

**Files:**
- Create: `util/use-reload-on-reconnect.tsx`
- Create: `util/use-reload-on-reconnect.test.tsx`
- Modify: `util/use-rpc-load.tsx` (add one hook call)
- Modify: `util/use-cached-resource.tsx` (add one hook call)

**Interfaces:**
- Consumes: `useDaemonState` from `@/stores/daemon` (state field `handshakeState: 'loading' | 'done' | 'failed'`); `load(force: boolean)` effect-event inside `useRPCLoad` (Task 2 shape); `loadResource(force: boolean)` + `latestRef` inside `useCachedResource`.
- Produces: `useReloadOnReconnect(cb: () => void): void` exported from `util/use-reload-on-reconnect.tsx`.

- [ ] **Step 1: Write the failing helper tests**

Create `util/use-reload-on-reconnect.test.tsx`:

```tsx
/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {useReloadOnReconnect} from './use-reload-on-reconnect'

const setHandshake = (handshakeState: 'loading' | 'done' | 'failed') => {
  act(() => {
    useDaemonState.setState({handshakeState})
  })
}

afterEach(() => {
  cleanup()
  useDaemonState.setState({handshakeState: 'loading'})
  jest.restoreAllMocks()
})

test('does not fire when mounted with handshake already done', () => {
  setHandshake('done')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  expect(cb).not.toHaveBeenCalled()
})

test('fires once per reconnect (done -> loading -> done)', () => {
  setHandshake('done')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('loading')
  expect(cb).not.toHaveBeenCalled()
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(1)
  setHandshake('loading')
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(2)
})

test('fires when mounted during a handshake that then completes', () => {
  setHandshake('loading')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(1)
})

test('fires on recovery from a failed handshake', () => {
  setHandshake('failed')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(1)
})
```

(If importing `@/stores/daemon` explodes in jest on transitive imports, mirror whatever module mocks `stores/notifications.test.tsx` uses — that file is the precedent for store-importing tests.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit util/use-reload-on-reconnect.test.tsx`
Expected: FAIL — module `./use-reload-on-reconnect` not found.

- [ ] **Step 3: Implement the helper**

Create `util/use-reload-on-reconnect.tsx`:

```tsx
import * as React from 'react'
import {useDaemonState} from '@/stores/daemon'

/**
 * Fires cb when the daemon handshake completes after this hook has observed a
 * different handshake state — i.e. on reconnect (engine reset re-runs the
 * handshake) or recovery from a failed handshake. Mounting while already
 * 'done' never fires. Engine resets orphan in-flight rpc promises (they never
 * settle), so data hooks use this to refire loads and unstick themselves.
 */
export const useReloadOnReconnect = (cb: () => void) => {
  const handshakeState = useDaemonState(s => s.handshakeState)
  const onReconnect = React.useEffectEvent(cb)
  const prevRef = React.useRef<typeof handshakeState | undefined>(undefined)
  React.useEffect(() => {
    const prev = prevRef.current
    prevRef.current = handshakeState
    if (handshakeState === 'done' && prev !== undefined && prev !== 'done') {
      onReconnect()
    }
  }, [handshakeState])
}
```

- [ ] **Step 4: Run helper tests, verify they pass**

Run: `yarn test:unit util/use-reload-on-reconnect.test.tsx`
Expected: all 4 PASS.

- [ ] **Step 5: Wire into useRPCLoad + add integration test**

In `util/use-rpc-load.tsx` add the import:

```ts
import {useReloadOnReconnect} from './use-reload-on-reconnect'
```

and directly after the `React.useEffect` block for keyed loads (before the `const data = keyed ? …` line) add:

```tsx
// reconnects orphan any in-flight load; force so a fresh-looking cache from
// before the restart doesn't mask post-restart changes
useReloadOnReconnect(() => {
  if (enabled && when !== 'manual') load(true)
})
```

Append to `util/use-rpc-load.test.tsx`:

```tsx
import {useDaemonState} from '@/stores/daemon'

test('reloads when the daemon reconnects', async () => {
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  const call = jest.fn(async () => 1)
  renderHook(() => useRPCLoad(call, [], {map: (r: number) => r}))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  act(() => {
    useDaemonState.setState({handshakeState: 'loading'})
  })
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
  act(() => {
    useDaemonState.setState({handshakeState: 'loading'})
  })
})
```

(Put the import at the top with the others. The trailing reset keeps the store's default state for other tests; if the existing tests in this file start failing because the store now says `'done'`, reset `handshakeState` to `'loading'` in the shared `afterEach` instead.)

- [ ] **Step 6: Wire into useCachedResource**

In `util/use-cached-resource.tsx` add the import:

```ts
import {useReloadOnReconnect} from './use-reload-on-reconnect'
```

and inside `useCachedResource`, after the `loadIfStale` definition, add:

```tsx
// reconnects orphan any in-flight load; force so cached data from before the
// restart doesn't mask post-restart changes. Disabled hooks must not touch the
// shared cache (loadResource resets it when disabled)
useReloadOnReconnect(() => {
  if (latestRef.current.enabled) {
    void loadResource(true)
  }
})
```

Placement note: `latestRef` and `loadResource` are both defined above `loadIfStale`, so they're in scope; do NOT call `reload()`/`loadResource` unconditionally — when `enabled` is false `loadResource` resets the shared cache (see the disabled-shadow-instance hazard in the existing code).

- [ ] **Step 7: Run the full unit suites touched**

Run: `yarn test:unit util/use-rpc-load.test.tsx util/use-reload-on-reconnect.test.tsx`
Expected: all PASS.

- [ ] **Step 8: Validate types + lint over everything**

Run: `yarn lint` then `yarn tsc` — both clean.

- [ ] **Step 9: Commit**

```bash
git add util/use-reload-on-reconnect.tsx util/use-reload-on-reconnect.test.tsx util/use-rpc-load.tsx util/use-rpc-load.test.tsx util/use-cached-resource.tsx
git commit -m "feat(util): reload rpc data hooks when the daemon reconnects"
```
