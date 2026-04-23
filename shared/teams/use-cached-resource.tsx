import * as C from '@/constants'
import * as React from 'react'

export type CachedResourceCache<T, K> = {
  data: T
  generation: number
  inFlight?: Promise<T>
  key: K
  loadedAt: number
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

export const createCachedResourceCache = <T, K>(initialData: T, key: K): CachedResourceCache<T, K> => ({
  data: initialData,
  generation: 0,
  key,
  loadedAt: 0,
})

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
    Object.is(cache.key, cacheKey) && cache.loadedAt
      ? {data: cache.data, loaded: true, loading: false}
      : emptyState(initialData)
  )
  const hasFocusedSinceMountRef = React.useRef(false)
  const requestVersionRef = React.useRef(0)

  const resetCache = React.useCallback(
    (nextKey: K) => {
      cache.data = initialData
      cache.generation += 1
      cache.inFlight = undefined
      cache.key = nextKey
      cache.loadedAt = 0
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

  const loadResource = React.useEffectEvent(async (force: boolean) => {
    if (!Object.is(cache.key, cacheKey)) {
      requestVersionRef.current += 1
      resetCache(cacheKey)
      setState(emptyState(initialData))
    }
    if (!enabled) {
      clear(cacheKey)
      return
    }
    if (!force && cache.loadedAt && Date.now() - cache.loadedAt < staleMs) {
      setState({data: cache.data, loaded: true, loading: false})
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    let request: Promise<T> | undefined
    try {
      if (cache.inFlight) {
        const data = await cache.inFlight
        if (requestVersion === requestVersionRef.current) {
          setState({data, loaded: true, loading: false})
        }
        return
      }
      const generation = cache.generation
      request = load().then(data => {
        if (cache.generation === generation) {
          cache.data = data
          cache.loadedAt = Date.now()
        }
        return data
      })
      cache.inFlight = request
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
      if (request && cache.inFlight === request) {
        cache.inFlight = undefined
      }
    }
  })

  const reload = React.useCallback(async () => {
    await loadResource(true)
  }, [])

  const loadIfStale = React.useCallback(async () => {
    await loadResource(false)
  }, [])

  React.useEffect(() => {
    setState(
      Object.is(cache.key, cacheKey) && cache.loadedAt
        ? {data: cache.data, loaded: true, loading: false}
        : emptyState(initialData)
    )
    if (!Object.is(cache.key, cacheKey)) {
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
