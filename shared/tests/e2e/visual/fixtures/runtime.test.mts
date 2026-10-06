/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {FixtureDef, StoreApi, StoreKey} from './def.ts'
import type * as Runtime from './runtime.ts'

// the module installs itself only in a dev app
;(globalThis as {__DEV__?: boolean}).__DEV__ = false
const {createRuntime, definitions, isWriteMethod} = (await import('./runtime.ts')) as typeof Runtime
const {FIXTURES} = await import('./names.ts')

const tick = async () => new Promise(resolve => setTimeout(resolve, 1))

const store = (state: unknown): StoreApi & {state: unknown} => {
  const s = {
    getState: () => s.state,
    setState: (next: unknown) => {
      s.state = next
    },
    state,
  }
  return s
}

// A runtime over one fixture definition, with stores and injected payloads it can see.
const harness = (def: FixtureDef, registry = new Map<StoreKey, StoreApi>()) => {
  const injected: Array<Runtime.IncomingPayload> = []
  const name = 'device-last-used'
  const saved = definitions[name]
  ;(definitions as Record<string, FixtureDef>)[name] = def
  const rt = createRuntime({
    forget: key => registry.delete(key),
    inject: p => {
      injected.push(rt.rpc.incoming(p, {customResponse: false, inSession: false}) ?? {method: 'dropped', param: []})
    },
    now: () => 1_000_000,
    stores: {get: key => registry.get(key)},
  })
  return {
    begin: (args: Record<string, unknown> = {}) => rt.fixtures.begin(name, args),
    injected,
    registry,
    restore: () => {
      ;(definitions as Record<string, FixtureDef>)[name] = saved
    },
    rt,
  }
}

type Call = {err?: unknown; result?: unknown; replied: boolean; sent: boolean; delivered: Array<string>}
const call = (rt: ReturnType<typeof createRuntime>, method: string, param: unknown = {}, live: unknown = 'live') => {
  const c: Call = {delivered: [], replied: false, sent: false}
  const handled = rt.rpc.invoke({
    deliver: m => c.delivered.push(m),
    method,
    param,
    real: done => {
      c.sent = true
      done(undefined, live)
    },
    reply: (err, result) => {
      c.replied = true
      c.err = err
      c.result = result
    },
  })
  return {c, handled}
}

test('a write is a write verb among the camel-case words of the method name', () => {
  for (const m of ['keybase.1.teams.teamAddMember', 'keybase.1.SimpleFS.simpleFSRemove', 'chat.1.local.postTextNonblock', 'keybase.1.config.guiSetValue', 'keybase.1.user.setUserBlocks', 'keybase.1.teams.teamCreate', 'chat.1.local.deleteConversationLocal']) {
    assert.ok(isWriteMethod(m), m)
  }
  for (const m of ['keybase.1.user.loadMySettings', 'keybase.1.home.homeGetScreen', 'keybase.1.SimpleFS.simpleFSSettings', 'keybase.1.device.deviceHistoryList', 'keybase.1.user.getUserBlocks']) {
    assert.ok(!isWriteMethod(m), m)
  }
})

test('inactive, the runtime answers nothing and passes every incoming call', () => {
  const h = harness({rpc: [], teardown: 'remount'})
  try {
    assert.equal(h.rt.fixtures.active(), false)
    assert.equal(call(h.rt, 'keybase.1.teams.teamAddMember').handled, false)
    const p = {method: 'keybase.1.NotifyBadges.badgeState', param: [{}]}
    assert.equal(h.rt.rpc.incoming(p, {customResponse: false, inSession: false}), p)
  } finally {
    h.restore()
  }
})

