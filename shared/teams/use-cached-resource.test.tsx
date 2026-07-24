/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, jest, test} from '@jest/globals'
import {act, render} from '@testing-library/react'
import {createCachedResourceCache, useCachedResource} from './use-cached-resource'

const flush = async (turns = 40) => {
  for (let i = 0; i < turns; i++) {
    await act(async () => {
      await Promise.resolve()
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
  const load = jest.fn(async () => {
    calls++
    await Promise.resolve()
    throw new Error('nope')
  })
  const Comp = () => {
    const {data} = useCachedResource({
      cache,
      cacheKey: 'k',
      initialData: {v: 0},
      load,
      onError: () => {},
      staleMs: 5000,
    })
    return <div>{data.v}</div>
  }
  render(<Comp />)
  await flush()
  expect(calls).toBe(1)
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
  const Comp = () => {
    const {data, loaded} = useCachedResource({cache, cacheKey: 'k', initialData: {v: 0}, load, staleMs: 5000})
    return <div>{loaded ? data.v : 'x'}</div>
  }
  const {rerender} = render(<Comp />)
  await flush()
  rerender(<Comp />)
  await flush()
  expect(calls).toBe(1)
  expect(cache.getData()).toEqual({v: 1})
})
