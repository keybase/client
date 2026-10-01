// An in-memory service for tests. It sits where the platform transport would and speaks decoded
// msgpack-rpc messages, so the real Engine, Session, listener and RPCTransport all run.
import {Engine, type MakeClient} from '@/engine'
import {getCallPort, hasCallPort, installCallPort, uninstallCallPort, type CallPort} from '@/engine/call-port'
import {TransportShared} from '@/engine/transport-shared'
import {
  MESSAGE_TYPE_INVOKE,
  MESSAGE_TYPE_NOTIFY,
  MESSAGE_TYPE_RESPONSE,
  errors,
  type ConnectDisconnectCB,
  type IncomingRPCCallbackType,
  type InvokeType,
  type RPCMessage,
} from '@/engine/rpc-transport'
import {useWaitingState} from '@/stores/waiting'
import type * as EngineGen from '@/constants/rpc'

type FakeError = {error: {code: number; desc: string}}
// The call's result, or a FakeError to fail it. An answer may also return a Promise of one.
export type FakeAnswer = unknown
type HeldCall = {params: any; reply: (a: FakeAnswer) => void}
type PushResult = {error?: unknown; result?: unknown}

export type FakeEngine = {
  engine: Engine
  // Scripts the service's reply for every call of `method` until replaced.
  answer: (method: string, reply: (params: any) => FakeAnswer) => void
  // Holds calls of `method` until the test releases them; returns the held calls.
  hold: (method: string) => Array<HeldCall>
  // The service calls the GUI (prompt or notification). Resolves with what the GUI answered.
  push: (method: string, params: object, opts?: {sessionID?: number; oneway?: boolean}) => Promise<PushResult>
  calls: Array<{method: string; params: any}>
  drop: () => void // the link died: transport onDisconnected
  restart: () => void // the link came back: transport onConnected
  connected: () => boolean
}

const unscriptedCode = 100

const isFakeError = (a: unknown): a is FakeError => {
  if (typeof a !== 'object' || a === null || !('error' in a)) return false
  const {error} = a as {error: unknown}
  return typeof error === 'object' && error !== null && 'code' in error
}

class FakeTransport extends TransportShared {
  linkUp = true
  private _onWrite: (m: RPCMessage) => void

  constructor(
    onWrite: (m: RPCMessage) => void,
    incoming: IncomingRPCCallbackType,
    connect: ConnectDisconnectCB,
    disconnect: ConnectDisconnectCB
  ) {
    super(connect, disconnect, incoming)
    this._onWrite = onWrite
  }

  protected override isConnected() {
    return this.linkUp
  }

  protected writeMessage(m: RPCMessage) {
    this._onWrite(m)
  }

  deliver(m: RPCMessage) {
    this.dispatchDecodedMessage(m)
  }

  drop() {
    this.linkUp = false
    this.onDisconnected()
  }

  restart() {
    this.linkUp = true
    this.onConnected()
  }
}

type Installed = {
  fake: FakeEngine
  previousPort: CallPort | undefined
  failures: Array<string>
}

let installed: Installed | undefined

const teardown = (i: Installed) => {
  installed = undefined
  i.fake.engine._throttledDispatchWaitingAction.flush()
  if (i.previousPort) {
    installCallPort(i.previousPort)
  } else {
    uninstallCallPort()
  }
}

