/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import type * as Runtime from './runtime.ts'

// the module installs itself only in a dev app
;(globalThis as {__DEV__?: boolean}).__DEV__ = false
const {createRouteRecorder, createRuntime, liveNavigator, recordsBoot, routeNames} = await import('./runtime.ts')

// A runtime whose installed engine hook the test can read.
const runtime = (recordBoot = false) => {
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
    recordBoot,
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

test('start({includeBoot: true}) includes RPCs sent before start', () => {
  const {hook, rt} = runtime(true)
  hook()?.invoke(passing('a.b.c'))
  rt.recording.start({includeBoot: true})
  hook()?.invoke(passing('x.y.z'))
  assert.deepEqual(rt.recording.take(), ['a.b.c', 'x.y.z'])
  assert.equal(hook(), undefined)
  rt.recording.start({includeBoot: true})
  assert.deepEqual(rt.recording.take(), [], 'the boot list is credited once')
})

test('start() alone leaves out RPCs sent before it', () => {
  const {hook, rt} = runtime(true)
  hook()?.invoke(passing('a.b.c'))
  rt.recording.start()
  hook()?.invoke(passing('x.y.z'))
  assert.deepEqual(rt.recording.take(), ['x.y.z'])
})

// an outgoing call with params, passed through like `passing`
const passingWith = (method: string, param: unknown): Runtime.OutgoingCall => ({...passing(method), param})

test('a call while paused is left out of the recording and the boot list; calls before the pause and after the resume are in', () => {
  const {hook, rt} = runtime(true)
  hook()?.invoke(passing('boot.before'))
  const boot = rt.recording.pause()
  hook()?.invoke(passing('boot.paused'))
  rt.recording.resume(boot)
  rt.recording.start({includeBoot: true})
  hook()?.invoke(passing('a.before'))
  const t = rt.recording.pause()
  hook()?.invoke(passing('a.paused'))
  rt.recording.resume(t)
  hook()?.invoke(passing('a.after'))
  assert.deepEqual(rt.recording.take(), ['boot.before', 'a.before', 'a.after'])
})

test('two open pauses keep the recorder paused until both resume; a stale or unknown token changes nothing', () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  const one = rt.recording.pause()
  const two = rt.recording.pause()
  assert.notEqual(one, two)
  rt.recording.resume(one)
  rt.recording.resume(one)
  rt.recording.resume('unknown')
  hook()?.invoke(passing('a.still-paused'))
  rt.recording.resume(two)
  hook()?.invoke(passing('a.resumed'))
  const three = rt.recording.pause()
  rt.recording.resume(two)
  hook()?.invoke(passing('a.paused-again'))
  rt.recording.resume(three)
  assert.deepEqual(rt.recording.take(), ['a.resumed'])
})

test('start() drops every open pause, so one left open cannot silence the next recording', () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  const left = rt.recording.pause()
  rt.recording.start()
  hook()?.invoke(passing('a.next'))
  rt.recording.resume(left)
  assert.deepEqual(rt.recording.take(), ['a.next'])
})

test('the call log holds every call while recording, flags paused ones, and keeps no param but typing', () => {
  const {hook, rt} = runtime(true)
  hook()?.invoke(passing('boot.only'))
  rt.recording.start()
  const from = rt.recording.calls(Number.MAX_SAFE_INTEGER).seq
  hook()?.invoke(passingWith('chat.1.local.updateTyping', {conversationID: 'secret-conv', typing: true}))
  const t = rt.recording.pause()
  hook()?.invoke(passingWith('chat.1.local.postTextNonblock', {body: 'secret-text', typing: true}))
  rt.recording.resume(t)
  hook()?.invoke(passingWith('chat.1.local.updateTyping', {conversationID: 'secret-conv', typing: false}))
  const log = rt.recording.calls(from)
  assert.deepEqual(
    log.calls.map(({seq: _seq, ...c}) => c),
    [
      {method: 'chat.1.local.updateTyping', paused: false, typing: true},
      {method: 'chat.1.local.postTextNonblock', paused: true},
      {method: 'chat.1.local.updateTyping', paused: false, typing: false},
    ]
  )
  assert.equal(log.seq, log.calls.at(-1)?.seq)
  assert.ok(log.calls.every((c, i) => i === 0 || c.seq > log.calls[i - 1]!.seq))
  assert.doesNotMatch(JSON.stringify(log), /secret/)
  assert.deepEqual(rt.recording.calls(log.seq).calls, [])
  assert.equal(rt.recording.calls(log.seq).seq, log.seq)
  assert.deepEqual(rt.recording.take(), ['chat.1.local.updateTyping'])
})

