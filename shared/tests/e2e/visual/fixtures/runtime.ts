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
// writes navigation makes (localWrites).
import {FIXTURE_RUNTIME_VERSION, FIXTURES, isFixtureName, type FixtureName} from './names.ts'
import type {FixtureContext, FixtureDef, RpcRule, StoreApi, StoreKey, Stores} from './def.ts'
import {chatThreadContent} from './chat-thread.ts'
import {deviceLastUsed} from './devices.ts'
import {featuredBots} from './bots.ts'
import {peopleFollowSuggestions} from './people.ts'
import {teamBuilderRecs} from './team-building.ts'

export const definitions: Readonly<Record<FixtureName, FixtureDef>> = {
  'chat-thread-content': chatThreadContent,
  'device-last-used': deviceLastUsed,
  'featured-bots': featuredBots,
  'people-follow-suggestions': peopleFollowSuggestions,
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
}

const writeWords = new Set(['post', 'set', 'send', 'delete', 'create', 'add', 'remove', 'mark'])

// Writes the app makes on its own whenever it navigates, live entries included, that touch only
// this device's UI state: they pass to the service while a fixture is active.
const localWrites: ReadonlyArray<{method: string; allows: (param: unknown) => boolean}> = [
  // the phone saves its current route to restore at the next launch (util/storeless-actions.tsx)
  {allows: p => (p as {path?: string} | undefined)?.path === 'ui.routeState2', method: 'keybase.1.config.guiSetValue'},
]
export const isLocalWrite = (method: string, param: unknown) => localWrites.some(w => w.method === method && w.allows(param))

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

  const deliver = (a: Active, payloads: ReadonlyArray<{method: string; param: (ctx: FixtureContext) => object}>) => {
    a.injecting = true
    try {
      for (const i of payloads) deps.inject({method: i.method, param: [i.param(a.ctx())]})
    } finally {
      a.injecting = false
    }
  }

  // the def's follow-ups of an incoming call, on the next tick
  const followUp = (a: Active, method: string) => {
    const due = (a.def.follow ?? []).filter(f => f.after === method)
    if (!due.length) return
    const timer = setTimeout(() => {
      a.followTimers.delete(timer)
      if (cur === a) deliver(a, due)
    }, 0)
    a.followTimers.add(timer)
  }

  const rpc: VisualRpc = {
    incoming: (payload, how) => {
      const a = cur
      if (!a || payload.response?.cancelled || how.customResponse || a.injecting) return payload
      followUp(a, payload.method)
      const t = a.def.incoming?.find(r => r.method === payload.method)
      if (t) {
        const [first, ...rest] = payload.param
        return {...payload, param: [{...t.transform(first ?? {}, a.ctx()), sessionID: first?.sessionID}, ...rest]}
      }
      if (a.def.hold && !how.inSession) {
        // answered as the engine would answer a notification, then dropped
        payload.response?.result?.()
        return undefined
      }
      return payload
    },
    invoke: call => {
      const a = cur
      if (!a) return false
      const rule = a.def.rpc.find(r => r.method === call.method)
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
        call.reply(undefined, rule.transform(result, call.param, a.ctx()))
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
      deliver(a, a.def.inject ?? [])
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
        followTimers: new Set(),
        injecting: false,
        name,
        pending: new Map(),
        refused: [],
        snapshots,
      }
      deps.install(rpc)
      def.beforeNav?.(deps.stores, cur.ctx())
    },
    end: () => {
      const a = cur
      if (!a) throw new Error('end with no fixture active')
      cur = undefined
      deps.install(undefined)
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
      return {cancelledReplies, refusedWrites: a.refused, storesNotRestored, teardown: a.def.teardown}
    },
    served: () => !!cur && cur.def.rpc.every(r => !r.required || cur?.answered.has(r)),
    version: FIXTURE_RUNTIME_VERSION,
  }
  return {fixtures, rpc}
}

if (__DEV__) {
  const {fixtures} = createRuntime({
    forget,
    inject: payload => (globalThis.DEBUGEngine as {_rpcIncoming: (p: IncomingPayload) => void})._rpcIncoming(payload),
    install: rpc => {
      globalThis.__kbVisualRpc = rpc
    },
    now: () => Date.now(),
    stores: devStores(),
  })
  globalThis.__kbVisualFixtures = fixtures
}
