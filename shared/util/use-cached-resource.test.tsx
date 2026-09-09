/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {nextReloadEpoch} from './reload-epoch'
import {createCachedResourceNamespace, useCachedResource} from './use-cached-resource'
import {flush} from '@/test/flush'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'

afterEach(() => {
  cleanup()
  useDaemonState.setState({handshakeGeneration: 0, handshakeState: 'loading'})
})

type Data = {v: number}

// a fresh namespace per test: they are module-scope in real callers, and reusing
// one here would leak a loaded entry into the next test
let namespaceCount = 0
const makeNamespace = <T,>(initialData: T) =>
  createCachedResourceNamespace<T, string>(`test-${namespaceCount++}`, () => initialData)

// A caller that rebuilds initialData every render (seeding it from another
// store) must not put useCachedResource into a render loop.
test('unstable initialData does not loop', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  let renders = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const Comp = () => {
    // counts real renders: compiling this away is exactly what the test measures
    'use no memo'
    renders++
    const {data} = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    return <div>{data.v}</div>
  }
  render(<Comp />)
  await flush()
  expect(calls).toBe(1)
  expect(renders).toBeLessThan(10)
})

// A load that rejects leaves loadedAt at 0, i.e. permanently stale. Without a
// backoff every re-render re-issued the request the instant the previous one
// settled, which hammered both the service and the server.
test('a failed load backs off instead of retrying on every render', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  let loadIfStale: (() => Promise<void>) | undefined
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    throw new Error('nope')
  })
  const Comp = () => {
    // drives loadIfStale from the test; the mount effect only ever fires once,
    // so without this the assertion below holds even with no backoff at all
    'use no memo'
    const resource = useCachedResource({
      namespace,
      cacheKey: 'k',
      initialData: {v: 0},
      load,
      onError: () => {},
      staleMs: 5000,
    })
    loadIfStale = resource.loadIfStale
    return <div>{resource.data.v}</div>
  }
  render(<Comp />)
  await flush()
  expect(calls).toBe(1)

  // inside the backoff window: further attempts must not reach `load`
  await act(async () => {
    await loadIfStale?.()
    await loadIfStale?.()
  })
  await flush()
  expect(calls).toBe(1)

  // past it: the next attempt goes through
  const realNow = Date.now
  Date.now = () => realNow() + 5_001
  try {
    await act(async () => {
      await loadIfStale?.()
    })
    await flush()
  } finally {
    Date.now = realNow
  }
  expect(calls).toBe(2)
})

test('reload bypasses the failure backoff', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  let reload: (() => Promise<void>) | undefined
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    throw new Error('nope')
  })
  const Comp = () => {
    // hoists reload out to the test body; the compiler rejects the assignment
    'use no memo'
    const resource = useCachedResource({
      namespace,
      cacheKey: 'k',
      initialData: {v: 0},
      load,
      onError: () => {},
      staleMs: 5000,
    })
    reload = resource.reload
    return <div>{resource.data.v}</div>
  }
  render(<Comp />)
  await flush()
  expect(calls).toBe(1)
  await act(async () => {
    await reload?.()
  })
  expect(calls).toBe(2)
})

test('a successful load is served from cache while fresh', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const Comp = ({staleMs}: {staleMs: number}) => {
    const {data, loaded} = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs})
    return <div>{loaded ? data.v : 'x'}</div>
  }
  const first = render(<Comp staleMs={5000} />)
  await flush()
  expect(calls).toBe(1)

  // a re-render of the same fiber proves nothing: the effect deps are stable so
  // it never re-runs. The window only matters to a NEW consumer of this cache.
  first.unmount()
  const second = render(<Comp staleMs={5000} />)
  await flush()
  expect(calls).toBe(1)
  expect(namespace.peek('k')).toEqual({v: 1})

  // and a consumer that considers it stale does reload it
  second.unmount()
  render(<Comp staleMs={-1} />)
  await flush()
  expect(calls).toBe(2)
})

