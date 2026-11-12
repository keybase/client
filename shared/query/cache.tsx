// One cache for what read rpcs return, keyed by method and params and shared by every screen.
// Screens use it through useRpcData; this file holds the entries and the rules they all follow:
// who starts a load, what a change notice costs, and what a lost link or an account change does.
import {onNewAccountGeneration} from '@/engine/account-generation'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {ensureError, isCancelled} from '@/util/errors'
import {registerExternalResetter} from '@/util/zustand'

export type Snapshot = {
  /** undefined until a load lands */
  readonly data: unknown
  readonly error: Error | undefined
  /** successful loads so far */
  readonly loadCount: number
  /** a load finished, with data or an error */
  readonly loaded: boolean
  readonly loading: boolean
}

export type Entry = {
  readonly method: string
  // the one the latest loading screen passed; every screen's is equivalent, by the key
  load: (signal: AbortSignal) => Promise<unknown>
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => Snapshot
  /** load now; a load on the wire may predate what the caller knows, so its answer is dropped */
  readonly reload: () => void
  /** reload, resolving once the answer (or its failure) is in */
  readonly reloadAndWait: () => Promise<void>
  /** load unless a load is already on the wire */
  readonly ensure: () => void
  snapshot: Snapshot
  listeners: Set<() => void>
  // mounted hooks that load it; a reader only listens
  loaders: number
  inFlight?: AbortController
  // a change notice came during the load in flight, whose answer may predate the change
  queued: boolean
  stale: boolean
  loadedAt: number
  failedAt: number
  idleSince: number
  selected: WeakMap<object, {input: unknown; output: unknown}>
}

const empty: Snapshot = {data: undefined, error: undefined, loadCount: 0, loaded: false, loading: false}
// A mount does not retry a load that just failed: screens mounting one after another would
// otherwise each reissue it. reload() and a change notice still load at once.
const failureBackoffMs = 5_000
const idleEntryMs = 5 * 60_000
const entries = new Map<string, Entry>()

const bytesToKey = (bytes: Uint8Array) => `bytes:${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`

/** the same params give the same key whatever order their fields are written in */
export const stableKey = (method: string, params: unknown) =>
  `${method} ${JSON.stringify(params ?? null, (_k, value: unknown) => {
    if (value instanceof Uint8Array) {
      return bytesToKey(value)
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      return Object.fromEntries(Object.keys(record).sort().map(k => [k, record[k]]))
    }
    return value
  })}`

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype

/** next, with every part of prev that is deep-equal kept by identity (all of prev when nothing changed) */
export const reuseEqual = <T,>(prev: unknown, next: T): T => {
  if (Object.is(prev, next)) {
    return next
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    const out = next.map((n: unknown, i) => reuseEqual(prev[i], n))
    return (prev.length === out.length && out.every((o, i) => o === prev[i]) ? prev : out) as T
  }
  if (prev instanceof Uint8Array && next instanceof Uint8Array) {
    return (prev.length === next.length && prev.every((b, i) => b === next[i]) ? prev : next) as T
  }
  if (prev instanceof Map && next instanceof Map) {
    const out = new Map<unknown, unknown>()
    let same = prev.size === next.size
    for (const [k, v] of next as Map<unknown, unknown>) {
      const reused = reuseEqual(prev.get(k), v)
      out.set(k, reused)
      same &&= prev.has(k) && reused === prev.get(k)
    }
    return (same ? prev : out) as T
  }
  if (prev instanceof Set && next instanceof Set) {
    return (prev.size === next.size && [...(next as Set<unknown>)].every(v => prev.has(v)) ? prev : next) as T
  }
  if (isPlain(prev) && isPlain(next)) {
    const keys = Object.keys(next)
    const out: Record<string, unknown> = {}
    let same = keys.length === Object.keys(prev).length
    for (const k of keys) {
      out[k] = reuseEqual(prev[k], next[k])
      same &&= k in prev && out[k] === prev[k]
    }
    return (same ? prev : out) as T
  }
  return next
}

const update = (e: Entry, patch: Partial<Snapshot>) => {
  e.snapshot = {...e.snapshot, ...patch}
  for (const listener of [...e.listeners]) {
    listener()
  }
}

const start = (e: Entry) => {
  const controller = new AbortController()
  e.inFlight = controller
  e.queued = false
  update(e, {loading: true})
  const run = async () => {
    let patch: Partial<Snapshot>
    try {
      const data = (await e.load(controller.signal)) ?? null
      if (e.inFlight !== controller) return
      e.loadedAt = Date.now()
      e.failedAt = 0
      e.stale = false
      patch = {
        data: reuseEqual(e.snapshot.data, data),
        error: undefined,
        loadCount: e.snapshot.loadCount + 1,
        loaded: true,
      }
    } catch (error) {
      if (e.inFlight !== controller) return
      if (isCancelled(error, 'disconnect')) {
        // Nothing failed. It stays loading, and the handshake after the reconnect loads it again.
        e.inFlight = undefined
        update(e, {})
        return
      }
      if (isCancelled(error)) {
        patch = {loaded: true}
      } else {
        e.failedAt = Date.now()
        patch = {error: ensureError(error), loaded: true}
      }
    }
    e.inFlight = undefined
    update(e, {...patch, loading: e.queued})
    if (e.queued) {
      start(e)
    }
  }
  void run()
}

const stop = (e: Entry) => {
  const controller = e.inFlight
  // cleared first, so the cancelled call's rejection is not taken for a result
  e.inFlight = undefined
  e.queued = false
  controller?.abort()
}

const forget = (e: Entry) => {
  stop(e)
  e.loadedAt = 0
  e.failedAt = 0
  e.stale = false
  e.selected = new WeakMap()
  update(e, empty)
}

