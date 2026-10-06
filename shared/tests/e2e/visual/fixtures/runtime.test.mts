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
  const installed: Array<boolean> = []
  const rt = createRuntime({
    forget: key => registry.delete(key),
    install: r => {
      installed.push(r === rt.rpc)
    },
    inject: p => {
      injected.push(rt.rpc.incoming(p, {customResponse: false, inSession: false}) ?? {method: 'dropped', param: []})
    },
    now: () => 1_000_000,
    stores: {get: key => registry.get(key)},
  })
  return {
    begin: (args: Record<string, unknown> = {}) => rt.fixtures.begin(name, args),
    injected,
    installed,
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
  for (const m of ['keybase.1.teams.teamAddMember', 'keybase.1.SimpleFS.simpleFSRemove', 'chat.1.local.postTextNonblock', 'keybase.1.config.guiSetValue', 'keybase.1.user.setUserBlocks', 'keybase.1.teams.teamCreate', 'chat.1.local.deleteConversationLocal', 'chat.1.local.markAsReadLocal']) {
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
    assert.deepEqual(h.rt.fixtures.end(), {cancelledReplies: [], failedFollowUps: [], failedTransforms: [], refusedWrites: [], storesNotRestored: [], teardown: 'remount'})
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

test('a follow-up is delivered on the tick after each of its incoming calls, and never after end', async () => {
  const h = harness({
    follow: [{after: 'a.1.x.thread', method: 'a.1.x.status', param: ctx => ({at: ctx.now})}],
    hold: true,
    rpc: [],
    teardown: 'remount',
  })
  try {
    h.begin()
    const thread = {method: 'a.1.x.thread', param: [{sessionID: 1}]}
    h.rt.rpc.incoming(thread, {customResponse: false, inSession: true})
    h.rt.rpc.incoming(thread, {customResponse: false, inSession: true})
    assert.deepEqual(h.injected, [])
    await tick()
    // held notifications drop, but a follow-up passes
    const status = {method: 'a.1.x.status', param: [{at: 1_000_000}]}
    assert.deepEqual(h.injected, [status, status])
    h.rt.fixtures.end()
    h.begin()
    h.rt.rpc.incoming(thread, {customResponse: false, inSession: true})
    h.rt.fixtures.end()
    await tick()
    assert.equal(h.injected.length, 2)
  } finally {
    h.restore()
  }
})
test("a follow-up whose payload throws is reported by end, and the incoming call it follows still passes", async () => {
  const h = harness({
    follow: [
      {
        after: 'a.1.x.thread',
        method: 'a.1.x.status',
        param: () => {
          throw new Error('no conversationIDKey')
        },
      },
    ],
    rpc: [],
    teardown: 'remount',
  })
  try {
    h.begin()
    const thread = {method: 'a.1.x.thread', param: [{sessionID: 1}]}
    assert.equal(h.rt.rpc.incoming(thread, {customResponse: false, inSession: true}), thread)
    await tick()
    assert.deepEqual(h.injected, [])
    assert.deepEqual(h.rt.fixtures.end().failedFollowUps, ['after a.1.x.thread: no conversationIDKey'])
  } finally {
    h.restore()
  }
})

test('a rewrite that throws is reported by end, and the call goes on unchanged', () => {
  const h = harness({
    incoming: [
      {
        method: 'a.1.x.thread',
        transform: () => {
          throw new Error('no message of testuser')
        },
      },
    ],
    rpc: [
      {
        method: 'a.1.x.get',
        required: true,
        transform: () => {
          throw new Error('no rows')
        },
      },
    ],
    teardown: 'remount',
  })
  try {
    h.begin()
    const thread = {method: 'a.1.x.thread', param: [{sessionID: 1, thread: 'live'}]}
    assert.deepEqual(h.rt.rpc.incoming(thread, {customResponse: false, inSession: true}), thread)
    const {c} = call(h.rt, 'a.1.x.get')
    assert.deepEqual([c.err, c.result], [undefined, 'live'])
    assert.deepEqual(h.rt.fixtures.end().failedTransforms, ['a.1.x.thread: no message of testuser', 'a.1.x.get: no rows'])
  } finally {
    h.restore()
  }
})

test('a follow-up the app fails to take is reported by end', async () => {
  const name = 'device-last-used'
  const saved = definitions[name]
  ;(definitions as Record<string, FixtureDef>)[name] = {
    follow: [{after: 'a.1.x.thread', method: 'a.1.x.status', param: () => ({})}],
    rpc: [],
    teardown: 'remount',
  }
  try {
    const rt = createRuntime({
      forget: () => {},
      inject: () => {
        throw new Error('handler threw')
      },
      install: () => {},
      now: () => 1,
      stores: {get: () => undefined},
    })
    rt.fixtures.begin(name, {})
    rt.rpc.incoming({method: 'a.1.x.thread', param: [{sessionID: 1}]}, {customResponse: false, inSession: true})
    await tick()
    assert.deepEqual(rt.fixtures.end().failedFollowUps, ['after a.1.x.thread: handler threw'])
  } finally {
    ;(definitions as Record<string, FixtureDef>)[name] = saved
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
    assert.deepEqual(h.rt.fixtures.end(), {cancelledReplies: [], failedFollowUps: [], failedTransforms: [], refusedWrites: [], storesNotRestored: [], teardown: 'remount'})
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

test('the engine hook is installed only while a fixture is active', () => {
  const h = harness({rpc: [], teardown: 'remount'})
  try {
    assert.deepEqual(h.installed, [])
    h.begin()
    assert.deepEqual(h.installed, [true])
    h.rt.fixtures.end()
    assert.deepEqual(h.installed, [true, false])
  } finally {
    h.restore()
  }
})

test('a beforeNav that throws leaves the hook installed with its fixture, for end to remove', () => {
  const h = harness({
    beforeNav: () => {
      throw new Error('boom')
    },
    rpc: [],
    teardown: 'remount',
  })
  try {
    assert.throws(() => h.begin(), /boom/)
    assert.ok(h.rt.fixtures.active())
    assert.deepEqual(h.installed, [true])
    h.rt.fixtures.end()
    assert.deepEqual(h.installed, [true, false])
  } finally {
    h.restore()
  }
})

const threadCtx = {args: {bot: 'b', conversationIDKey: 'ab', secondUser: 'testuser-mac', teamname: 't', username: 'testuser'}, now: 1_000_000}

test("the chat thread fixture adds its messages after the thread's newest, in the synthetic ID range", async () => {
  const {chatThreadContent} = await import('./chat-thread.ts')
  const {SYNTHETIC_FIRST} = await import('./chat-thread.ts')
  const image = {
    state: 1,
    valid: {
      assetUrlInfo: {fullUrl: 'f', fullUrlCached: false, inlineVideoPlayable: false, mimeType: 'image/png', previewUrl: 'p'},
      messageBody: {attachment: {object: {filename: 'a.png', metadata: {}}}, messageType: 2},
      messageID: 7,
      senderUsername: 'testuser',
    },
  }
  const ctx = threadCtx
  const rewrite = chatThreadContent.incoming!.find(i => i.method === 'chat.1.chatUi.chatThreadFull')!.transform
  const out = rewrite({sessionID: 1, thread: JSON.stringify({messages: [image], pagination: null})}, ctx) as {sessionID: number; thread: string}
  const messages = (JSON.parse(out.thread) as {messages: Array<{state: number; valid?: {messageID: number}; journeycard?: {ordinal: number}}>}).messages
  assert.equal(out.sessionID, 1)
  const ids = messages.map(m => m.valid?.messageID ?? m.journeycard?.ordinal ?? 0)
  assert.equal(ids.at(-1), 7)
  assert.ok(ids.slice(0, -1).every(i => i >= SYNTHETIC_FIRST))
  // newest first, as the service sends a thread
  assert.deepEqual([...ids].sort((a, b) => b - a), ids)
  const noImage = JSON.stringify({messages: [{...image, valid: {...image.valid, assetUrlInfo: undefined, messageBody: {messageType: 1}}}], pagination: null})
  assert.throws(() => rewrite({thread: noImage}, ctx), /no image in the thread page/)
})

test("the chat thread fixture's messages are the account's, sent like its oldest message, with the oldest image's media", async () => {
  const {chatThreadContent, SYNTHETIC_FIRST} = await import('./chat-thread.ts')
  type Msg = {state: number; valid?: {assetUrlInfo?: {mimeType: string; previewUrl: string}; messageID: number; senderUsername?: string; senderUID?: string; messageBody?: {messageType: number; attachment?: {object: {filename: string}}}}}
  const msg = (messageID: number, senderUsername: string, image?: string): Msg => ({
    state: 1,
    valid: {
      ...(image
        ? {
            assetUrlInfo: {mimeType: 'image/png', previewUrl: image},
            messageBody: {attachment: {object: {filename: image}}, messageType: 2},
          }
        : {messageBody: {messageType: 1}}),
      messageID,
      senderUID: `uid-${messageID}`,
      senderUsername,
    },
  })
  // newest first, as the service sends a thread: the newest image is the other user's
  const real = [msg(9, 'testuser-mac', 'new.png'), msg(8, 'testuser'), msg(5, 'testuser-mac', 'old.png'), msg(3, 'testuser'), msg(2, 'testuser-mac')]
  const rewrite = chatThreadContent.incoming!.find(i => i.method === 'chat.1.chatUi.chatThreadFull')!.transform
  const thread = (messages: Array<Msg>) =>
    (JSON.parse((rewrite({thread: JSON.stringify({messages, pagination: null})}, threadCtx) as {thread: string}).thread) as {messages: Array<Msg>}).messages
  const added = thread(real).filter(m => (m.valid?.messageID ?? 0) >= SYNTHETIC_FIRST)
  // all but the bot's (bot 'b')
  const sent = added.filter(m => m.valid && m.valid.senderUsername !== 'b')
  assert.ok(sent.length > 10)
  assert.ok(sent.every(m => m.valid?.senderUsername === 'testuser' && m.valid.senderUID === 'uid-3'))
  const audio = added.find(m => m.valid?.messageBody?.messageType === 2)
  assert.equal(audio?.valid?.messageBody?.attachment?.object.filename, 'vg-audio.m4a')
  assert.equal(audio.valid.assetUrlInfo?.previewUrl, 'old.png')
  // an order the service never sends changes nothing
  assert.deepEqual(thread([...real].reverse()).filter(m => (m.valid?.messageID ?? 0) >= SYNTHETIC_FIRST), added)
  // nothing of the account's to send as: the fixture cannot draw what it describes
  assert.throws(() => thread([msg(9, 'testuser-mac', 'new.png')]), /no message of testuser in the thread page/)
})