// A reload() fired because something changed must not settle to data that was
// already on the wire before the change: joining it would serve pre-change data
// AND stamp loadedAt on it, pinning the stale value for the whole window.
test('a forced reload supersedes a request that predates it', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  let reload: (() => Promise<void>) | undefined
  const Comp = () => {
    'use no memo'
    const resource = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    reload = resource.reload
    return <div>{resource.loaded ? `v${resource.data.v}` : 'pending'}</div>
  }
  const view = render(<Comp />)
  await flush()
  expect(calls).toBe(1)

  // the mutation happens here, while request 1 is still outstanding
  let forced: Promise<void> | undefined
  act(() => {
    forced = reload?.()
  })
  await flush()
  expect(calls).toBe(2)

  // request 1 lands with pre-change data and must not win
  act(() => {
    releases[0]?.({v: 1})
  })
  await flush()
  await act(async () => {
    releases[1]?.({v: 2})
    await forced
  })
  await flush()
  expect(view.getAllByText('v2')).toHaveLength(1)
  expect(namespace.peek('k')).toEqual({v: 2})
})

// The mutation and the reload it triggers routinely fall inside one millisecond,
// so ordering the two by Date.now() compares them equal and the forced load
// joins the very request it exists to supersede.
test('a forced reload supersedes a same-millisecond request', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  let reload: (() => Promise<void>) | undefined
  const Comp = () => {
    'use no memo'
    const resource = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    reload = resource.reload
    return <div>{resource.loaded ? `v${resource.data.v}` : 'pending'}</div>
  }
  const realNow = Date.now
  const frozen = realNow()
  Date.now = () => frozen
  try {
    render(<Comp />)
    await flush()
    expect(calls).toBe(1)
    act(() => {
      void reload?.()
    })
    await flush()
    expect(calls).toBe(2)
  } finally {
    Date.now = realNow
  }
})

// Two consumers mounting together must share one request, not race two. This is
// the property the module-level caches depend on: without it, sharing a cache
// across screens still issues an RPC per screen.
test('concurrent consumers of one cache share a single load', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  let release: ((v: Data) => void) | undefined
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      release = resolve
    })
  })
  const Comp = () => {
    const {data, loaded} = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    return <div>{loaded ? `v${data.v}` : 'pending'}</div>
  }
  const view = render(
    <>
      <Comp />
      <Comp />
    </>
  )
  await flush()
  expect(calls).toBe(1)

  act(() => {
    release?.({v: 7})
  })
  await flush()
  expect(calls).toBe(1)
  // both consumers got the single load's result
  expect(view.getAllByText('v7')).toHaveLength(2)
})

// The whole point of the epoch. N consumers of one cache each run their own
// effect in response to a single event, and React commits those one at a time,
// so ordering by "was this on the wire when I asked?" makes every consumer after
// the first supersede its predecessor - N rpcs for one event. Measured as 4
// identical getAnnotatedTeam inside 106ms after one reconnect.
test('consumers reloading for one event share a single rpc', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  const reloads: Array<(epoch?: number) => Promise<void>> = []
  const Comp = () => {
    'use no memo'
    const resource = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    reloads.push(resource.reload)
    return <div>{resource.loaded ? `v${resource.data.v}` : 'pending'}</div>
  }
  const view = render(
    <>
      <Comp />
      <Comp />
      <Comp />
    </>
  )
  await flush()
  expect(calls).toBe(1)
  act(() => {
    releases[0]?.({v: 1})
  })
  await flush()

  // one event, one epoch, handed to every consumer
  const epoch = nextReloadEpoch()
  const current = reloads.slice(-3)
  act(() => {
    current.forEach(reload => void reload(epoch))
  })
  await flush()
  expect(calls).toBe(2)

  act(() => {
    releases[1]?.({v: 2})
  })
  await flush()
  expect(view.getAllByText('v2')).toHaveLength(3)
})

