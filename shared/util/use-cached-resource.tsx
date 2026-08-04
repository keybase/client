import * as C from '@/constants'
import * as React from 'react'
import {produce} from 'immer'
import {joinAnyEpoch, nextReloadEpoch} from './reload-epoch'
import {useReloadOnReconnect} from './use-reload-on-reconnect'

export type CachedResourceCache<T, K> = {
  clearInFlight: (request: Promise<T>) => void
  getData: () => T
  getFailedAt: () => number
  getGeneration: () => number
  getInFlight: () => Promise<T> | undefined
  getInFlightEpoch: () => number
  getKey: () => K
  getLoadedAt: () => number
  getLoadedEpoch: () => number
  invalidate: (key: K) => void
  reset: (data: T, key: K) => void
  setDataLoaded: (data: T, generation: number, epoch: number) => void
  setInFlight: (request: Promise<T>, epoch: number) => void
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
  let inFlightEpoch = joinAnyEpoch
  let loadedAt = 0
  let loadedEpoch = joinAnyEpoch
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
    getInFlightEpoch: () => inFlightEpoch,
    getKey: () => storedKey,
    getLoadedAt: () => loadedAt,
    getLoadedEpoch: () => loadedEpoch,
    invalidate: nextKey => {
      failedAt = 0
      generation += 1
      inFlight = undefined
      loadedAt = 0
      loadedEpoch = joinAnyEpoch
      storedKey = nextKey
    },
    reset: (nextData, nextKey) => {
      data = nextData
      failedAt = 0
      generation += 1
      inFlight = undefined
      loadedAt = 0
      loadedEpoch = joinAnyEpoch
      storedKey = nextKey
    },
    setDataLoaded: (nextData, requestGeneration, epoch) => {
      if (generation === requestGeneration) {
        data = nextData
        failedAt = 0
        loadedAt = Date.now()
        loadedEpoch = epoch
      }
    },
    setInFlight: (request, epoch) => {
      inFlight = request
      inFlightEpoch = epoch
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
  setState: React.Dispatch<React.SetStateAction<StoredCachedResourceState<T, K>>>,
  epoch: number
) => {
  let request: Promise<T> | undefined
  // A request issued for an older event was already on the wire when whatever
  // we are reloading for happened, so it settles to pre-change data - and
  // stamps loadedAt on it, holding it stale for the whole window. Supersede it.
  // An equal epoch means it was issued for this same event by another consumer:
  // join it, which is what keeps one event to one rpc.
  const staleInFlight = !!cache.getInFlight() && cache.getInFlightEpoch() < epoch
  if (staleInFlight) {
    cache.invalidate(cacheKey)
  }
  // after the invalidate above, which bumps it
  const generation = cache.getGeneration()
  try {
    const inFlight = staleInFlight ? undefined : cache.getInFlight()
    if (inFlight) {
      const data = await inFlight
      if (requestVersion === requestVersionRef.current) {
        setState(settledState(cache, cacheKey, initialData, data))
      }
      return
    }
    request = load().then(data => {
      cache.setDataLoaded(data, generation, epoch)
      return data
    })
    cache.setInFlight(request, epoch)
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

  const loadResource = React.useCallback(async (force: boolean, epoch: number) => {
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
    // The in-flight check in runLoad only collapses consumers that overlap. When
    // the first consumer's request has already settled by the time the next one
    // runs its effect - 75ms was enough for teamListUnverified - what is in the
    // cache IS the answer to this event, so re-issuing just refetches it. A bare
    // reload() allocates a fresh epoch and so is never caught by this.
    if (force && loadedAt && cache.getLoadedEpoch() >= epoch) {
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
    await runLoad(
      cache,
      cacheKey,
      initialData,
      load,
      onError,
      requestVersion,
      requestVersionRef,
      setState,
      epoch
    )
  }, [])

  // epoch is how consumers reloading for one event collapse onto a single rpc,
  // so a caller that has one (an invalidation broadcast) should pass it. A bare
  // reload() is its own event and gets a fresh epoch, which supersedes anything
  // already on the wire. Guarded because reload is routinely handed straight to
  // an onClick, which would otherwise pass a react event as the epoch.
  const reload = React.useCallback(
    async (epoch?: number) => {
      await loadResource(true, typeof epoch === 'number' ? epoch : nextReloadEpoch())
    },
    [loadResource]
  )

  const loadIfStale = React.useCallback(async () => {
    await loadResource(false, joinAnyEpoch)
  }, [loadResource])

  // reconnects orphan any in-flight load; force so cached data from before the
  // restart doesn't mask post-restart changes. Disabled hooks must not touch the
  // shared cache (loadResource resets it when disabled)
  useReloadOnReconnect(epoch => {
    if (latestRef.current.enabled) {
      void loadResource(true, epoch)
    }
  })

  React.useEffect(() => {
    if (enabled) {
      // a key change is handled inside loadResource, which every load path goes
      // through - including the reload()/reconnect ones this effect never sees
      void loadIfStale()
    } else {
      // nothing will run loadResource to notice, so drop the stale key here
      requestVersionRef.current += 1
      resetCache(cacheKey)
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
