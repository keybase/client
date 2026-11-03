// The visual gate's fixtures, inside the dev app. The app entries import this module
// (app/index.native.tsx, desktop/renderer/main2.desktop.tsx; production builds resolve the import to
// an empty module, vite.config.mts and metro.config.js). __kbVisualRpc is set only while a fixture
// is active, and the engine hands every outgoing RPC and incoming call to it then; idle, the engine
// reads one undefined global. The drivers run a fixture through __kbVisualFixtures:
//   begin(name, args)  snapshots the fixture's stores, installs its rules, runs its beforeNav
//   served()           whether every rule it marks required has answered
//   afterReady()       its afterReady store sets and injected notifications
//   end()              puts the stores back, drops the rules, and reports what leaked
//   active()           whether a fixture is installed
// While a fixture is active, an RPC whose name says it writes (post, set, send, delete, create, add,
// remove, mark) and that no rule answers is refused rather than sent, apart from the few local UI
// writes navigation makes (localWrites), and the writes leaving a screen makes (focusWrites), which
// are answered here.
// The electron e2e flows record what each test exercised through __kbE2ERecorder: start() before a
// test, take() after it, for the RPC methods the app sent and the routes it focused. While it
// records and no fixture is active, __kbVisualRpc is a hook that only notes each outgoing method and
// changes nothing: invoke returns false, so the engine sends the call itself, and incoming hands back
// the payload it was given.
import {FIXTURE_RUNTIME_VERSION, FIXTURES, isFixtureName, type FixtureName} from './names.ts'
import type {FixtureContext, FixtureDef, RpcRule, StartedBy, StoreApi, StoreKey, Stores} from './def.ts'
import {chatThreadContent} from './chat-thread.ts'
import {globalError, runtimeStats} from './debug.ts'
import {deviceLastUsed} from './devices.ts'
import {featuredBots} from './bots.ts'
import {peopleFollowSuggestions} from './people.ts'
import {teamBuilderRecs} from './team-building.ts'

export const definitions: Readonly<Record<FixtureName, FixtureDef>> = {
  'chat-thread-content': chatThreadContent,
  'device-last-used': deviceLastUsed,
  'featured-bots': featuredBots,
  'global-error': globalError,
  'people-follow-suggestions': peopleFollowSuggestions,
  'runtime-stats': runtimeStats,
  'team-builder-recs': teamBuilderRecs,
}

type Response = {cancelled?: boolean; result?: (...args: Array<unknown>) => void}
export type IncomingPayload = {method: string; param: Array<{sessionID?: number}>; response?: Response}
export type OutgoingCall = {
  method: string
  param: unknown
  // answers the session's start callback
  reply: (err: unknown, result?: unknown) => void
  // sends the call to the service; `done` gets its answer
  real: (done: (err: unknown, result: unknown) => void) => void
  // an incoming call into this call's session
  deliver: (method: string, param: object) => void
}
export type VisualRpc = {
  // true when the fixture answered (or refused) the call, so the engine must not send it
  invoke: (call: OutgoingCall) => boolean
  // the payload to handle, rewritten or not, or undefined to drop it
  incoming: (payload: IncomingPayload, how: {customResponse: boolean; inSession: boolean}) => IncomingPayload | undefined
}
export type LeakReport = {
  refusedWrites: Array<string>
  cancelledReplies: Array<string>
  storesNotRestored: Array<string>
  // follow-ups that could not be built or delivered, with why
  failedFollowUps: Array<string>
  // rewrites that threw (a precondition of the fixture missing from the live data), with why:
  // the call went on unchanged
  failedTransforms: Array<string>
}
export type EndReport = LeakReport & {teardown: FixtureDef['teardown']}
export type VisualFixtures = {
  version: number
  begin: (name: string, args: Record<string, unknown>) => void
  served: () => boolean
  afterReady: () => void
  end: () => EndReport
  active: () => boolean
}

declare global {
  var __kbVisualRpc: VisualRpc | undefined
  var __kbVisualFixtures: VisualFixtures | undefined
  var __kbE2ERecorder: E2ERecorder | undefined
}

export type E2ERecorder = {
  // starts a recording, dropping any earlier one
  start: () => void
  // what was recorded since start(), each name once in the order first seen; ends the recording.
  // startRoutes is the focused chain shown at start; routes holds the chains of the states after it
  // that differed from the one before, so a screen left on from before start() is in routes only
  // when the app showed it again in a later state.
  take: () => {rpcs: Array<string>; routes: Array<string>; startRoutes: Array<string>}
}

// What the route recorder needs of the app's navigation container (router-v2/router.tsx sets it on
// window.DEBUGNavigator in a dev app).
export type NavLike = {
  addListener: (event: 'state', cb: (e: {data?: {state?: unknown}}) => void) => () => void
  getRootState: () => unknown
}