// Consumers do not necessarily overlap. Measured live: two consumers of the
// teams list reloaded 75ms apart for one reconnect, and the first request had
// already settled, so the in-flight check had nothing to collapse onto.
test('a consumer reloading for an event already in the cache does not refetch', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  const reloads: Array<(epoch?: number) => Promise<void>> = []
  const Comp = () => {
    'use no memo'
    const resource = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    reloads.push(resource.reload)
    return <div>{resource.loaded ? `v${resource.data.v}` : 'pending'}</div>
  }
  const view = render(
    <>
      <Comp />
      <Comp />
    </>
  )
  await flush()
  expect(calls).toBe(1)
  act(() => {
    releases[0]?.({v: 1})
  })
  await flush()

  const epoch = nextReloadEpoch()
  const current = reloads.slice(-2)
  // first consumer reloads and its request settles before the second one runs
  act(() => {
    void current[0]?.(epoch)
  })
  await flush()
  expect(calls).toBe(2)
  act(() => {
    releases[1]?.({v: 2})
  })
  await flush()

  // second consumer, same event: the cache already holds the answer
  act(() => {
    void current[1]?.(epoch)
  })
  await flush()
  expect(calls).toBe(2)
  expect(view.getAllByText('v2')).toHaveLength(2)

  // but a new event still refetches
  act(() => {
    void current[1]?.(nextReloadEpoch())
  })
  await flush()
  expect(calls).toBe(3)
})

// The collapse must not swallow a genuinely newer event: a reload for a later
// epoch still supersedes whatever an earlier one put on the wire.
test('a later epoch still supersedes an in-flight request', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  let reload: ((epoch?: number) => Promise<void>) | undefined
  const Comp = () => {
    'use no memo'
    const resource = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    reload = resource.reload
    return <div>{resource.loaded ? `v${resource.data.v}` : 'pending'}</div>
  }
  const view = render(<Comp />)
  await flush()
  expect(calls).toBe(1)

  act(() => {
    void reload?.(nextReloadEpoch())
  })
  await flush()
  expect(calls).toBe(2)

  act(() => {
    void reload?.(nextReloadEpoch())
  })
  await flush()
  expect(calls).toBe(3)

  // the two superseded requests settle last and must not win
  act(() => {
    releases[2]?.({v: 3})
  })
  await flush()
  act(() => {
    releases[1]?.({v: 2})
    releases[0]?.({v: 1})
  })
  await flush()
  expect(view.getAllByText('v3')).toHaveLength(1)
  expect(namespace.peek('k')).toEqual({v: 3})
})

// End to end over the wiring that actually produced the burst: one reconnect,
// several mounted consumers, one rpc.
test('a reconnect reloads every consumer with one rpc', async () => {
  act(() => {
    useDaemonState.setState({handshakeGeneration: 1, handshakeState: 'done'})
  })
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  const Comp = () => {
    const {data, loaded} = useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    return <div>{loaded ? `v${data.v}` : 'pending'}</div>
  }
  const view = render(
    <>
      <Comp />
      <Comp />
      <Comp />
    </>
  )
  await flush()
  expect(calls).toBe(1)
  act(() => {
    releases[0]?.({v: 1})
  })
  await flush()

  act(() => {
    useDaemonState.setState({handshakeGeneration: 2, handshakeState: 'loading'})
  })
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  await flush()
  expect(calls).toBe(2)

  act(() => {
    releases[1]?.({v: 2})
  })
  await flush()
  expect(view.getAllByText('v2')).toHaveLength(3)
})

// An engine reset orphans in-flight rpcs without ever settling them. A forced
// load must not adopt one of those, or reload() never resolves.
test('reload() bypasses an orphaned in-flight request', async () => {
  const namespace = makeNamespace<string>('')
  let resolveSecond: ((v: string) => void) | undefined
  const load = jest
    .fn<() => Promise<string>>()
    .mockImplementationOnce(async () => await new Promise<string>(() => {}))
    .mockImplementationOnce(
      async () =>
        await new Promise<string>(resolve => {
          resolveSecond = resolve
        })
    )
  const {result} = renderHook(() =>
    useCachedResource({namespace, cacheKey: 'k', initialData: '', load, staleMs: 10_000})
  )
  await flush()
  expect(load).toHaveBeenCalledTimes(1)
  expect(result.current.loading).toBe(true)

  act(() => {
    void result.current.reload()
  })
  await flush()
  expect(load).toHaveBeenCalledTimes(2)

  act(() => {
    resolveSecond?.('fresh')
  })
  await flush()
  expect(result.current.data).toBe('fresh')
})