test('stubs answer on a later tick, transforms rewrite the live answer, served waits for required rules', async () => {
  const h = harness({
    rpc: [
      {
        method: 'a.1.x.stubbed',
        required: true,
        stub: (_p, ctx, deliver) => {
          deliver('a.1.x.progress', {})
          return ctx.now
        },
      },
      {method: 'a.1.x.rewritten', required: true, transform: (r, _p, ctx) => `${String(r)}@${String(ctx.args['tag'])}`},
      {method: 'a.1.x.optional', required: false, stub: () => 'o'},
    ],
    teardown: 'remount',
  })
  try {
    h.begin({tag: 't'})
    assert.equal(h.rt.fixtures.active(), true)
    const s = call(h.rt, 'a.1.x.stubbed')
    assert.equal(s.handled, true)
    assert.deepEqual(s.c.delivered, ['a.1.x.progress'])
    assert.equal(s.c.replied, false)
    assert.equal(h.rt.fixtures.served(), false)
    await tick()
    assert.deepEqual([s.c.replied, s.c.result, s.c.sent], [true, 1_000_000, false])
    assert.equal(h.rt.fixtures.served(), false)
    const r = call(h.rt, 'a.1.x.rewritten')
    assert.deepEqual([r.handled, r.c.sent, r.c.result], [true, true, 'live@t'])
    assert.equal(h.rt.fixtures.served(), true)
    // a read no rule names goes to the service untouched
    assert.equal(call(h.rt, 'a.1.x.getThing').handled, false)
    assert.deepEqual(h.rt.fixtures.end(), {cancelledReplies: [], refusedWrites: [], storesNotRestored: [], teardown: 'remount'})
    assert.equal(h.rt.fixtures.served(), false)
  } finally {
    h.restore()
  }
})

test('a write no rule answers is refused and reported; a stubbed write is answered', () => {
  const h = harness({rpc: [{method: 'a.1.x.sendIt', required: false, stub: () => 'ok'}], teardown: 'remount'})
  try {
    h.begin()
    const w = call(h.rt, 'keybase.1.teams.teamAddMember')
    assert.deepEqual([w.handled, w.c.replied, w.c.sent], [true, true, false])
    assert.match(String(w.c.err), /refused keybase\.1\.teams\.teamAddMember/)
    assert.equal(call(h.rt, 'a.1.x.sendIt').handled, true)
    // the phone's route save on navigation is a local UI write, and passes; other gui values do not
    assert.equal(call(h.rt, 'keybase.1.config.guiSetValue', {path: 'ui.routeState2'}).handled, false)
    assert.equal(call(h.rt, 'keybase.1.config.guiSetValue', {path: 'ui.notifySound'}).handled, true)
    assert.deepEqual(h.rt.fixtures.end().refusedWrites, ['keybase.1.teams.teamAddMember', 'keybase.1.config.guiSetValue'])
  } finally {
    h.restore()
  }
})

test('end answers stub replies still pending with an error and reports them; a live answer after end passes', async () => {
  let late: ((err: unknown, r: unknown) => void) | undefined
  const h = harness({
    rpc: [
      {method: 'a.1.x.stubbed', required: true, stub: () => 'fixture'},
      {method: 'a.1.x.rewritten', required: true, transform: () => 'rewritten'},
    ],
    teardown: 'remount',
  })
  try {
    h.begin()
    const s = call(h.rt, 'a.1.x.stubbed')
    let result: unknown
    h.rt.rpc.invoke({
      deliver: () => {},
      method: 'a.1.x.rewritten',
      param: {},
      real: done => {
        late = done
      },
      reply: (_e, r) => {
        result = r
      },
    })
    const report = h.rt.fixtures.end()
    assert.deepEqual(report.cancelledReplies, ['a.1.x.stubbed'])
    assert.match(String(s.c.err), /ended before answering/)
    late?.(undefined, 'live')
    assert.equal(result, 'live')
    // the stub's own answer never follows
    await tick()
    assert.deepEqual([String(s.c.err).includes('ended before answering'), s.c.result], [true, undefined])
  } finally {
    h.restore()
  }
})