export const installFakeEngine = (opts?: {onEngineIncoming?: (a: EngineGen.Actions) => void}): FakeEngine => {
  const previous = installed
  if (previous) {
    teardown(previous)
  }
  const previousPort = previous ? previous.previousPort : hasCallPort() ? getCallPort() : undefined

  const scripts = new Map<
    string,
    {kind: 'answer'; reply: (params: any) => FakeAnswer} | {kind: 'hold'; held: Array<HeldCall>}
  >()
  const pushes = new Map<number, (r: PushResult) => void>()
  const failures: Array<string> = []
  const calls: FakeEngine['calls'] = []
  let nextPushSeqid = 1
  let transport: FakeTransport | undefined

  const getTransport = () => {
    if (!transport) throw new Error('fake engine: the engine never created its client')
    return transport
  }

  const onInvoke = (seqid: number, method: string, params: any) => {
    calls.push({method, params})
    const t = getTransport()
    const reply = (a: FakeAnswer) => {
      queueMicrotask(() => {
        t.deliver(isFakeError(a) ? [MESSAGE_TYPE_RESPONSE, seqid, a.error, null] : [MESSAGE_TYPE_RESPONSE, seqid, null, a])
      })
    }
    const script = scripts.get(method)
    if (!script) {
      failures.push(method)
      reply({error: {code: unscriptedCode, desc: `fake engine: nothing scripted for ${method}`}})
    } else if (script.kind === 'hold') {
      script.held.push({params, reply})
    } else {
      Promise.resolve()
        .then(() => script.reply(params))
        .then(reply)
        .catch((e: unknown) => {
          failures.push(`${method} (its answer threw: ${e instanceof Error ? e.message : String(e)})`)
          reply({error: {code: unscriptedCode, desc: `fake engine: the answer for ${method} threw`}})
        })
    }
  }

  const onWrite = (m: RPCMessage) => {
    const [type, ...rest] = m
    if (type === MESSAGE_TYPE_INVOKE) {
      const [seqid, method, args] = rest as [number, string, [unknown]]
      onInvoke(seqid, method, args[0])
    } else if (type === MESSAGE_TYPE_RESPONSE) {
      const [seqid, error, result] = rest as [number, unknown, unknown]
      const settle = pushes.get(seqid)
      pushes.delete(seqid)
      settle?.(error ? {error} : {result})
    }
  }

  const makeClient: MakeClient = (incoming, connect, disconnect) => {
    const t = new FakeTransport(onWrite, incoming, connect, disconnect)
    transport = t
    return {invoke: t.invoke.bind(t) as InvokeType, transport: t}
  }

  const engine = new Engine(
    changes => useWaitingState.getState().dispatch.batch(changes),
    () => {},
    opts?.onEngineIncoming,
    makeClient
  )

  const fake: FakeEngine = {
    answer: (method, reply) => {
      scripts.set(method, {kind: 'answer', reply})
    },
    calls,
    connected: () => getTransport().linkUp,
    drop: () => {
      // The GUI's answer to a push can no longer reach the service, so settle those pushes here.
      const settles = [...pushes.values()]
      pushes.clear()
      getTransport().drop()
      settles.forEach(settle => settle({error: {code: errors.EOF, desc: 'fake engine: link dropped'}}))
    },
    engine,
    hold: method => {
      const held: Array<HeldCall> = []
      scripts.set(method, {held, kind: 'hold'})
      return held
    },
    push: async (method, params, o) => {
      const t = getTransport()
      if (!t.linkUp) {
        throw new Error(`fake engine: cannot push ${method} while the link is down`)
      }
      const param = [o?.sessionID === undefined ? params : {...params, sessionID: o.sessionID}]
      if (o?.oneway) {
        t.deliver([MESSAGE_TYPE_NOTIFY, method, param])
        return {}
      }
      const seqid = nextPushSeqid++
      return new Promise<PushResult>(resolve => {
        pushes.set(seqid, resolve)
        t.deliver([MESSAGE_TYPE_INVOKE, seqid, method, param])
      })
    },
    restart: () => getTransport().restart(),
  }

  installed = {fake, previousPort, failures}
  installCallPort(engine)
  return fake
}

// Throws, listing each method, if any call reached the fake with nothing scripted or its answer threw.
export const uninstallFakeEngine = () => {
  const i = installed
  if (!i) return
  teardown(i)
  if (i.failures.length) {
    throw new Error(
      `fake engine: calls that got no scripted answer:\n  ${[...new Set(i.failures)].join('\n  ')}`
    )
  }
}
