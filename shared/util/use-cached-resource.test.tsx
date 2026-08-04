/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {nextReloadEpoch} from './reload-epoch'
import {createCachedResourceCache, useCachedResource} from './use-cached-resource'

afterEach(() => {
  cleanup()
  useDaemonState.setState({handshakeGeneration: 0, handshakeState: 'loading'})
})

// A setState that lands outside act() - every load settling on its own - is
// scheduled on React's MessageChannel, i.e. a macrotask. A flush built only from
// awaited microtasks never lets the event loop reach it, so the commit lands (or
// not) depending on how the runtime happens to interleave: use a real timer.
const flush = async (turns = 40) => {
  for (let i = 0; i < turns; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

type Data = {v: number}

// A caller that rebuilds initialData every render (seeding it from another
// store) must not put useCachedResource into a render loop.
test('unstable initialData does not loop', async () => {
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
    const {data} = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
      cache,
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
      cache,
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
  let calls = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const Comp = ({staleMs}: {staleMs: number}) => {
    const {data, loaded} = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs})
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
  expect(cache.getData()).toEqual({v: 1})

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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
    const resource = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  act(() => {
    releases[1]?.({v: 2})
  })
  await forced
  await flush()
  expect(view.getAllByText('v2')).toHaveLength(1)
  expect(cache.getData()).toEqual({v: 2})
})

// The mutation and the reload it triggers routinely fall inside one millisecond,
// so ordering the two by Date.now() compares them equal and the forced load
// joins the very request it exists to supersede.
test('a forced reload supersedes a same-millisecond request', async () => {
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
    const resource = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
  let calls = 0
  let release: ((v: Data) => void) | undefined
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      release = resolve
    })
  })
  const Comp = () => {
    const {data, loaded} = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
    const resource = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
    const resource = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
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
    const resource = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  expect(cache.getData()).toEqual({v: 3})
})

// End to end over the wiring that actually produced the burst: one reconnect,
// several mounted consumers, one rpc.
test('a reconnect reloads every consumer with one rpc', async () => {
  act(() => {
    useDaemonState.setState({handshakeGeneration: 1, handshakeState: 'done'})
  })
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
  let calls = 0
  const releases: Array<(v: Data) => void> = []
  const load = jest.fn(async () => {
    calls++
    return await new Promise<Data>(resolve => {
      releases.push(resolve)
    })
  })
  const Comp = () => {
    const {data, loaded} = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  const cache = createCachedResourceCache<string, string>('', 'k')
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
    useCachedResource({cache, cacheKey: 'k', initialData: '', load, staleMs: 10_000})
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
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
  const load = jest.fn(async () => {
    await Promise.resolve()
    return {v: 1}
  })
  const {rerender, result} = renderHook(
    ({enabled}: {enabled: boolean}) =>
      useCachedResource({cache, cacheKey: 'k', enabled, initialData: {v: 0}, load, staleMs: 5000}),
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

// Nothing runs loadResource while a hook is disabled, so becoming disabled is
// the only chance to drop data the cache is still holding under the old key.
test('a resource that is disabled while its key changes clears the stale key', async () => {
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'a')
  const load = jest.fn(async () => {
    await Promise.resolve()
    return {v: 1}
  })
  const {rerender} = renderHook(
    ({cacheKey, enabled}: {cacheKey: string; enabled: boolean}) =>
      useCachedResource({cache, cacheKey, enabled, initialData: {v: 0}, load, staleMs: 5000}),
    {initialProps: {cacheKey: 'a', enabled: true}}
  )
  await flush()
  expect(cache.getKey()).toBe('a')
  expect(cache.getLoadedAt()).not.toBe(0)

  rerender({cacheKey: 'b', enabled: false})
  await flush()
  expect(cache.getKey()).toBe('b')
  expect(cache.getLoadedAt()).toBe(0)
  expect(load).toHaveBeenCalledTimes(1)
})

test('clear() drops the cached data and reloads', async () => {
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'k')
  let calls = 0
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    return {v: calls}
  })
  const {result} = renderHook(() =>
    useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
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
  expect(cache.getLoadedAt()).toBe(0)

  // clear() invalidates rather than just blanking state: the next stale check
  // has to go back to the wire even though staleMs has not elapsed.
  act(() => {
    void result.current.reload()
  })
  await flush()
  expect(calls).toBe(2)
  expect(result.current.data).toEqual({v: 2})
})

test('a cacheKey change resets the cache and refetches', async () => {
  const cache = createCachedResourceCache<Data, string>({v: 0}, 'a')
  const seen: Array<string> = []
  const {rerender, result} = renderHook(
    ({cacheKey}: {cacheKey: string}) =>
      useCachedResource({
        cache,
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
  expect(cache.getKey()).toBe('b')
  expect(result.current.data).toEqual({v: 2})

  // data for the old key must not resurface when the key comes back: the reset
  // dropped it, so this is a fresh load rather than a cache hit.
  rerender({cacheKey: 'a'})
  await flush()
  expect(seen).toEqual(['a', 'b', 'a'])
  expect(result.current.data).toEqual({v: 3})
})
