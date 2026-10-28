/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import type * as Runtime from './runtime.ts'

// the module installs itself only in a dev app
;(globalThis as {__DEV__?: boolean}).__DEV__ = false
const {createRouteRecorder, createRuntime, routeNames} = await import('./runtime.ts')

// A runtime whose installed engine hook the test can read.
const runtime = () => {
  let installed: Runtime.VisualRpc | undefined
  // a function, so an assertion about one read does not narrow the next
  const hook = () => installed
  const rt = createRuntime({
    forget: () => {},
    inject: () => {},
    install: r => {
      installed = r
    },
    now: () => 0,
    stores: {get: () => undefined},
  })
  return {hook, rt}
}

// An outgoing call that fails the test if the hook answers it, sends it or delivers into it.
const passing = (method: string): Runtime.OutgoingCall => ({
  deliver: () => assert.fail(`${method} got a delivery`),
  method,
  param: {},
  real: () => assert.fail(`${method} was sent by the hook`),
  reply: () => assert.fail(`${method} was answered by the hook`),
})

// The root stack shows loggedIn; its tab navigator lists both tabs and focuses settings, whose stack
// has the account page on top of the settings root; the account page's own navigator (stale: no
// index) shows a route named like an outer one.
const nested = {
  index: 0,
  routeNames: ['loggedIn', 'neverShown'],
  routes: [
    {
      key: 'a',
      name: 'loggedIn',
      state: {
        index: 1,
        routes: [
          {key: 'b', name: 'tabs.chatTab', state: {index: 0, routes: [{key: 'c', name: 'chatRoot'}]}},
          {
            key: 'd',
            name: 'tabs.settingsTab',
            state: {
              index: 1,
              routes: [
                {key: 'e', name: 'settingsRoot'},
                {key: 'f', name: 'settingsTabs.accountTab', state: {routes: [{key: 'g', name: 'chatRoot'}, {key: 'h', name: 'loggedIn'}]}},
              ],
            },
          },
        ],
      },
    },
  ],
}
const nestedFocused = ['loggedIn', 'tabs.settingsTab', 'settingsTabs.accountTab']

test('route names: the focused route of each navigator down the tree, each once', () => {
  assert.deepEqual(routeNames(nested), nestedFocused)
  assert.deepEqual(routeNames({index: 0, routes: [{key: 'x', name: 'firstTab'}, {key: 'y', name: 'secondTab'}]}), ['firstTab'])
  assert.deepEqual(routeNames(undefined), [])
  assert.deepEqual(routeNames({index: 1, routes: [{key: 'x', name: 'notFocused'}, null]}), [])
  assert.deepEqual(routeNames({routes: [{key: 'x', name: 'under'}, {name: 7}]}), [])
})

test('idle, no hook is installed; recording, the hook passes every call and payload through and records the method', () => {
  const {hook, rt} = runtime()
  assert.equal(hook(), undefined)
  rt.recording.start()
  const rpc = hook()
  if (!rpc) throw new Error('recording installs no hook')
  assert.equal(rpc.invoke(passing('keybase.1.user.loadMySettings')), false)
  assert.equal(rpc.invoke(passing('chat.1.local.postTextNonblock')), false)
  assert.equal(rpc.invoke(passing('keybase.1.user.loadMySettings')), false)
  const p = {method: 'keybase.1.NotifyBadges.badgeState', param: [{sessionID: 3}]}
  const before = JSON.stringify(p)
  assert.equal(rpc.incoming(p, {customResponse: false, inSession: false}), p)
  assert.equal(rpc.incoming(p, {customResponse: false, inSession: true}), p)
  assert.equal(JSON.stringify(p), before)
  assert.deepEqual(rt.recording.take(), ['keybase.1.user.loadMySettings', 'chat.1.local.postTextNonblock'])
  assert.equal(hook(), undefined, 'take removes the hook')
  assert.deepEqual(rt.recording.take(), [], 'a take with nothing started has nothing')
})

test('a fixture records while the recorder is started, and its end leaves the recording hook in place', () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  rt.fixtures.begin('device-last-used', {})
  // a write no rule answers: the fixture refuses it, and it is still recorded
  let refused: unknown
  assert.equal(
    hook()?.invoke({...passing('keybase.1.teams.teamAddMember'), reply: e => (refused = e)}),
    true
  )
  assert.ok(refused instanceof Error)
  rt.fixtures.end()
  const rpc = hook()
  if (!rpc) throw new Error('the fixture end removed the recording hook')
  assert.equal(rpc.invoke(passing('keybase.1.user.loadMySettings')), false)
  assert.deepEqual(rt.recording.take(), ['keybase.1.teams.teamAddMember', 'keybase.1.user.loadMySettings'])
  assert.equal(hook(), undefined)
})