// The focused route of each navigator down the tree. A tab navigator's state lists every tab, shown
// or not, and a stack keeps the screens under its top one, so only the focused chain is what the
// state shows; a screen under the top was the focused one in an earlier state.
const collectRouteNames = (state: unknown, into: Set<string>) => {
  const s = state as {index?: unknown; routes?: unknown} | null | undefined
  if (!Array.isArray(s?.routes)) return
  const routes = s.routes as Array<{name?: unknown; state?: unknown} | null | undefined>
  const r = routes[typeof s.index === 'number' ? s.index : routes.length - 1]
  if (typeof r?.name === 'string') into.add(r.name)
  collectRouteNames(r?.state, into)
}

// The names along a navigation state's focused route chain, outermost first, each once.
export const routeNames = (state: unknown) => {
  const names = new Set<string>()
  collectRouteNames(state, names)
  return [...names]
}

// Records the focused route names of every navigation state between start() and take(): each
// 'state' event, and the state shown at start, at take and on every poll in between (a nested
// navigator setting up its first state is not always told as an event). The state shown at start
// goes in startRoutes; a later state goes in routes only when its focused chain differs from the
// last one read, so polls of an unchanged screen add nothing. The navigator can be missing for a
// moment at startup and is replaced when the router remounts, so each poll also re-reads it and
// moves the listener.
export const createRouteRecorder = (deps: {
  navigator: () => NavLike | undefined
  every: (ms: number, f: () => void) => () => void
}) => {
  let names: Set<string> | undefined
  let startRoutes: Array<string> = []
  let starting = false
  let lastChain: string | undefined
  let nav: NavLike | undefined
  let unsubscribe: (() => void) | undefined
  let stopPolling: (() => void) | undefined

  // a container that is not ready yet can throw: its routes come with a later look
  const record = (state: () => unknown) => {
    if (!names) return
    const chain = new Set<string>()
    try {
      collectRouteNames(state(), chain)
    } catch {
      return
    }
    const key = [...chain].join('\n')
    if (key === lastChain) return
    lastChain = key
    if (starting) startRoutes = [...chain]
    else for (const n of chain) names.add(n)
  }
  const look = () => {
    const next = deps.navigator()
    if (next !== nav) {
      unsubscribe?.()
      unsubscribe = next?.addListener('state', e => record(() => e.data?.state ?? next.getRootState()))
      nav = next
    }
    if (next) record(() => next.getRootState())
  }
  const stop = () => {
    stopPolling?.()
    stopPolling = undefined
    unsubscribe?.()
    unsubscribe = undefined
    nav = undefined
  }
  return {
    start: () => {
      stop()
      names = new Set()
      startRoutes = []
      lastChain = undefined
      starting = true
      look()
      starting = false
      stopPolling = deps.every(250, look)
    },
    take: () => {
      if (names) look()
      const out = {routes: [...(names ?? [])], startRoutes}
      stop()
      names = undefined
      startRoutes = []
      return out
    },
  }
}

const writeWords = new Set(['post', 'set', 'send', 'delete', 'create', 'add', 'remove', 'mark'])

// Writes the app makes on its own whenever it navigates, live entries included, that touch only
// this device's UI state: they pass to the service while a fixture is active.
const localWrites: ReadonlyArray<{method: string; allows: (param: unknown) => boolean}> = [
  // the phone saves its current route to restore at the next launch (util/storeless-actions.tsx)
  {allows: p => (p as {path?: string} | undefined)?.path === 'ui.routeState2', method: 'keybase.1.config.guiSetValue'},
]
export const isLocalWrite = (method: string, param: unknown) => localWrites.some(w => w.method === method && w.allows(param))

// Writes the app makes on its own when a screen loses focus, which an iOS fixture capture's hop to
// another tab and back causes: answered here, empty, and never sent to the service.
//   homeMarkViewed  the people screen, on blur (people/container.tsx)
export const focusWrites: ReadonlySet<string> = new Set(['keybase.1.home.homeMarkViewed'])

// Whether a method's name says it writes: a write verb as one of the camel-case words of its last
// part (teamAddMember, simpleFSRemove; getSettings is a read).
export const isWriteMethod = (method: string) =>
  (method.split('.').at(-1) ?? '')
    .split(/(?=[A-Z])/)
    .some(w => writeWords.has(w.toLowerCase()))

// Where the stores a fixture declares live. Both registries are dev-only globals.
const devStores = (): Stores => ({
  get: (key: StoreKey) => {
    const g = globalThis as unknown as {__hmr_TBstores?: Map<string, StoreApi>; __ZUSTAND_HMR__?: Map<string, StoreApi>}
    const [kind, name] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    return (kind === 'tb' ? g.__hmr_TBstores : g.__ZUSTAND_HMR__)?.get(name)
  },
})

