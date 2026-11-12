// One cache for what read rpcs return, keyed by method and params and shared by every screen.
// Screens use it through useRpcData; this file holds the entries and the rules they all follow:
// who starts a load, what a change notice costs, and what a lost link or an account change does.
import {onNewAccountGeneration} from '@/engine/account-generation'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {ensureError, isCancelled} from '@/util/errors'
import {uint8ArrayToHex} from '@/util/uint8array'
import {registerExternalResetter} from '@/util/zustand'

type Snapshot = {
  /** undefined until a load lands */
  readonly data: unknown
  readonly error: Error | undefined
  /** dropped on purpose (forgetKey): nothing will load it until it is asked for again */
  readonly forgotten: boolean
  /** successful loads so far; never goes back, so it tells one load's data from the next */
  readonly loadCount: number
  /** a load has succeeded: data is the service's answer */
  readonly loaded: boolean
  readonly loading: boolean
  /** a load finished, with data or an error */
  readonly settled: boolean
}

export type Entry = {
  readonly method: string
  // The load and error handler of the latest loading screen. Every screen's are equivalent, by the
  // key, and the latest one's closure is the current one.
  load: (signal: AbortSignal) => Promise<unknown>
  onError?: (error: Error) => void
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => Snapshot
  readonly getData: () => unknown
  /** load now; a load on the wire may predate what the caller knows, so its answer is dropped */
  readonly reload: () => void
  /** reload, resolving once it is over: answered, failed, or cut off by a lost link */
  readonly reloadAndWait: () => Promise<void>
  snapshot: Snapshot
  listeners: Set<() => void>
  // mounted hooks that load it; a reader only listens
  loaders: number
  inFlight?: AbortController
  // what `stale` was when the load in flight started: it comes back if that load never lands
  inFlightWasStale: boolean
  // a change notice came during the load in flight, whose answer may predate the change
  queued: boolean
  stale: boolean
  loadedAt: number
  failedAt: number
  idleSince: number
  // the last change notice counted for it, and when
  lastNotice: number
  lastNoticeAt: number
  noticeTimer?: ReturnType<typeof setTimeout>
  retryTimer?: ReturnType<typeof setTimeout>
  selected: WeakMap<object, {input: unknown; output: unknown}>
}

const empty: Snapshot = {
  data: undefined,
  error: undefined,
  forgotten: false,
  loadCount: 0,
  loaded: false,
  loading: false,
  settled: false,
}
// A mount does not retry a load that just failed: screens mounting one after another would
// otherwise each reissue it. reload() and a change notice still load at once.
const failureBackoffMs = 5_000
const idleEntryMs = 5 * 60_000
// Entries are never removed, only emptied: a screen can hold one it is not subscribed to (between
// its render and its effects, or while hidden), and must find the same one when it comes back.
const entries = new Map<string, Entry>()

