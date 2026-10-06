// What a fixture is made of. The area files (devices.ts, people.ts, …) define fixtures with these;
// runtime.ts runs them.
import type * as T from '@/constants/types'

type Messages = T.RPCGen.MessageTypes & T.RPCChat.MessageTypes
export type Method = keyof Messages
export type InParam<M extends Method> = Messages[M]['inParam']
export type OutParam<M extends Method> = Messages[M]['outParam']

// What a fixture's functions see: its args from the tour entry (refs already resolved) and the
// app's frozen clock at the moment of the call.
export type FixtureContext = {args: Readonly<Record<string, unknown>>; now: number}

// A call into the session that started the RPC, as the service would send one before replying.
export type Deliver = (method: string, param: object) => void

// stub: answers the RPC without the service. transform: lets the RPC through and rewrites its
// result. `required`: the fixture's state shows only once this rule has answered, so the driver
// waits for it before capturing.
export type RpcRule =
  | {method: string; stub: (param: unknown, ctx: FixtureContext, deliver: Deliver) => unknown; required: boolean}
  | {method: string; transform: (result: unknown, param: unknown, ctx: FixtureContext) => unknown; required: boolean}

export const stub = <M extends Method>(
  method: M,
  reply: (param: InParam<M>, ctx: FixtureContext, deliver: Deliver) => OutParam<M>,
  opts: {required: boolean}
): RpcRule => ({method, required: opts.required, stub: reply as (param: unknown, ctx: FixtureContext, deliver: Deliver) => unknown})

export const transform = <M extends Method>(
  method: M,
  rewrite: (result: OutParam<M>, param: InParam<M>, ctx: FixtureContext) => OutParam<M>,
  opts: {required: boolean}
): RpcRule => ({
  method,
  required: opts.required,
  transform: rewrite as (result: unknown, param: unknown, ctx: FixtureContext) => unknown,
})

// A zustand store the fixture touches: one of the team builder's per-namespace stores
// (`tb:<namespace>`), or a store registered under an HMR key (`z:<key>`, util/zustand.tsx). The
// runtime snapshots each at begin and puts it back at end.
export type StoreKey = `tb:${T.TB.AllowedNamespace}` | `z:${string}`
// zustand's: setState merges `s` into the state, or replaces the state with it when `replace`
export type StoreApi = {getState: () => unknown; setState: (s: unknown, replace?: boolean) => void}
export type Stores = {get: (key: StoreKey) => StoreApi | undefined}

export type FixtureDef = {
  rpc: ReadonlyArray<RpcRule>
  // rewrites of incoming calls and notifications from the service
  incoming?: ReadonlyArray<{method: string; transform: (param: object, ctx: FixtureContext) => object}>
  // notifications delivered after the entry's ready state shows
  inject?: ReadonlyArray<{method: string; param: (ctx: FixtureContext) => object}>
  // notifications delivered on the tick after each incoming call named `after` (what the service
  // pushes once that data is in, like coin flip statuses after the thread: a later copy of the
  // data replaces what they set), so a setup step can already reach what they draw
  follow?: ReadonlyArray<{after: string; method: string; param: (ctx: FixtureContext) => object}>
  // drop the service's notifications while active (prompts that need an answer still pass)
  hold?: boolean
  stores?: ReadonlyArray<StoreKey>
  // direct store sets: before navigation, and after the ready state shows
  beforeNav?: (stores: Stores, ctx: FixtureContext) => void
  afterReady?: (stores: Stores, ctx: FixtureContext) => void
  // how the driver puts the app back after end(): remount every screen, or reload the app
  teardown: 'remount' | 'reload'
}