test("the call log keeps a bulk channel add's conversation ids, as hex, and nothing else of it", () => {
  const {hook, rt} = runtime(true)
  rt.recording.start()
  const from = rt.recording.calls(Number.MAX_SAFE_INTEGER).seq
  hook()?.invoke(
    passingWith('chat.1.local.bulkAddToManyConvs', {conversations: [new Uint8Array([0, 171]), new Uint8Array([1, 2])], usernames: ['secret-user']})
  )
  const log = rt.recording.calls(from)
  assert.deepEqual(
    log.calls.map(({seq: _seq, ...c}) => c),
    [{convs: ['00ab', '0102'], method: 'chat.1.local.bulkAddToManyConvs', paused: false}]
  )
  assert.doesNotMatch(JSON.stringify(log), /secret/)
})

test("the call log notes when a device list read or a device add is answered and its error, and hands the answer on as it came", () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  const from = rt.recording.calls(Number.MAX_SAFE_INTEGER).seq
  const sent: Array<(err: unknown, result: unknown) => void> = []
  const replies: Array<[unknown, unknown]> = []
  const relayed = (method: string): Runtime.OutgoingCall => ({
    deliver: () => assert.fail(`${method} got a delivery`),
    method,
    param: {},
    real: done => {
      sent.push(done)
    },
    reply: (err, result) => {
      replies.push([err, result])
    },
  })
  assert.equal(hook()?.invoke(relayed('keybase.1.device.deviceAdd')), true)
  assert.equal(hook()?.invoke(relayed('keybase.1.device.deviceHistoryList')), true)
  assert.equal(replies.length, 0)
  const secretResult = [{name: 'secret-device'}]
  sent[0]!(undefined, null)
  hook()?.invoke(passing('a.after-the-add'))
  const failure = new Error('the read failed')
  sent[1]!(failure, undefined)
  assert.deepEqual(replies, [
    [undefined, null],
    [failure, undefined],
  ])
  sent.length = 0
  hook()?.invoke(relayed('keybase.1.device.deviceHistoryList'))
  sent[0]!(undefined, secretResult)
  assert.equal(replies.at(-1)?.[1], secretResult)
  const log = rt.recording.calls(from)
  assert.deepEqual(
    log.calls.map(({seq: _seq, ...c}) => c),
    [
      {answer: {afterSeq: 2}, method: 'keybase.1.device.deviceAdd', paused: false},
      {answer: {afterSeq: 3, error: 'the read failed'}, method: 'keybase.1.device.deviceHistoryList', paused: false},
      {method: 'a.after-the-add', paused: false},
      {answer: {afterSeq: 4}, method: 'keybase.1.device.deviceHistoryList', paused: false},
    ]
  )
  assert.doesNotMatch(JSON.stringify(log), /secret/)
})

test('a device list read sent while nothing records is left to the engine', () => {
  const {hook} = runtime(true)
  assert.equal(hook()?.invoke(passing('keybase.1.device.deviceHistoryList')), false)
})

test('the call log says which runtime and recording it belongs to, and whether it is recording now', () => {
  const {rt} = runtime()
  const other = runtime().rt
  assert.equal(rt.recording.calls(0).recording, false)
  rt.recording.start()
  const at = rt.recording.calls(0)
  assert.equal(at.recording, true)
  assert.notEqual(at.runtime, other.recording.calls(0).runtime)
  rt.recording.take()
  assert.equal(rt.recording.calls(0).recording, false)
  assert.equal(rt.recording.calls(0).runtime, at.runtime)
  rt.recording.start()
  assert.equal(rt.recording.calls(0).generation, at.generation + 1)
})

test('the call log keeps only the latest calls', () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  for (let i = 0; i < 10_000; i++) hook()?.invoke(passing(`a.${i}`))
  const log = rt.recording.calls(0)
  assert.ok(log.calls.length < 10_000)
  assert.equal(log.calls.at(-1)?.method, 'a.9999')
  assert.equal(log.seq, log.calls.at(-1)?.seq)
  // everything before the oldest kept call is reported dropped
  assert.equal(log.droppedThrough, log.calls[0]!.seq - 1)
  assert.ok(log.droppedThrough > 0)
})