// A disabled hook must stay off the wire entirely, reconnects included, and must
// start loading the moment it is enabled without waiting for another event.
test('a disabled resource ignores reconnects until it is enabled', async () => {
  act(() => {
    useDaemonState.setState({handshakeGeneration: 1, handshakeState: 'done'})
  })
  const namespace = makeNamespace<Data>({v: 0})
  const load = jest.fn(async () => {
    await Promise.resolve()
    return {v: 1}
  })
  const {rerender, result} = renderHook(
    ({enabled}: {enabled: boolean}) =>
      useCachedResource({namespace, cacheKey: 'k', enabled, initialData: {v: 0}, load, staleMs: 5000}),
    {initialProps: {enabled: false}}
  )
  await flush()
  expect(load).not.toHaveBeenCalled()

  act(() => {
    useDaemonState.setState({handshakeGeneration: 2, handshakeState: 'loading'})
  })
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  await flush()
  expect(load).not.toHaveBeenCalled()
  expect(result.current.loaded).toBe(false)

  rerender({enabled: true})
  await flush()
  expect(load).toHaveBeenCalledTimes(1)
  expect(result.current.data).toEqual({v: 1})
})

// The hazard every consumer used to hand-roll around: a disabled instance - a
// shadow behind a provider, an off-screen row, an id that has not resolved -
// reset whatever cache object it was handed, wiping a real loader's data and
// costing a refetch on the next mount. With no key of its own it has no shared
// entry to reset.
test('a disabled instance never touches the shared entry', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const props = {cacheKey: 'k', initialData: {v: 0}, load, namespace, staleMs: 5000}

  const loader = renderHook(() => useCachedResource({...props, enabled: true}))
  await flush()
  expect(calls).toBe(1)
  loader.unmount()

  const disabled = renderHook(() => useCachedResource({...props, enabled: false}))
  await flush()
  disabled.unmount()

  // still inside the stale window, so the entry must still be there
  expect(namespace.peek('k')).toEqual({v: 1})
  const again = renderHook(() => useCachedResource({...props, enabled: true}))
  await flush()
  expect(calls).toBe(1)
  expect(again.result.current.data).toEqual({v: 1})
})

// An instance with no key has nothing shared to load into either, and must not
// seed an entry a later real loader would find already present but empty.
test('an instance with no key loads nothing and seeds no entry', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  const load = jest.fn(async () => {
    await Promise.resolve()
    return {v: 1}
  })
  renderHook(() =>
    useCachedResource<Data, string>({cacheKey: undefined, initialData: {v: 0}, load, namespace, staleMs: 5000})
  )
  await flush()
  expect(load).not.toHaveBeenCalled()
  expect(namespace.peek('k')).toEqual({v: 0})
})

