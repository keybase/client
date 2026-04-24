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
    getInFlight: () => inFlight,
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
  const [state, setState] = React.useState<CachedResourceState<T>>(
    Object.is(cache.getKey(), cacheKey) && cache.getLoadedAt()
      ? {data: cache.getData(), loaded: true, loading: false}
      : emptyState(initialData)
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
      setState(emptyState(initialData))
    },
    [cacheKey, initialData, resetCache]
  )

  const latestRef = React.useRef({
    cache,
    cacheKey,
    clear,
    enabled,
    initialData,
    load,
    onError,
    resetCache,
    staleMs,
  })
  React.useEffect(() => {
    latestRef.current = {
      cache,
      cacheKey,
      clear,
      enabled,
      initialData,
      load,
      onError,
      resetCache,
      staleMs,
    }
  }, [cache, cacheKey, clear, enabled, initialData, load, onError, resetCache, staleMs])

  const loadResource = React.useCallback(
    async (force: boolean) => {
      const {cache, cacheKey, clear, enabled, initialData, load, onError, resetCache, staleMs} =
        latestRef.current
      if (!Object.is(cache.getKey(), cacheKey)) {
        requestVersionRef.current += 1
        resetCache(cacheKey)
        setState(emptyState(initialData))
      }
      if (!enabled) {
        clear(cacheKey)
        return
      }
      const loadedAt = cache.getLoadedAt()
      if (!force && loadedAt && Date.now() - loadedAt < staleMs) {
        setState({data: cache.getData(), loaded: true, loading: false})
        return
      }
      const requestVersion = ++requestVersionRef.current
      setState(prev => ({...prev, loading: true}))
      let request: Promise<T> | undefined
      try {
        const inFlight = cache.getInFlight()
        if (inFlight) {
          const data = await inFlight
          if (requestVersion === requestVersionRef.current) {
            setState({data, loaded: true, loading: false})
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
          setState({data, loaded: true, loading: false})
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
    setState(
      Object.is(cache.getKey(), cacheKey) && cache.getLoadedAt()
        ? {data: cache.getData(), loaded: true, loading: false}
        : emptyState(initialData)
    )
    if (!Object.is(cache.getKey(), cacheKey)) {
      clear(cacheKey)
    }
    void loadIfStale()
  }, [cache, cacheKey, clear, enabled, initialData, loadIfStale, refreshKey])

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

  return {...state, clear, loadIfStale, reload}
}
