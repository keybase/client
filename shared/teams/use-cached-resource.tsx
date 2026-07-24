import * as C from '@/constants'
import * as React from 'react'
import {produce} from 'immer'

export type CachedResourceCache<T, K> = {
  clearInFlight: (request: Promise<T>) => void
  getData: () => T
  getFailedAt: () => number
  getGeneration: () => number
  getInFlight: () => Promise<T> | undefined
  getKey: () => K
  getLoadedAt: () => number
  invalidate: (key: K) => void
  reset: (data: T, key: K) => void
  setDataLoaded: (data: T, generation: number) => void
  setInFlight: (request: Promise<T>) => void
  setLoadFailed: (generation: number) => void
}

// A load that never lands (it rejected, or its result was discarded because the
// cache was invalidated mid-flight) leaves loadedAt at 0, i.e. permanently
// stale. Without this window every re-run of the effect below would re-issue the
// request the instant the previous one settled - an unbounded retry loop at RPC
// speed. An explicit reload()/invalidate() still retries immediately.
const loadFailureBackoffMs = 5_000

type CachedResourceState<T> = {
  data: T
  loaded: boolean
  loading: boolean
}

type StoredCachedResourceState<T, K> = CachedResourceState<T> & {
  cache: CachedResourceCache<T, K>
  cacheKey: K
  initialData: T
}

type Props<T, K> = {
  cache: CachedResourceCache<T, K>
  cacheKey: K
  enabled?: boolean
  initialData: T
  load: () => Promise<T>
  onError?: (error: unknown) => void
  refreshKey?: unknown
  staleMs: number
}

const emptyState = <T,>(data: T): CachedResourceState<T> => ({
  data,
  loaded: false,
  loading: false,
})

const cachedState = <T, K>(
  cache: CachedResourceCache<T, K>,
  cacheKey: K,
  initialData: T
): CachedResourceState<T> =>
  Object.is(cache.getKey(), cacheKey) && cache.getLoadedAt()
    ? {data: cache.getData(), loaded: true, loading: false}
    : emptyState(initialData)

const storedState = <T, K>(
  cache: CachedResourceCache<T, K>,
  cacheKey: K,
  initialData: T,
  state: CachedResourceState<T>
): StoredCachedResourceState<T, K> => ({
  ...state,
  cache,
  cacheKey,
  initialData,
})

// Settling to already-current data must not produce a new state object: every
// loadIfStale() that finds the cache fresh would otherwise force a re-render,
// which re-runs the effect that called it, which re-renders... a loop paced only
// by how fast React can commit.
const settledState =
  <T, K>(cache: CachedResourceCache<T, K>, cacheKey: K, initialData: T, data: T) =>
  (prev: StoredCachedResourceState<T, K>): StoredCachedResourceState<T, K> =>
    prev.cache === cache &&
    Object.is(prev.cacheKey, cacheKey) &&
    Object.is(prev.initialData, initialData) &&
    Object.is(prev.data, data) &&
    prev.loaded &&
    !prev.loading
      ? prev
      : storedState(cache, cacheKey, initialData, {data, loaded: true, loading: false})

export const createCachedResourceCache = <T, K>(initialData: T, key: K): CachedResourceCache<T, K> => {
  let data = initialData
  let failedAt = 0
  let generation = 0
  let inFlight: Promise<T> | undefined
  let loadedAt = 0
  let storedKey = key

  return {
    clearInFlight: request => {
      if (inFlight === request) {
        inFlight = undefined
      }
    },
    getData: () => data,
    getFailedAt: () => failedAt,
    getGeneration: () => generation,
    getInFlight: (): Promise<T> | undefined => inFlight,
    getKey: () => storedKey,
    getLoadedAt: () => loadedAt,
    invalidate: nextKey => {
      failedAt = 0
      generation += 1
      inFlight = undefined
      loadedAt = 0
      storedKey = nextKey
    },
    reset: (nextData, nextKey) => {
      data = nextData
      failedAt = 0
      generation += 1
      inFlight = undefined
      loadedAt = 0
      storedKey = nextKey
    },
    setDataLoaded: (nextData, requestGeneration) => {
      if (generation === requestGeneration) {
        data = nextData
        failedAt = 0
        loadedAt = Date.now()
      }
    },
    setInFlight: request => {
      inFlight = request
    },
    setLoadFailed: requestGeneration => {
      if (generation === requestGeneration) {
        failedAt = Date.now()
      }
    },
  }
}

export const getCachedResourceCache = <T, K>(
  map: Map<K, CachedResourceCache<T, K>>,
  initialData: T,
  key: K
) => {
  const existing = map.get(key)
  if (existing) {
    return existing
  }
  const created = createCachedResourceCache(initialData, key)
  map.set(key, created)
  return created
}