/** the same params give the same key whatever order their fields are written in */
export const stableKey = (method: string, params: unknown) =>
  `${method} ${JSON.stringify(params ?? null, (_k, value: unknown) => {
    if (value instanceof Uint8Array) {
      return `bytes:${uint8ArrayToHex(value)}`
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
  clearTimeout(e.retryTimer)
  e.retryTimer = undefined
  e.inFlight = controller
  e.queued = false
  // cleared now, not when the answer lands: a notice that arrives meanwhile is about that answer
  e.inFlightWasStale = e.stale
  e.stale = false
  update(e, {forgotten: false, loading: true})
  const run = async () => {
    let patch: Partial<Snapshot>
    let failure: Error | undefined
    try {
      const data = (await e.load(controller.signal)) ?? null
      if (e.inFlight !== controller) return
      e.loadedAt = Date.now()
      e.failedAt = 0
      if (!e.listeners.size) {
        // it landed after the last screen left
        e.idleSince = e.loadedAt
        scheduleSweep()
      }
      patch = {
        data: reuseEqual(e.snapshot.data, data),
        error: undefined,
        loadCount: e.snapshot.loadCount + 1,
        loaded: true,
        settled: true,
      }
    } catch (caught) {
      if (e.inFlight !== controller) return
      e.stale ||= e.inFlightWasStale
      if (isCancelled(caught, 'disconnect')) {
        // Nothing failed. While a screen wants it, it stays loading, and the handshake after the
        // reconnect loads it again, which covers a queued load too.
        e.inFlight = undefined
        e.queued = false
        update(e, {loading: e.loaders > 0})
        return
      }
      if (isCancelled(caught)) {
        patch = {settled: true}
      } else {
        failure = ensureError(caught)
        e.failedAt = Date.now()
        patch = {error: failure, settled: true}
      }
    }
    e.inFlight = undefined
    update(e, {...patch, loading: e.queued})
    if (e.queued) {
      start(e)
    }
    // last: whatever the handler does, the entry is already settled
    if (failure) {
      e.onError?.(failure)
    }
  }
  void run()
}

const stop = (e: Entry) => {
  const controller = e.inFlight
  if (controller) {
    // it never landed, so what it was loading for still stands
    e.stale ||= e.inFlightWasStale
  }
  // cleared first, so the cancelled call's rejection is not taken for a result
  e.inFlight = undefined
  e.queued = false
  controller?.abort()
}

const noLoader = async () => Promise.reject(new Error('rpc data: no screen is loading this'))

// Back to not loaded. loadCount is kept, so a screen that stays mounted can tell the next load's
// data from what it had.
const clear = (e: Entry, forgotten = false) => {
  stop(e)
  clearTimeout(e.noticeTimer)
  e.noticeTimer = undefined
  clearTimeout(e.retryTimer)
  e.retryTimer = undefined
  if (!e.loaders) {
    // an emptied entry lives on (see entries), but must not keep an unmounted screen's closures
    e.load = noLoader
    e.onError = undefined
  }
  e.loadedAt = 0
  e.failedAt = 0
  e.lastNoticeAt = 0
  e.stale = false
  e.selected = new WeakMap()
  update(e, {...empty, forgotten, loadCount: e.snapshot.loadCount})
}

/**
 * Drop what is cached under this key: its data is gone, not merely stale. Notices and stale checks
 * leave it alone; it loads again when a screen mounts for it or reloads it.
 */
export const forgetKey = (key: string) => {
  const e = entries.get(key)
  if (e) {
    clear(e, true)
  }
}

// Data nothing has looked at for idleEntryMs is dropped, so the cache does not grow for the whole
// session. One timer for all of it, armed when something goes idle and again while any remains.
let sweepTimer: ReturnType<typeof setTimeout> | undefined
const sweepIdle = () => {
  sweepTimer = undefined
  const now = Date.now()
  let remaining = false
  for (const e of entries.values()) {
    if (e.listeners.size || !e.loadedAt) continue
    if (!e.inFlight && now - e.idleSince >= idleEntryMs) {
      clear(e)
    } else {
      remaining = true
    }
  }
  if (remaining) {
    scheduleSweep()
  }
}
const scheduleSweep = () => {
  sweepTimer ??= setTimeout(sweepIdle, idleEntryMs)
}

// resolves once no load is on the wire, nor one queued behind it
const settled = async (e: Entry) => {
  if (e.inFlight) {
    await new Promise<void>(resolve => {
      const unsubscribe = e.subscribe(() => {
        if (!e.inFlight && !e.queued) {
          unsubscribe()
          resolve()
        }
      })
    })
  }
}

export const getEntry = (key: string, method: string, load: Entry['load']): Entry => {
  const existing = entries.get(key)
  if (existing) {
    return existing
  }
  const e: Entry = {
    failedAt: 0,
    getData: () => e.snapshot.data,
    getSnapshot: () => e.snapshot,
    idleSince: Date.now(),
    inFlightWasStale: false,
    lastNotice: 0,
    lastNoticeAt: 0,
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
        if (!e.listeners.size) {
          scheduleSweep()
        }
      }
    },
  }
  entries.set(key, e)
  return e
}

const isStale = (e: Entry, staleMs: number) => !e.loadedAt || e.stale || Date.now() - e.loadedAt >= staleMs
// what a load nobody asked for by hand waits for after a failure
const backoffLeft = (e: Entry) => e.failedAt + failureBackoffMs - Date.now()

/**
 * If something is loading it (a mounted screen), load it when it is older than staleMs, unless it
 * just failed or was forgotten. Resolves once no load is on the wire, whether or not it started one.
 */
export const loadIfStale = async (e: Entry, staleMs: number) => {
  if (e.loaders && !e.inFlight && !e.snapshot.forgotten && isStale(e, staleMs) && backoffLeft(e) <= 0) {
    start(e)
  }
  await settled(e)
}

/** what a loading screen loads with, and where a failed load is reported, once per load */
export const setLoader = (e: Entry, load: Entry['load'], onError: Entry['onError']) => {
  e.load = load
  e.onError = onError
}

/**
 * A mounted hook that loads the entry: loads it now if it is stale, and from then on the entry
 * reloads on change notices and reconnects. A load still on the wire when the last one leaves
 * finishes and is cached: the service does the work either way, and the next screen would only
 * ask again. Data that is not kept is dropped instead.
 */
export const attachLoader = (e: Entry, staleMs: number, keep: boolean) => {
  e.loaders += 1
  if (!e.inFlight && isStale(e, staleMs)) {
    if (backoffLeft(e) <= 0) {
      start(e)
    } else {
      // not now, but a screen that stays up must not be left with the failure
      e.retryTimer ??= setTimeout(() => {
        e.retryTimer = undefined
        if (e.loaders && !e.inFlight) {
          start(e)
        }
      }, backoffLeft(e))
    }
  }
  return () => {
    e.loaders -= 1
    if (e.loaders) {
      return
    }
    clearTimeout(e.retryTimer)
    e.retryTimer = undefined
    if (!keep) {
      clear(e)
    } else if (!e.inFlight && e.snapshot.loading) {
      // it was waiting for a reconnect, which only reloads what a screen wants
      update(e, {loading: false})
    }
  }
}

// Every listener for one notice from the service runs in the same turn, and each may refresh the
// same entry: they count as the one notice they are, for the load, the stale flag and the debounce.
let noticeNumber = 0
let noticeOpen = false
const currentNotice = () => {
  if (!noticeOpen) {
    noticeOpen = true
    noticeNumber += 1
    queueMicrotask(() => {
      noticeOpen = false
    })
  }
  return noticeNumber
}

const refreshEntry = (e: Entry) => {
  if (!e.loaders) {
    return
  }
  if (e.inFlight) {
    e.queued = true
  } else {
    start(e)
  }
}

/**
 * The service says what this method returns has changed. A load on the wire may carry the old
 * answer, so it finishes and one more follows it: a burst of notices costs at most two loads.
 * Entries no screen is loading reload when one next mounts. `key` narrows it to one entry.
 * debounceMs is for notices that keep coming (one per message in a busy team): the first reloads
 * at once, and the rest reload once, debounceMs after the last of them.
 */
export const refreshMethod = (method: string, key?: string, debounceMs = 0) => {
  const notice = currentNotice()
  const now = Date.now()
  for (const [entryKey, e] of entries) {
    if (e.method !== method || (key !== undefined && key !== entryKey)) continue
    if (e.lastNotice === notice || e.snapshot.forgotten) continue
    e.lastNotice = notice
    e.stale = true
    const quiet = !e.noticeTimer && now - e.lastNoticeAt >= debounceMs
    e.lastNoticeAt = now
    if (!debounceMs || quiet) {
      refreshEntry(e)
      continue
    }
    clearTimeout(e.noticeTimer)
    e.noticeTimer = setTimeout(() => {
      e.noticeTimer = undefined
      refreshEntry(e)
    }, debounceMs)
  }
}

/**
 * Overwrite what is cached, for an optimistic update. A load on the wire predates the write, so
 * it is dropped and nothing replaces it: the writer refreshes once its write has settled, and
 * that load's answer wins.
 */
export const setEntryData = (e: Entry, next: (prev: unknown) => unknown) => {
  if (e.inFlight) {
    stop(e)
    e.stale = true
  }
  update(e, {data: next(e.snapshot.data), loading: false, settled: true})
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
  for (const e of entries.values()) {
    clear(e)
  }
  // nothing is left to drop
  clearTimeout(sweepTimer)
  sweepTimer = undefined
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

// Screens still mounted when the next account is in load for it, including what failed while
// there was no account
const accountReady = () => {
  const {loggedIn, userSwitching} = useConfigState.getState()
  return loggedIn && !userSwitching
}
let wasAccountReady = accountReady()
useConfigState.subscribe(() => {
  const ready = accountReady()
  if (ready && !wasAccountReady) {
    loadWhere(e => !e.snapshot.loaded && !e.snapshot.forgotten)
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
    loadWhere(e => !e.snapshot.forgotten)
  }
})
