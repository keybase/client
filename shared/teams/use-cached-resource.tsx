import * as C from '@/constants'
import * as React from 'react'

export type CachedResourceCache<T, K> = {
  clearInFlight: (request: Promise<T>) => void
  getData: () => T
  getGeneration: () => number
  getInFlight: () => Promise<T> | undefined
  getKey: () => K
  getLoadedAt: () => number
  invalidate: (key: K) => void
  reset: (data: T, key: K) => void
  setDataLoaded: (data: T, generation: number) => void
  setInFlight: (request: Promise<T>) => void
}

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

export const createCachedResourceCache = <T, K>(initialData: T, key: K): CachedResourceCache<T, K> => {
  let data = initialData
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
    getGeneration: () => generation,
    getInFlight: (): Promise<T> | undefined => inFlight,
    getKey: () => storedKey,
    getLoadedAt: () => loadedAt,
    invalidate: nextKey => {
      generation += 1
      inFlight = undefined
      loadedAt = 0
      storedKey = nextKey
    },
    reset: (nextData, nextKey) => {
      data = nextData
      generation += 1
      inFlight = undefined
      loadedAt = 0
      storedKey = nextKey
    },
    setDataLoaded: (nextData, requestGeneration) => {
      if (generation === requestGeneration) {
        data = nextData
        loadedAt = Date.now()
      }
    },
    setInFlight: request => {
      inFlight = request
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

export const useCachedResource = <T, K>(props: Props<T, K>) => {
  const {cache, cacheKey, enabled = true, initialData, load, onError, refreshKey, staleMs} = props
  const [state, setState] = React.useState<StoredCachedResourceState<T, K>>(() =>
    storedState(cache, cacheKey, initialData, cachedState(cache, cacheKey, initialData))
  )
  const hasFocusedSinceMountRef = React.useRef(false)
  const requestVersionRef = React.useRef(0)

  const resetCache = React.useCallback(
    (nextKey: K) => {
      cache.reset(initialData, nextKey)
    },
    [cache, initialData]
  )

  const clear = React.useCallback(
    (nextKey: K = cacheKey) => {
      requestVersionRef.current += 1
      resetCache(nextKey)
      setState(storedState(cache, nextKey, initialData, emptyState(initialData)))
    },
    [cache, cacheKey, initialData, resetCache]
  )

  const latestRef = React.useRef({
    cache,
    cacheKey,
    enabled,
    initialData,
    load,
    onError,
    resetCache,
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
      resetCache,
      staleMs,
    }
  }, [cache, cacheKey, enabled, initialData, load, onError, resetCache, staleMs])

  const loadResource = React.useCallback(
    async (force: boolean) => {
      const {cache, cacheKey, enabled, initialData, load, onError, resetCache, staleMs} =
        latestRef.current
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
        setState(storedState(cache, cacheKey, initialData, {data: cache.getData(), loaded: true, loading: false}))
        return
      }
      const requestVersion = ++requestVersionRef.current
      setState(prev =>
        prev.cache === cache && Object.is(prev.cacheKey, cacheKey) && Object.is(prev.initialData, initialData)
          ? {...prev, loading: true}
          : storedState(cache, cacheKey, initialData, {...emptyState(initialData), loading: true})
      )
      let request: Promise<T> | undefined
      try {
        const inFlight = cache.getInFlight()
        if (inFlight) {
          const data = await inFlight
          if (requestVersion === requestVersionRef.current) {
            setState(storedState(cache, cacheKey, initialData, {data, loaded: true, loading: false}))
          }
          return
        }
        const generation = cache.getGeneration()
        request = load().then(data => {
          cache.setDataLoaded(data, generation)
          return data
        })
        cache.setInFlight(request)
        const data = await request
        if (requestVersion === requestVersionRef.current) {
          setState(storedState(cache, cacheKey, initialData, {data, loaded: true, loading: false}))
        }
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        onError?.(error)
        setState(prev => ({...prev, loading: false}))
      } finally {
        if (request) {
          cache.clearInFlight(request)
        }
      }
    },
    []
  )

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