test('clear() drops the cached data and reloads', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const {result} = renderHook(() =>
    useCachedResource({namespace, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
  )
  await flush()
  expect(calls).toBe(1)
  expect(result.current.data).toEqual({v: 1})
  expect(result.current.loaded).toBe(true)

  act(() => {
    result.current.clear()
  })
  expect(result.current.data).toEqual({v: 0})
  expect(result.current.loaded).toBe(false)
  expect(namespace.peek('k')).toEqual({v: 0})

  // clear() invalidates rather than just blanking state: the next stale check
  // has to go back to the wire even though staleMs has not elapsed.
  act(() => {
    void result.current.reload()
  })
  await flush()
  expect(calls).toBe(2)
  expect(result.current.data).toEqual({v: 2})
})

test('a cacheKey change loads the new key, and each key keeps its own entry', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  const seen: Array<string> = []
  const {rerender, result} = renderHook(
    ({cacheKey}: {cacheKey: string}) =>
      useCachedResource({
        namespace,
        cacheKey,
        initialData: {v: 0},
        load: async () => {
          seen.push(cacheKey)
          await Promise.resolve()
          return {v: seen.length}
        },
        staleMs: 5000,
      }),
    {initialProps: {cacheKey: 'a'}}
  )
  await flush()
  expect(seen).toEqual(['a'])
  expect(result.current.data).toEqual({v: 1})

  rerender({cacheKey: 'b'})
  await flush()
  expect(seen).toEqual(['a', 'b'])
  expect(result.current.data).toEqual({v: 2})

  // one entry per key, so coming back inside the stale window is a hit rather
  // than a refetch - and 'a' can never be served under key 'b'
  rerender({cacheKey: 'a'})
  await flush()
  expect(seen).toEqual(['a', 'b'])
  expect(result.current.data).toEqual({v: 1})
  expect(namespace.peek('b')).toEqual({v: 2})
})

// The entries are per-user data and module scope outlives a sign-out.
test('a sign-out reset empties every entry in the namespace', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const props = {cacheKey: 'k', initialData: {v: 0}, load, namespace, staleMs: 5000}
  const first = renderHook(() => useCachedResource(props))
  await flush()
  expect(calls).toBe(1)
  first.unmount()

  act(() => {
    resetAllStores()
  })
  expect(namespace.peek('k')).toEqual({v: 0})

  renderHook(() => useCachedResource(props))
  await flush()
  expect(calls).toBe(2)
})

const homeRefresh = {payload: {params: {}}, type: 'keybase.1.homeUI.homeUIRefresh'} as never

// Service notifications are coalesced over a 2s window, but an explicit
// invalidate() is already one event with its own epoch, and it has zeroed
// loadedAt - deferring it to the trailing edge leaves every consumer rendering
// empty for the rest of the window instead of for one round trip.
test('an explicit invalidate reloads now even inside an open coalescing window', async () => {
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const load = async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  }
  renderHook(() =>
    useCachedResource({
      cacheKey: 'k',
      initialData: {v: 0},
      invalidateOn: [{type: 'keybase.1.homeUI.homeUIRefresh'}],
      load,
      namespace,
      staleMs: 5000,
    })
  )
  await flush()
  expect(calls).toBe(1)

  // leading edge of the coalescing window
  act(() => {
    notifyEngineActionListeners(homeRefresh)
  })
  await flush()
  expect(calls).toBe(2)

  act(() => {
    namespace.invalidate('k')
  })
  await flush()
  expect(calls).toBe(3)
})

// A queued trailing reload would re-issue the rpc for the very team that was
// just deleted or left, and repopulate the entry the clear dropped.
test('a clear cancels a reload queued by an earlier notification', async () => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate']})
  const namespace = makeNamespace<Data>({v: 0})
  let calls = 0
  const load = async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  }
  renderHook(() =>
    useCachedResource({
      cacheKey: 'k',
      initialData: {v: 0},
      invalidateOn: [
        {type: 'keybase.1.homeUI.homeUIRefresh'},
        {effect: 'clear', type: 'keybase.1.NotifyBadges.badgeState'},
      ],
      load,
      namespace,
      staleMs: 5000,
    })
  )
  await flush()
  expect(calls).toBe(1)

  // two inside one window: leading fires now, trailing is queued
  act(() => {
    notifyEngineActionListeners(homeRefresh)
    notifyEngineActionListeners(homeRefresh)
  })
  await flush()
  expect(calls).toBe(2)

  act(() => {
    notifyEngineActionListeners({payload: {params: {}}, type: 'keybase.1.NotifyBadges.badgeState'} as never)
  })
  await flush()
  expect(namespace.peek('k')).toEqual({v: 0})

  act(() => {
    jest.advanceTimersByTime(5000)
  })
  await flush()
  // the trailing edge must not have fired: clear() is deliberate, and a reload
  // behind it would put the dropped entry straight back
  expect(calls).toBe(2)
  jest.useRealTimers()
})