test('a fixture without the recorder records nothing, and start resets an earlier recording', () => {
  const {hook, rt} = runtime()
  rt.fixtures.begin('device-last-used', {})
  const rpc = hook()
  if (!rpc) throw new Error('the fixture installs no hook')
  assert.equal(rpc.invoke(passing('keybase.1.user.loadMySettings')), false)
  rt.recording.start()
  assert.equal(hook(), rpc)
  assert.equal(rpc.invoke(passing('keybase.1.user.getUserBlocks')), false)
  rt.recording.start()
  assert.equal(rpc.invoke(passing('keybase.1.home.homeGetScreen')), false)
  assert.deepEqual(rt.recording.take(), ['keybase.1.home.homeGetScreen'])
  assert.ok(hook(), 'the fixture is still active')
  rt.fixtures.end()
  assert.equal(hook(), undefined)
})

type Listener = (e: {data?: {state?: unknown}}) => void
const fakeNav = (state: unknown) => {
  const listeners = new Set<Listener>()
  const nav = {
    addListener: (_event: 'state', cb: Listener) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    emit: (s: unknown) => {
      nav.state = s
      for (const l of listeners) l({data: {state: s}})
    },
    getRootState: () => nav.state,
    listeners,
    state,
  }
  return nav
}

const routeHarness = () => {
  const g: {nav: ReturnType<typeof fakeNav> | undefined; poll: (() => void) | undefined} = {nav: undefined, poll: undefined}
  const rec = createRouteRecorder({
    every: (_ms, f) => {
      g.poll = f
      return () => {
        g.poll = undefined
      }
    },
    navigator: () => g.nav,
  })
  return {g, rec}
}

test('routes: the state at start, every state event, the state at take, and a navigator that appears or is replaced later', () => {
  const {g, rec} = routeHarness()
  // no navigator yet at start
  rec.start()
  assert.ok(g.poll, 'polls for the navigator while recording')
  const first = fakeNav({routes: [{key: 'a', name: 'loggedIn'}]})
  g.nav = first
  g.poll()
  first.emit({routes: [{key: 'a', name: 'loggedIn', state: {routes: [{key: 'b', name: 'settingsRoot'}]}}]})
  // the router remounted: a new navigator, the old one forgotten
  const second = fakeNav({routes: [{key: 'c', name: 'chatRoot'}]})
  g.nav = second
  g.poll()
  assert.equal(first.listeners.size, 0)
  first.emit({routes: [{key: 'x', name: 'staleRoute'}]})
  // a state no event told of, read by a poll, then replaced
  second.state = {routes: [{key: 'c', name: 'chatRoot', state: {routes: [{key: 's', name: 'chatSilent'}]}}]}
  g.poll()
  second.emit({routes: [{key: 'c', name: 'chatRoot'}, {key: 'd', name: 'chatConversation'}]})
  // a state no event has told of yet is read at take
  second.state = {routes: [{key: 'c', name: 'chatRoot'}, {key: 'd', name: 'chatConversation'}, {key: 'i', name: 'chatInfoPanel'}]}
  assert.deepEqual(rec.take(), {
    routes: ['loggedIn', 'settingsRoot', 'chatRoot', 'chatSilent', 'chatConversation', 'chatInfoPanel'],
    startRoutes: [],
  })
  assert.equal(second.listeners.size, 0)
  assert.equal(g.poll, undefined, 'take stops polling')
  second.emit({routes: [{key: 'e', name: 'peopleRoot'}]})
  assert.deepEqual(rec.take(), {routes: [], startRoutes: []})
})

test('routes: the state already shown at start goes in startRoutes, and a navigator that throws is skipped', () => {
  const {g, rec} = routeHarness()
  g.nav = fakeNav(nested)
  rec.start()
  g.poll?.()
  g.nav.emit(nested)
  assert.deepEqual(rec.take(), {routes: [], startRoutes: nestedFocused})
  g.nav = {
    ...fakeNav(undefined),
    getRootState: () => {
      throw new Error('not ready')
    },
  }
  rec.start()
  assert.deepEqual(rec.take(), {routes: [], startRoutes: []})
})

test('routes: a screen shown at start is in routes only once a later, different state shows it again', () => {
  const {g, rec} = routeHarness()
  const settings = {routes: [{key: 'a', name: 'settingsRoot', state: {routes: [{key: 'b', name: 'settingsTabs.accountTab'}]}}]}
  const display = {routes: [{key: 'a', name: 'settingsRoot', state: {routes: [{key: 'c', name: 'settingsTabs.displayTab'}]}}]}
  const nav = fakeNav(settings)
  g.nav = nav
  rec.start()
  nav.emit(display)
  g.poll?.()
  nav.emit(display)
  assert.deepEqual(rec.take(), {routes: ['settingsRoot', 'settingsTabs.displayTab'], startRoutes: ['settingsRoot', 'settingsTabs.accountTab']})
  rec.start()
  nav.emit(settings)
  nav.emit(display)
  assert.deepEqual(rec.take(), {routes: ['settingsRoot', 'settingsTabs.accountTab', 'settingsTabs.displayTab'], startRoutes: ['settingsRoot', 'settingsTabs.displayTab']})
})