/** drop what is cached under this key: its data is gone, not merely stale */
export const forgetKey = (key: string) => {
  const e = entries.get(key)
  if (e) {
    forget(e)
  }
}

const sweepIdle = () => {
  const now = Date.now()
  for (const [key, e] of entries) {
    if (!e.listeners.size && now - e.idleSince > idleEntryMs) {
      entries.delete(key)
    }
  }
}

export const getEntry = (key: string, method: string, load: Entry['load']): Entry => {
  const existing = entries.get(key)
  if (existing) {
    return existing
  }
  sweepIdle()
  const e: Entry = {
    ensure: () => {
      if (!e.inFlight) {
        start(e)
      }
    },
    failedAt: 0,
    getSnapshot: () => e.snapshot,
    idleSince: Date.now(),
    listeners: new Set(),
    load,
    loadedAt: 0,
    loaders: 0,
    method,
    queued: false,
    reload: () => {
      stop(e)
      start(e)
    },
    reloadAndWait: async () => {
      e.reload()
      await settled(e)
    },
    selected: new WeakMap(),
    snapshot: empty,
    stale: false,
    subscribe: listener => {
      e.listeners.add(listener)
      return () => {
        e.listeners.delete(listener)
        e.idleSince = Date.now()
      }
    },
  }
  entries.set(key, e)
  return e
}

// resolves once no load is on the wire
const settled = async (e: Entry) => {
  if (e.inFlight) {
    await new Promise<void>(resolve => {
      const unsubscribe = e.subscribe(() => {
        if (!e.inFlight) {
          unsubscribe()
          resolve()
        }
      })
    })
  }
}

const isStale = (e: Entry, staleMs: number) => !e.loadedAt || e.stale || Date.now() - e.loadedAt >= staleMs

/**
 * If something is loading it (a mounted screen), load it when it is older than staleMs.
 * Resolves once no load is on the wire, whether or not it started one.
 */
export const loadIfStale = async (e: Entry, staleMs: number) => {
  if (e.loaders && !e.inFlight && isStale(e, staleMs)) {
    start(e)
  }
  await settled(e)
}

/**
 * A mounted hook that loads the entry: loads it now if it is stale, and from then on the entry
 * reloads on change notices and reconnects. The last one to leave cancels the load in flight.
 */
export const attachLoader = (e: Entry, staleMs: number, keep = true) => {
  e.loaders += 1
  if (!e.inFlight && isStale(e, staleMs) && Date.now() - e.failedAt >= failureBackoffMs) {
    start(e)
  }
  return () => {
    e.loaders -= 1
    if (!e.loaders) {
      stop(e)
      if (!keep) {
        forget(e)
      } else if (e.snapshot.loading) {
        update(e, {loading: false})
      }
    }
  }
}

/**
 * The service says what this method returns has changed. A load on the wire may carry the old
 * answer, so it finishes and one more follows it: a burst of notices costs at most two loads.
 * Entries no screen is loading reload when one next mounts. `key` narrows it to one entry.
 */
export const refreshMethod = (method: string, key?: string) => {
  for (const [entryKey, e] of entries) {
    if (e.method !== method || (key !== undefined && key !== entryKey)) continue
    e.stale = true
    if (!e.loaders) continue
    if (e.inFlight) {
      e.queued = true
    } else {
      start(e)
    }
  }
}

/** a loading screen's load replaces the one before it: they are equivalent, and this one's closure is current */
export const setLoad = (e: Entry, load: Entry['load']) => {
  e.load = load
}

/** overwrite what is cached, for an optimistic update; the next load's answer wins */
export const setEntryData = (e: Entry, next: (prev: unknown) => unknown) => {
  update(e, {data: next(e.snapshot.data)})
}

/** select(data), computed once per data and keeping the identity of whatever did not change */
export const selectFrom = <D,>(e: Entry, select: (data: never) => D, data: unknown): D => {
  const last = e.selected.get(select)
  if (last && last.input === data) {
    return last.output as D
  }
  const output = reuseEqual(last?.output, (select as (d: unknown) => D)(data))
  e.selected.set(select, {input: data, output})
  return output
}

// The cache belongs to one account. Everything is cancelled and emptied the moment the account's
// generation changes, so no screen that stays mounted shows the last account's data.
const emptyCache = () => {
  for (const [key, e] of entries) {
    forget(e)
    if (!e.listeners.size) {
      entries.delete(key)
    }
  }
}
onNewAccountGeneration(emptyCache)
// the store reset that a logout, an account switch and each test's cleanup all run
registerExternalResetter('rpc-data-cache', emptyCache)

const loadWhere = (needs: (e: Entry) => boolean) => {
  for (const e of entries.values()) {
    if (e.loaders && !e.inFlight && needs(e)) {
      start(e)
    }
  }
}

// Screens still mounted when the next account is in load for it
const accountReady = () => {
  const {loggedIn, userSwitching} = useConfigState.getState()
  return loggedIn && !userSwitching
}
let wasAccountReady = accountReady()
useConfigState.subscribe(() => {
  const ready = accountReady()
  if (ready && !wasAccountReady) {
    loadWhere(e => !e.snapshot.loaded)
  }
  wasAccountReady = ready
})

// A lost link fails the rpcs in flight on it, and what the service knows may have changed while it
// was away: the handshake that follows a reconnect reloads everything a screen is showing.
let lastHandshake = useDaemonState.getState().handshakeState
useDaemonState.subscribe(s => {
  const reconnected = s.handshakeState === 'done' && lastHandshake !== 'done'
  lastHandshake = s.handshakeState
  if (reconnected) {
    loadWhere(() => true)
  }
})