test('a log that dropped nothing reports nothing dropped', () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  hook()?.invoke(passing('a.b'))
  assert.equal(rt.recording.calls(0).droppedThrough, 0)
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

// A navigation container whose state the test sets, and which tells its listeners.
const container = (state: unknown) => {
  const listeners = new Set<(e: {data?: {state?: unknown}}) => void>()
  let current = state
  return {
    addListener: (_: 'state', cb: (e: {data?: {state?: unknown}}) => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getRootState: () => current,
    set: (next: unknown) => {
      current = next
      for (const cb of listeners) cb({data: {state: next}})
    },
  }
}
const stack = (...names: Array<string>) => ({index: names.length - 1, routes: names.map((name, i) => ({key: `${i}`, name}))})

// an invite link joined from the phone: the route carries its key, and the join call carries the link
const inviteLink = 'https://keybase.io/i/t/abcdefghijklmnop#secretkey0123456789'

test('routes: a teamInviteLinkJoin route records its name, never its inviteKey', () => {
  const {g, rec} = routeHarness()
  g.nav = fakeNav({routes: [{key: 'a', name: 'teamsRoot'}]})
  rec.start()
  g.nav.emit({
    routes: [
      {key: 'a', name: 'teamsRoot'},
      {key: 'b', name: 'teamInviteLinkJoin', params: {inviteDetails: {teamID: 'tid'}, inviteKey: inviteLink}},
    ],
  })
  const got = rec.take()
  assert.deepEqual(got, {routes: ['teamInviteLinkJoin'], startRoutes: ['teamsRoot']})
  assert.doesNotMatch(JSON.stringify(got), /secretkey|keybase\.io/)
})

test('the call log keeps no param of the invite-link join', () => {
  const {hook, rt} = runtime()
  rt.recording.start()
  hook()?.invoke(passingWith('keybase.1.teams.teamAcceptInviteOrRequestAccess', {sessionID: 1, tokenOrName: inviteLink}))
  const log = rt.recording.calls(0)
  assert.deepEqual(
    log.calls.map(c => c.method),
    ['keybase.1.teams.teamAcceptInviteOrRequestAccess']
  )
  assert.doesNotMatch(JSON.stringify(log), /secretkey|keybase\.io/)
  assert.doesNotMatch(JSON.stringify(rt.recording.take()), /secretkey|keybase\.io/)
})

test('routes from a remounted navigation container are recorded', () => {
  const first = container(stack('loggedIn'))
  const router = {navigationRef: {current: first as Runtime.NavLike | null}}
  // DEBUGNavigator keeps the container of the first mount
  const g = {DEBUGNavigator: first, DEBUGRouter2: router}
  let poll = () => {}
  const rec = createRouteRecorder({
    every: (_ms, f) => {
      poll = f
      return () => {}
    },
    navigator: () => liveNavigator(g),
  })
  rec.start()
  // a sign-out remounts the container; the old one never changes again
  const second = container(stack('loggedOut'))
  router.navigationRef.current = second
  poll()
  second.set(stack('loggedOut', 'login'))
  second.set(stack('loggedOut', 'login', 'forgotUsername'))
  assert.deepEqual(rec.take().routes, ['loggedOut', 'login', 'forgotUsername'])
})

test('liveNavigator falls back to DEBUGNavigator without a router ref', () => {
  const only = container(stack('loggedIn'))
  assert.equal(liveNavigator({DEBUGNavigator: only}), only)
  assert.equal(liveNavigator({}), undefined)
})

test('liveNavigator reads the router ref when both debug globals are absent', () => {
  const mounted = container(stack('loggedIn'))
  assert.equal(liveNavigator({}, () => mounted), mounted)
  assert.equal(liveNavigator({}, () => null), undefined)
})

test('liveNavigator still prefers DEBUGRouter2 over the router ref', () => {
  const debug = container(stack('loggedIn'))
  const other = container(stack('loggedOut'))
  assert.equal(liveNavigator({DEBUGRouter2: {navigationRef: {current: debug}}}, () => other), debug)
})

test('a native dev app records boot RPCs; a desktop one only when the harness launched it', () => {
  assert.equal(recordsBoot({navigator: {product: 'ReactNative'}}), true)
  assert.equal(recordsBoot({}), false)
  assert.equal(recordsBoot({_fromPreload: {constants: {env: {KB_E2E_TEST: '1'}}}}), true)
})
