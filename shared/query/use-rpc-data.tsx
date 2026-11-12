import * as C from '@/constants'
import * as React from 'react'
import type {WaitingKeys} from '@/constants/waiting-key-type'
import {
  attachLoader,
  forgetKey,
  getEntry,
  loadIfStale,
  refreshMethod,
  selectFrom,
  setEntryData,
  setLoader,
  stableKey,
  type Entry,
} from './cache'

// A generated *RpcPromise function
type AnyRpc = {readonly method: string} & ((
  params: never,
  waitingKey?: WaitingKeys,
  signal?: AbortSignal
) => Promise<unknown>)
type ParamsOf<F extends AnyRpc> = Parameters<F>[0]
// msgpack sends an absent result as null, and undefined is how the cache says "not loaded"
type DataOf<F extends AnyRpc> = Exclude<Awaited<ReturnType<F>>, undefined>

type Options<RAW, DATA> = {
  /** false: do not load, and show nothing */
  enabled?: boolean
  /** false: forget the data when the last screen loading it goes away, so the next one starts empty */
  keep?: boolean
  /** a load failed (not cancelled, not a lost link). Called once per load, not once per screen */
  onError?: (error: Error) => void
  /** when this changes, load again if the data is older than staleMs */
  refreshKey?: unknown
  /** reload every time the screen comes into focus, not only when the data is older than staleMs */
  reloadOnFocus?: boolean
  /** turn the result into what the screen wants. Keep it stable (module scope) */
  select?: (raw: RAW) => DATA
  /** a mount reloads data older than this; the default reloads on every mount */
  staleMs?: number
}

const selected = <DATA,>(entry: Entry, raw: unknown, select: ((raw: never) => DATA) | undefined) =>
  raw === undefined ? undefined : select ? selectFrom(entry, select, raw) : (raw as DATA)

const useEntry = <RAW, DATA>(entry: Entry, load: Entry['load'], options: Options<RAW, DATA>) => {
  const {enabled = true, keep = true, onError, refreshKey, reloadOnFocus = false, select, staleMs = 0} = options
  const snapshot = React.useSyncExternalStore(entry.subscribe, entry.getSnapshot)
  // before the effect below, which may start a load. A function call, not an assignment: the
  // compiler does not let an effect write to what the hook was given.
  React.useEffect(() => {
    if (enabled) {
      setLoader(entry, load, onError)
    }
  })
  React.useEffect(
    () => (enabled ? attachLoader(entry, staleMs, keep) : undefined),
    [enabled, entry, keep, staleMs]
  )
  const lastRefreshKey = React.useRef(refreshKey)
  React.useEffect(() => {
    if (lastRefreshKey.current !== refreshKey) {
      lastRefreshKey.current = refreshKey
      if (enabled) {
        void loadIfStale(entry, staleMs)
      }
    }
  }, [enabled, entry, refreshKey, staleMs])
  // The focus that comes with the mount finds the mount's load on the wire, or its data fresh
  const onFocus = React.useEffectEvent(() => {
    if (enabled && (reloadOnFocus || staleMs > 0)) {
      void loadIfStale(entry, reloadOnFocus ? 0 : staleMs)
    }
  })
  const [focusEffect] = React.useState(() => () => {
    onFocus()
  })
  C.Router2.useSafeFocusEffect(focusEffect)

  return {
    data: selected(entry, enabled ? snapshot.data : undefined, select as ((raw: never) => DATA) | undefined),
    error: enabled ? snapshot.error : undefined,
    loadCount: snapshot.loadCount,
    loaded: enabled && snapshot.loaded,
    loading: enabled && (snapshot.loading || (!snapshot.settled && !snapshot.forgotten)),
    reload: entry.reload,
    reloadAndWait: entry.reloadAndWait,
    settled: enabled && snapshot.settled,
  }
}

const rpcLoad =
  <F extends AnyRpc>(rpc: F, params: ParamsOf<F>, waitingKey?: WaitingKeys): Entry['load'] =>
  async signal => {
    const call = rpc as unknown as (p: unknown, w?: WaitingKeys, s?: AbortSignal) => Promise<unknown>
    return call(params, waitingKey, signal)
  }