const runLoad = async <T, K>(
  cache: CachedResourceCache<T, K>,
  cacheKey: K,
  initialData: T,
  load: () => Promise<T>,
  onError: ((error: unknown) => void) | undefined,
  requestVersion: number,
  requestVersionRef: React.RefObject<number>,
  setState: React.Dispatch<React.SetStateAction<StoredCachedResourceState<T, K>>>
) => {
  let request: Promise<T> | undefined
  const generation = cache.getGeneration()
  try {
    const inFlight = cache.getInFlight()
    if (inFlight) {
      const data = await inFlight
      if (requestVersion === requestVersionRef.current) {
        setState(settledState(cache, cacheKey, initialData, data))
      }
      return
    }
    request = load().then(data => {
      cache.setDataLoaded(data, generation)
      return data
    })
    cache.setInFlight(request)
    const data = await request
    if (requestVersion === requestVersionRef.current) {
      setState(settledState(cache, cacheKey, initialData, data))
    }
  } catch (error) {
    // record the failure even for a superseded request: the backoff belongs to
    // the shared cache, not to whichever instance happened to own the request
    cache.setLoadFailed(generation)
    if (requestVersion !== requestVersionRef.current) {
      return
    }
    onError?.(error)
    setState(
      produce(draft => {
        draft.loading = false
      })
    )
  } finally {
    if (request) {
      cache.clearInFlight(request)
    }
  }
}

export const useCachedResource = <T, K>(props: Props<T, K>) => {
  const {cache, cacheKey, enabled = true, initialData, load, onError, refreshKey, staleMs} = props
  const [state, setState] = React.useState<StoredCachedResourceState<T, K>>(() =>
    storedState(cache, cacheKey, initialData, cachedState(cache, cacheKey, initialData))
  )
  const hasFocusedSinceMountRef = React.useRef(false)
  const requestVersionRef = React.useRef(0)

  const latestRef = React.useRef({
    cache,
    cacheKey,
    enabled,
    initialData,
    load,
    onError,
    staleMs,
  })
  React.useLayoutEffect(() => {
    latestRef.current = {
      cache,
      cacheKey,
      enabled,
      initialData,
      load,
      onError,
      staleMs,
    }
  }, [cache, cacheKey, enabled, initialData, load, onError, staleMs])

  // deliberately does not depend on initialData: resetCache is in the main
  // effect's dep array, and callers routinely rebuild initialData (seeding it
  // from another store), which would re-run the effect on every such change.
  const resetCache = React.useCallback(
    (nextKey: K) => {
      cache.reset(latestRef.current.initialData, nextKey)
    },
    [cache]
  )

  const clear = React.useCallback(
    (nextKey: K = cacheKey) => {
      requestVersionRef.current += 1
      resetCache(nextKey)
      setState(storedState(cache, nextKey, initialData, emptyState(initialData)))
    },
    [cache, cacheKey, initialData, resetCache]
  )

  const loadResource = React.useCallback(async (force: boolean) => {
    const {cache, cacheKey, enabled, initialData, load, onError, staleMs} = latestRef.current
    const resetCache = (nextKey: K) => {
      cache.reset(initialData, nextKey)
    }
    if (!Object.is(cache.getKey(), cacheKey)) {
      requestVersionRef.current += 1
      resetCache(cacheKey)
    }
    if (!enabled) {
      requestVersionRef.current += 1
      resetCache(cacheKey)
      return
    }
    const loadedAt = cache.getLoadedAt()
    if (!force && loadedAt && Date.now() - loadedAt < staleMs) {
      setState(settledState(cache, cacheKey, initialData, cache.getData()))
      return
    }
    const failedAt = cache.getFailedAt()
    if (!force && failedAt && Date.now() - failedAt < loadFailureBackoffMs) {
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev =>
      prev.cache === cache && Object.is(prev.cacheKey, cacheKey) && Object.is(prev.initialData, initialData)
        ? prev.loading
          ? prev
          : {...prev, loading: true}
        : storedState(cache, cacheKey, initialData, {...emptyState(initialData), loading: true})
    )
    await runLoad(cache, cacheKey, initialData, load, onError, requestVersion, requestVersionRef, setState)
  }, [])

  const reload = React.useCallback(async () => {
    await loadResource(true)
  }, [loadResource])

  const loadIfStale = React.useCallback(async () => {
    await loadResource(false)
  }, [loadResource])

  React.useEffect(() => {
    if (!Object.is(cache.getKey(), cacheKey) || !enabled) {
      requestVersionRef.current += 1
      resetCache(cacheKey)
    }
    if (enabled) {
      void loadIfStale()
    }
  }, [cache, cacheKey, enabled, loadIfStale, refreshKey, resetCache])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (!enabled) {
        return
      }
      if (hasFocusedSinceMountRef.current) {
        void loadIfStale()
      } else {
        hasFocusedSinceMountRef.current = true
      }
    }, [enabled, loadIfStale])
  )

  const stateMatches =
    state.cache === cache &&
    Object.is(state.cacheKey, cacheKey) &&
    Object.is(state.initialData, initialData) &&
    (!state.loaded || !!cache.getLoadedAt())
  const visibleState = !enabled
    ? emptyState(initialData)
    : stateMatches
      ? state
      : cachedState(cache, cacheKey, initialData)

  return {
    clear,
    data: visibleState.data,
    loadIfStale,
    loaded: visibleState.loaded,
    loading: visibleState.loading,
    reload,
  }
}