// For a store the fixture saw created, `end` removes it again; only the team builder's are made on
// demand.
const forget = (key: StoreKey) => {
  if (key.startsWith('tb:')) (globalThis as unknown as {__hmr_TBstores?: Map<string, unknown>}).__hmr_TBstores?.delete(key.slice(3))
}

type Active = {
  name: FixtureName
  def: FixtureDef
  ctx: () => FixtureContext
  snapshots: Map<StoreKey, {existed: false} | {existed: true; state: unknown}>
  answered: Set<RpcRule>
  pending: Map<ReturnType<typeof setTimeout>, {method: string; reply: OutgoingCall['reply']}>
  refused: Array<string>
  injecting: boolean
  followTimers: Set<ReturnType<typeof setTimeout>>
  failedFollowUps: Array<string>
  failedTransforms: Array<string>
  // the app's calls by the session they opened, so an incoming rewrite knows what it answers
  sessions: Map<number, StartedBy>
}

export const createRuntime = (deps: {
  stores: Stores
  forget: (key: StoreKey) => void
  // sets the engine's hook (__kbVisualRpc): rpc while a fixture is active, undefined otherwise
  install: (rpc: VisualRpc | undefined) => void
  inject: (payload: IncomingPayload) => void
  now: () => number
}) => {
  let cur: Active | undefined
  // the methods sent while recording
  let recorded: Set<string> | undefined
  const sync = () => deps.install(cur || recorded ? rpc : undefined)

  type Payload = {method: string; param: object}
  const build = (a: Active, defs: ReadonlyArray<{method: string; param: (ctx: FixtureContext) => object}>): Array<Payload> => {
    const ctx = a.ctx()
    return defs.map(d => ({method: d.method, param: d.param(ctx)}))
  }
  const deliver = (a: Active, payloads: ReadonlyArray<Payload>) => {
    a.injecting = true
    try {
      for (const p of payloads) deps.inject({method: p.method, param: [p.param]})
    } finally {
      a.injecting = false
    }
  }

  // The def's follow-ups of an incoming call, delivered on the next tick. Their payloads are built
  // now, in the incoming call: an error building or delivering them goes into end()'s report, never
  // out of the engine's handler or a timer.
  const followUp = (a: Active, method: string) => {
    const due = (a.def.follow ?? []).filter(f => f.after === method)
    if (!due.length) return
    const failed = (e: unknown) => a.failedFollowUps.push(`after ${method}: ${e instanceof Error ? e.message : String(e)}`)
    let payloads: Array<Payload>
    try {
      payloads = build(a, due)
    } catch (e) {
      failed(e)
      return
    }
    const timer = setTimeout(() => {
      a.followTimers.delete(timer)
      if (cur !== a) return
      try {
        deliver(a, payloads)
      } catch (e) {
        failed(e)
      }
    }, 0)
    a.followTimers.add(timer)
  }

  // A rule's rewrite of live data, or undefined when it threw: that is reported by end(), never
  // thrown into the engine, and the caller passes the data on as it was.
  const rewrite = <T,>(a: Active, method: string, f: () => T): {value: T} | undefined => {
    try {
      return {value: f()}
    } catch (e) {
      a.failedTransforms.push(`${method}: ${e instanceof Error ? e.message : String(e)}`)
      return undefined
    }
  }

  const rpc: VisualRpc = {
    incoming: (payload, how) => {
      const a = cur
      if (!a || payload.response?.cancelled || how.customResponse || a.injecting) return payload
      followUp(a, payload.method)
      const t = a.def.incoming?.find(r => r.method === payload.method)
      if (t) {
        const [first, ...rest] = payload.param
        const sessionID = first?.sessionID
        const startedBy = typeof sessionID === 'number' ? a.sessions.get(sessionID) : undefined
        const r = rewrite(a, payload.method, () => t.transform(first ?? {}, a.ctx(), startedBy))
        if (!r) return payload
        return {...payload, param: [{...r.value, sessionID: first?.sessionID}, ...rest]}
      }
      if (a.def.hold && !how.inSession) {
        // answered as the engine would answer a notification, then dropped
        payload.response?.result?.()
        return undefined
      }
      return payload
    },
    invoke: call => {
      recorded?.add(call.method)
      const a = cur
      if (!a) return false
      const sessionID = (call.param as {sessionID?: unknown} | undefined)?.sessionID
      if (typeof sessionID === 'number') a.sessions.set(sessionID, {method: call.method, param: call.param})
      const rule = a.def.rpc.find(r => r.method === call.method)
      if (!rule && focusWrites.has(call.method)) {
        const timer = setTimeout(() => {
          a.pending.delete(timer)
          call.reply(undefined, undefined)
        }, 0)
        a.pending.set(timer, {method: call.method, reply: call.reply})
        return true
      }
      if (!rule) {
        if (!isWriteMethod(call.method) || isLocalWrite(call.method, call.param)) return false
        a.refused.push(call.method)
        call.reply(new Error(`visual fixture ${a.name} refused ${call.method}: it writes, and no rule answers it`))
        return true
      }
      if ('stub' in rule) {
        const result = rule.stub(call.param, a.ctx(), call.deliver)
        const timer = setTimeout(() => {
          a.pending.delete(timer)
          a.answered.add(rule)
          call.reply(undefined, result)
        }, 0)
        a.pending.set(timer, {method: call.method, reply: call.reply})
        return true
      }
      call.real((err, result) => {
        // a fixture that ended while the call was out lets the live answer through
        if (cur !== a || err) {
          call.reply(err, result)
          return
        }
        a.answered.add(rule)
        const r = rewrite(a, call.method, () => rule.transform(result, call.param, a.ctx()))
        call.reply(undefined, r ? r.value : result)
      })
      return true
    },
  }

  const fixtures: VisualFixtures = {
    active: () => !!cur,
    afterReady: () => {
      const a = cur
      if (!a) throw new Error('afterReady with no fixture active')
      a.def.afterReady?.(deps.stores, a.ctx())
      deliver(a, build(a, a.def.inject ?? []))
    },
    begin: (name, args) => {
      if (cur) throw new Error(`fixture ${cur.name} is still active`)
      if (!isFixtureName(name)) throw new Error(`unknown fixture ${name}; known: ${Object.keys(FIXTURES).join(', ')}`)
      const def = definitions[name]
      const snapshots: Active['snapshots'] = new Map()
      for (const key of def.stores ?? []) {
        const s = deps.stores.get(key)
        snapshots.set(key, s ? {existed: true, state: s.getState()} : {existed: false})
      }
      const frozenArgs = Object.freeze({...args})
      cur = {
        answered: new Set(),
        ctx: () => ({args: frozenArgs, now: deps.now()}),
        def,
        failedFollowUps: [],
        failedTransforms: [],
        followTimers: new Set(),
        injecting: false,
        name,
        pending: new Map(),
        refused: [],
        sessions: new Map(),
        snapshots,
      }
      sync()
      def.beforeNav?.(deps.stores, cur.ctx())
    },
    end: () => {
      const a = cur
      if (!a) throw new Error('end with no fixture active')
      cur = undefined
      sync()
      for (const timer of a.followTimers) clearTimeout(timer)
      const cancelledReplies: Array<string> = []
      for (const [timer, p] of a.pending) {
        clearTimeout(timer)
        cancelledReplies.push(p.method)
        p.reply(new Error(`visual fixture ${a.name} ended before answering ${p.method}`))
      }
      const storesNotRestored: Array<string> = []
      for (const [key, snap] of a.snapshots) {
        if (snap.existed) deps.stores.get(key)?.setState(snap.state, true)
        else deps.forget(key)
        const now = deps.stores.get(key)
        if (snap.existed ? now?.getState() !== snap.state : now) storesNotRestored.push(key)
      }
      return {
        cancelledReplies,
        failedFollowUps: a.failedFollowUps,
        failedTransforms: a.failedTransforms,
        refusedWrites: a.refused,
        storesNotRestored,
        teardown: a.def.teardown,
      }
    },
    served: () => !!cur && cur.def.rpc.every(r => !r.required || cur?.answered.has(r)),
    version: FIXTURE_RUNTIME_VERSION,
  }
  const recording = {
    start: () => {
      recorded = new Set()
      sync()
    },
    take: () => {
      const out = [...(recorded ?? [])]
      recorded = undefined
      sync()
      return out
    },
  }
  return {fixtures, recording, rpc}
}

if (__DEV__) {
  const {fixtures, recording} = createRuntime({
    forget,
    inject: payload => (globalThis.DEBUGEngine as {_rpcIncoming: (p: IncomingPayload) => void})._rpcIncoming(payload),
    install: rpc => {
      globalThis.__kbVisualRpc = rpc
    },
    now: () => Date.now(),
    stores: devStores(),
  })
  globalThis.__kbVisualFixtures = fixtures
  const routes = createRouteRecorder({
    every: (ms, f) => {
      const id = setInterval(f, ms)
      return () => clearInterval(id)
    },
    navigator: () => (globalThis as {DEBUGNavigator?: NavLike}).DEBUGNavigator,
  })
  globalThis.__kbE2ERecorder = {
    start: () => {
      recording.start()
      routes.start()
    },
    take: () => ({...routes.take(), rpcs: recording.take()}),
  }
}