const rpcEntry = <F extends AnyRpc>(rpc: F, params: ParamsOf<F>, load = rpcLoad(rpc, params)) =>
  getEntry(stableKey(rpc.method, params), rpc.method, load)

/**
 * What a read rpc returns, from the cache every screen shares: screens asking for the same method
 * and params make one call and see one answer, and a screen opened later shows the cached answer
 * while it reloads. It loads again after a reconnect or when the service says the data changed
 * (see notifications), and the cache is emptied on an account change.
 * @returns data: undefined until a load lands
 * @returns error: from the last load, cleared by the next success
 * @returns loadCount: successful loads so far, useful as a refresh token
 * @returns loaded: a load has succeeded, so data is the service's answer
 * @returns settled: a load finished, with data or an error
 * @returns loading: a load is on the wire or about to be
 * @returns reload: load now, dropping the answer of a load already on the wire
 * @returns reloadAndWait: reload, resolving once it is over: answered, failed, or cut off by a lost link
 */
export const useRpcData = <F extends AnyRpc, DATA = DataOf<F>>(
  rpc: F,
  params: ParamsOf<F>,
  options: Options<DataOf<F>, DATA> & {waitingKey?: WaitingKeys} = {}
) => {
  const load = rpcLoad(rpc, params, options.waitingKey)
  return useEntry(rpcEntry(rpc, params, load), load, options)
}

/**
 * Only what another screen's useRpcData has loaded: never starts a load, and costs a list row no
 * more than the subscription.
 */
export const useCachedRpcData = <F extends AnyRpc, DATA = DataOf<F>>(
  rpc: F,
  params: ParamsOf<F>,
  select?: (raw: DataOf<F>) => DATA
) => {
  const entry = rpcEntry(rpc, params)
  // only the data: a reader does not render again for a reload that brought nothing new
  const raw = React.useSyncExternalStore(entry.subscribe, entry.getData)
  return selected(entry, raw, select as ((raw: never) => DATA) | undefined)
}

/**
 * useRpcData for a load that is more than one rpc call. `name` and `key` identify the data:
 * screens passing the same ones share it, and it is loaded with the `load` of whichever loaded last.
 */
export const useLoadData = <RAW, DATA = RAW>(
  name: string,
  key: unknown,
  load: (signal: AbortSignal) => Promise<RAW>,
  options: Options<RAW, DATA> = {}
) => useEntry(getEntry(stableKey(name, key), name, load), load, options)

/** the service's data behind this rpc changed (after a write, or on a notice): reload it wherever it is shown */
export const refreshRpc = (rpc: AnyRpc, debounceMs?: number) => refreshMethod(rpc.method, undefined, debounceMs)
/** refreshRpc for a useLoadData name; with a key (not undefined) for just that one */
export const refreshLoad = (name: string, key?: unknown, debounceMs?: number) =>
  refreshMethod(name, key === undefined ? undefined : stableKey(name, key), debounceMs)

/** drop a useLoadData's cached data: for when it no longer exists, where refreshLoad would reload it */
export const forgetLoad = (name: string, key: unknown) => forgetKey(stableKey(name, key))

/**
 * Show this now, for an optimistic update. Call refreshRpc when the write has settled: a load
 * already on the wire is dropped, and nothing else brings the service's answer back.
 */
export const setRpcData = <F extends AnyRpc>(
  rpc: F,
  params: ParamsOf<F>,
  next: (prev: DataOf<F> | undefined) => DataOf<F> | undefined
) => setEntryData(rpcEntry(rpc, params), next as (prev: unknown) => unknown)

/** reload it if a screen is loading it and its data is older than staleMs; resolves when no load is on the wire */
export const loadRpcIfStale = async <F extends AnyRpc>(rpc: F, params: ParamsOf<F>, staleMs: number) =>
  loadIfStale(rpcEntry(rpc, params), staleMs)