test('hold drops notifications but not session calls, answer prompts, cancels or injected ones', () => {
  const h = harness({
    hold: true,
    incoming: [{method: 'a.1.x.rewriteMe', transform: p => ({...p, v: 2})}],
    inject: [{method: 'a.1.x.injected', param: ctx => ({at: ctx.now})}],
    rpc: [],
    teardown: 'remount',
  })
  try {
    h.begin()
    let answered = false
    const note = {method: 'a.1.x.note', param: [{}], response: {result: () => (answered = true)}}
    assert.equal(h.rt.rpc.incoming(note, {customResponse: false, inSession: false}), undefined)
    assert.equal(answered, true)
    const inSession = {method: 'a.1.x.note', param: [{sessionID: 3}]}
    assert.equal(h.rt.rpc.incoming(inSession, {customResponse: false, inSession: true}), inSession)
    assert.equal(h.rt.rpc.incoming(note, {customResponse: true, inSession: false}), note)
    const cancel = {method: 'a.1.x.note', param: [{}], response: {cancelled: true}}
    assert.equal(h.rt.rpc.incoming(cancel, {customResponse: false, inSession: false}), cancel)
    assert.deepEqual(h.rt.rpc.incoming({method: 'a.1.x.rewriteMe', param: [{sessionID: 4, v: 1} as {sessionID: number}]}, {customResponse: false, inSession: true})?.param, [
      {sessionID: 4, v: 2},
    ])
    h.rt.fixtures.afterReady()
    assert.deepEqual(h.injected, [{method: 'a.1.x.injected', param: [{at: 1_000_000}]}])
    h.rt.fixtures.end()
  } finally {
    h.restore()
  }
})

test('declared stores are put back: a store that existed gets its state, one made during the fixture goes', () => {
  const kept = store({recs: 'live'})
  const registry = new Map<StoreKey, StoreApi>([['tb:chat', kept]])
  const h = harness(
    {
      afterReady: s => s.get('tb:chat')?.setState({recs: 'after'}, true),
      beforeNav: s => s.get('tb:chat')?.setState({recs: 'cleared'}, true),
      rpc: [],
      stores: ['tb:chat', 'tb:people'],
      teardown: 'remount',
    },
    registry
  )
  try {
    h.begin()
    assert.deepEqual(kept.state, {recs: 'cleared'})
    registry.set('tb:people', store({recs: 'fixture'}))
    h.rt.fixtures.afterReady()
    assert.deepEqual(h.rt.fixtures.end(), {cancelledReplies: [], refusedWrites: [], storesNotRestored: [], teardown: 'remount'})
    assert.deepEqual(kept.state, {recs: 'live'})
    assert.equal(registry.has('tb:people'), false)
  } finally {
    h.restore()
  }
  // a store end cannot put back is reported
  const stuck = {getState: () => ({}), setState: () => {}}
  const h2 = harness({rpc: [], stores: ['z:stuck'], teardown: 'remount'}, new Map([['z:stuck', stuck]]))
  try {
    h2.begin()
    assert.deepEqual(h2.rt.fixtures.end().storesNotRestored, ['z:stuck'])
  } finally {
    h2.restore()
  }
})

test('begin refuses an unknown fixture and a second one; end and afterReady need one', () => {
  const h = harness({rpc: [], teardown: 'remount'})
  try {
    assert.throws(() => h.rt.fixtures.begin('nope', {}), /unknown fixture nope/)
    assert.throws(() => h.rt.fixtures.end(), /no fixture active/)
    assert.throws(() => h.rt.fixtures.afterReady(), /no fixture active/)
    h.begin()
    assert.throws(() => h.begin(), /still active/)
    h.rt.fixtures.end()
  } finally {
    h.restore()
  }
})

test('every fixture name has a definition and files that exist', async () => {
  const fs = await import('fs')
  const path = await import('path')
  assert.deepEqual(Object.keys(definitions).sort(), Object.keys(FIXTURES).sort())
  for (const f of Object.values(FIXTURES)) {
    for (const file of f.files) assert.ok(fs.existsSync(path.join(import.meta.dirname, file)), file)
  }
})

test('the device fixture rewrites last-used times from the frozen clock, in device ID order', () => {
  const rule = definitions['device-last-used'].rpc[0]!
  assert.ok('transform' in rule)
  const dev = (deviceID: string, lastUsedTime: number) => ({device: {deviceID, lastUsedTime}})
  const out = rule.transform([dev('b', 1), dev('a', 2), dev('c', 3)], undefined, {args: {}, now: 10_000_000_000}) as Array<{
    device: {deviceID: string; lastUsedTime: number}
  }>
  const ago = Object.fromEntries(out.map(d => [d.device.deviceID, 10_000_000_000 - d.device.lastUsedTime]))
  assert.deepEqual(ago, {a: 5 * 60 * 1000, b: 3 * 60 * 60 * 1000, c: 4 * 24 * 60 * 60 * 1000})
  assert.equal(rule.transform(null, undefined, {args: {}, now: 0}), null)
})
