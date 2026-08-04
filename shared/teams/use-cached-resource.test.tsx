/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, jest, test} from '@jest/globals'
import {act, render} from '@testing-library/react'
import {createCachedResourceCache, useCachedResource} from './use-cached-resource'

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
