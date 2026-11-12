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
  setLoad,
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
  /** false: only show what another screen loads, and never start a load */
  load?: boolean
  /** when this changes, load again if the data is older than staleMs */
  refreshKey?: unknown
  /** reload every time the screen comes into focus, not only when the data is older than staleMs */
  reloadOnFocus?: boolean
  /** turn the result into what the screen wants. Keep it stable (module scope) */
  select?: (raw: RAW) => DATA
  /** a mount reloads data older than this; the default reloads on every mount */
  staleMs?: number
}

const useEntry = <RAW, DATA>(entry: Entry, load: Entry['load'], options: Options<RAW, DATA>) => {
  const {enabled = true, keep = true, load: loadsData = true, refreshKey, reloadOnFocus = false, select, staleMs = 0} = options
  const snapshot = React.useSyncExternalStore(entry.subscribe, entry.getSnapshot)
  const loads = enabled && loadsData
  // before the effect below, which may start a load
  React.useEffect(() => {
    if (loads) {
      setLoad(entry, load)
    }
  })
  React.useEffect(
    () => (loads ? attachLoader(entry, staleMs, keep) : undefined),
    [entry, keep, loads, staleMs]
  )
  const lastRefreshKey = React.useRef(refreshKey)
  React.useEffect(() => {
    if (lastRefreshKey.current !== refreshKey) {
      lastRefreshKey.current = refreshKey
      if (loads) {
        void loadIfStale(entry, staleMs)
      }
    }
  }, [entry, loads, refreshKey, staleMs])
  // the first focus is the mount, which has loaded already
  const hasFocused = React.useRef(false)
  const onFocus = React.useEffectEvent(() => {
    if (!loads) {
      return
    }
    if (reloadOnFocus) {
      entry.ensure()
    } else if (hasFocused.current && staleMs > 0) {
      void loadIfStale(entry, staleMs)
    }
    hasFocused.current = true
  })
  const [focusEffect] = React.useState(() => () => {
    onFocus()
    return undefined
  })
  C.Router2.useSafeFocusEffect(focusEffect)

  const raw = enabled ? snapshot.data : undefined
  const data =
    raw === undefined ? undefined : select ? selectFrom(entry, select as (d: never) => DATA, raw) : (raw as DATA)
  return {
    data,
    error: enabled ? snapshot.error : undefined,
    loadCount: snapshot.loadCount,
    loaded: enabled && snapshot.loaded,
    loading: snapshot.loading || (loads && !snapshot.loaded),
    reload: entry.reload,
    reloadAndWait: entry.reloadAndWait,
  }
}

const rpcLoad =
  <F extends AnyRpc>(rpc: F, params: ParamsOf<F>, waitingKey?: WaitingKeys): Entry['load'] =>
  async signal => {
    const call = rpc as unknown as (p: unknown, w?: WaitingKeys, s?: AbortSignal) => Promise<unknown>
    return call(params, waitingKey, signal)
  }

const entryFor = <F extends AnyRpc>(rpc: F, params: ParamsOf<F>, waitingKey?: WaitingKeys) =>
  getEntry(stableKey(rpc.method, params), rpc.method, rpcLoad(rpc, params, waitingKey))

/**
 * What a read rpc returns, from the cache every screen shares: screens asking for the same method
 * and params make one call and see one answer, and a screen opened later shows the cached answer
 * while it reloads. The load is cancelled when the last screen using it goes away, runs again
 * after a reconnect or when the service says the data changed (see notifications), and the cache
 * is emptied on an account change.
 * @returns data: undefined until a load lands
 * @returns error: from the last load, cleared by the next success
 * @returns loadCount: successful loads so far, useful as a refresh token
 * @returns loaded: a load finished, with data or an error
 * @returns loading: a load is on the wire or about to be
 * @returns reload: load now, dropping the answer of a load already on the wire
 * @returns reloadAndWait: reload, resolving once the answer (or its failure) is in
 */
export const useRpcData = <F extends AnyRpc, DATA = DataOf<F>>(
  rpc: F,
  params: ParamsOf<F>,
  options: Options<DataOf<F>, DATA> & {waitingKey?: WaitingKeys} = {}
) => useEntry(entryFor(rpc, params, options.waitingKey), rpcLoad(rpc, params, options.waitingKey), options)

const loadEntryFor = <RAW,>(name: string, key: unknown, load: (signal: AbortSignal) => Promise<RAW>) =>
  getEntry(stableKey(name, key), name, load)

/**
 * useRpcData for a load that is more than one rpc call. `name` and `key` identify the data:
 * screens passing the same ones share it, and it is loaded with the `load` of whichever loaded last.
 */
export const useLoadData = <RAW, DATA = RAW>(
  name: string,
  key: unknown,
  load: (signal: AbortSignal) => Promise<RAW>,
  options: Options<RAW, DATA> = {}
) => useEntry(loadEntryFor(name, key, load), load, options)

/** the service's data behind this rpc changed (after a write, or on a notice): reload it wherever it is shown */
export const refreshRpc = (rpc: AnyRpc) => refreshMethod(rpc.method)
/** refreshRpc for a useLoadData name, and with a key for just that one */
export const refreshLoad = (name: string, ...key: [] | [unknown]) =>
  refreshMethod(name, key.length ? stableKey(name, key[0]) : undefined)

/** drop a useLoadData's cached data: for when it no longer exists, where refreshLoad would reload it */
export const forgetLoad = (name: string, key: unknown) => forgetKey(stableKey(name, key))

/** show this now, for an optimistic update; the next load's answer wins */
export const setRpcData = <F extends AnyRpc>(
  rpc: F,
  params: ParamsOf<F>,
  next: (prev: DataOf<F> | undefined) => DataOf<F> | undefined
) => setEntryData(entryFor(rpc, params), next as (prev: unknown) => unknown)

/** reload it if a screen is loading it and its data is older than staleMs; resolves when no load is on the wire */
export const loadRpcIfStale = async <F extends AnyRpc>(rpc: F, params: ParamsOf<F>, staleMs: number) =>
  loadIfStale(entryFor(rpc, params), staleMs)
