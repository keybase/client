// An in-memory service for tests, standing where the desktop relay and the service are. The real
// Engine, Session, listener and RPCTransport all run. What crosses between them goes as it does on
// the desktop wire: msgpack-encoded when sent, so nothing is shared by reference and undefined
// arrives as null, and delivered in order one macrotask later each way, as Electron IPC delivers.
import {decode, encode} from '@msgpack/msgpack'
import {Engine, type MakeClient} from '@/engine'
import {getCallPort, hasCallPort, installCallPort, uninstallCallPort, type CallPort} from '@/engine/call-port'
import {TransportShared} from '@/engine/transport-shared'
import {
  MESSAGE_TYPE_CANCEL,
  MESSAGE_TYPE_INVOKE,
  MESSAGE_TYPE_NOTIFY,
  MESSAGE_TYPE_RESPONSE,
  encodeFrame,
  makeDisconnectError,
  type ConnectDisconnectCB,
  type IncomingRPCCallbackType,
  type InvokeType,
  type RPCMessage,
} from '@/engine/rpc-transport'
import {useWaitingState} from '@/stores/waiting'
import {StatusCode} from '@/constants/rpc/rpc-gen'
import type * as EngineGen from '@/constants/rpc'
import {IpcChannel} from './ipc-channel'

const fakeErrorBrand = Symbol('fakeError')
type FakeError = {[fakeErrorBrand]: true; error: {code: number; desc: string}}
// Fails a scripted or held call with this error. Only a value made here is sent as an error.
export const fakeError = (code: number, desc: string): FakeError => ({[fakeErrorBrand]: true, error: {code, desc}})
// The call's result, or a fakeError() to fail it. An answer may also return a Promise of one.
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
  // The service cancels every push of `method` the GUI has not answered; each settles as cancelled.
  cancelPush: (method: string) => void
  // Every call the service received, as it decoded it
  calls: Array<{method: string; params: any}>
  // The service's connection closed. The service is gone at once; the renderer hears a turn later.
  drop: () => void
  // The relay reached the service again. The renderer hears a turn later. Not after an engine
  // reset: the relay then stays off the service until the renderer reloads.
  restart: () => void
  // Whether the renderer's transport thinks the link is up
  connected: () => boolean
}

const unscriptedCode = 100

const isFakeError = (a: unknown): a is FakeError => typeof a === 'object' && a !== null && fakeErrorBrand in a

// The Engine logs on every link change; keep that out of test output.
const quietly = (f: () => void) => {
  const {log, warn} = console
  console.log = () => {}
  console.warn = () => {}
  try {
    f()
  } finally {
    console.log = log
    console.warn = warn
  }
}

class FakeTransport extends TransportShared {
  private _onWrite: (m: RPCMessage) => void
  private _onReset: () => void

  constructor(
    onWrite: (m: RPCMessage) => void,
    onReset: () => void,
    incoming: IncomingRPCCallbackType,
    connect: ConnectDisconnectCB,
    disconnect: ConnectDisconnectCB
  ) {
    super(incoming, connect, disconnect, true)
    this._onWrite = onWrite
    this._onReset = onReset
  }

  // What the service decodes is what msgpack made of the message when it was sent
  protected writeMessage(m: RPCMessage) {
    this._onWrite(decode(encode(m)) as RPCMessage)
  }

  // The renderer transport's path for the bytes the relay forwards: dropped while the link is down
  deliver(bytes: Uint8Array) {
    if (this.isLinkUp) {
      this.packetizeData(bytes)
    }
  }

  linkDown() {
    this.markLinkDown()
  }

  linkUp() {
    this.markLinkUp()
  }

  // Engine.reset: the renderer asks the relay to drop its link (engineDropLink)
  override reset() {
    this._onReset()
  }
}

type Installed = {
  previousPort: CallPort | undefined
  failures: Array<string>
  // Fails everything still in flight and stops the transport, so nothing settles into a later test.
  shutdown: () => void
}

let installed: Installed | undefined

export const installFakeEngine = (opts?: {onEngineIncoming?: (a: EngineGen.Actions) => void}): FakeEngine => {
  if (installed) {
    throw new Error('fake engine: installFakeEngine called while one is already installed')
  }
  const previousPort = hasCallPort() ? getCallPort() : undefined

  const scripts = new Map<
    string,
    {kind: 'answer'; reply: (params: any) => FakeAnswer} | {kind: 'hold'; held: Array<HeldCall>}
  >()
  const pushes = new Map<number, (r: PushResult) => void>()
  // Every push ever sent, so a late or duplicate GUI answer can be named
  const pushMethods = new Map<number, string>()
  const failures: Array<string> = []
  const calls: FakeEngine['calls'] = []
  // Never reset on restart(): seqids stay unique across restarts so a stale GUI answer is detectable
  let nextPushSeqid = 1
  let transport: FakeTransport | undefined
  let dead = false
  const toService = new IpcChannel()
  const toRenderer = new IpcChannel()
  // The service's connection, as the relay counts them (its epoch), and the one the renderer last
  // heard come up. The relay drops a send stamped with a connection that is no longer current.
  let serviceConnection = 1
  let serviceUp = true
  let rendererConnection = 1
  // After an engine reset the relay stays off the service until the renderer reloads
  let relayDropped = false

  const getTransport = () => {
    if (!transport) throw new Error('fake engine: the engine never created its client')
    return transport
  }

  // The service writes a message on its current connection; the relay forwards its bytes
  const serviceSends = (m: RPCMessage) => {
    const bytes = encodeFrame(m)
    toRenderer.send(() => getTransport().deliver(bytes))
  }

  const onInvoke = (seqid: number, method: string, params: any) => {
    calls.push({method, params})
    const connection = serviceConnection
    const reply = (a: FakeAnswer) => {
      // The real service forgets its calls when the link dies, so a late reply goes nowhere
      if (dead || !serviceUp || connection !== serviceConnection) return
      serviceSends(
        isFakeError(a) ? [MESSAGE_TYPE_RESPONSE, seqid, a.error, null] : [MESSAGE_TYPE_RESPONSE, seqid, null, a]
      )
    }
    const script = scripts.get(method)
    if (!script) {
      failures.push(method)
      reply(fakeError(unscriptedCode, `fake engine: nothing scripted for ${method}`))
    } else if (script.kind === 'hold') {
      script.held.push({params, reply})
    } else {
      Promise.resolve()
        .then(() => script.reply(params))
        .then(reply)
        .catch((e: unknown) => {
          const failure = `${method} (its answer threw: ${e instanceof Error ? e.message : String(e)})`
          if (dead) {
            // Uninstall has already reported; fail whichever test is running now (fail-on-console)
            console.error(`fake engine: an answer threw after uninstall: ${failure}`)
            return
          }
          failures.push(failure)
          reply(fakeError(unscriptedCode, `fake engine: the answer for ${method} threw`))
        })
    }
  }

  const serviceReceives = (m: RPCMessage) => {
    const [type, ...rest] = m
    if (type === MESSAGE_TYPE_INVOKE) {
      const [seqid, method, args] = rest as [number, string, [unknown]]
      onInvoke(seqid, method, args[0])
    } else if (type === MESSAGE_TYPE_RESPONSE) {
      const [seqid, error, result] = rest as [number, unknown, unknown]
      const settle = pushes.get(seqid)
      if (!settle) {
        const method = pushMethods.get(seqid)
        failures.push(
          method
            ? `GUI answered push seqid ${seqid} (${method}) when it was no longer waiting`
            : `GUI answered seqid ${seqid}, which no push sent`
        )
        return
      }
      pushes.delete(seqid)
      settle(error ? {error} : {result})
    }
  }

  // engineSend: the relay drops a send made on a connection that has since gone
  const onWrite = (m: RPCMessage) => {
    const connection = rendererConnection
    toService.send(() => {
      if (serviceUp && connection === serviceConnection) {
        serviceReceives(m)
      }
    })
  }

  // The relay's link frames ride the same channel as the service's bytes; ProxyNativeTransport
  // ignores a stale one
  const sendLinkFrame = (up: boolean) => {
    const connection = serviceConnection
    toRenderer.send(() => {
      const t = getTransport()
      const endsCurrentLink = up ? connection !== rendererConnection : connection === rendererConnection
      quietly(() => {
        if (t.isLinkUp && endsCurrentLink) {
          t.linkDown()
        }
        if (up && !t.isLinkUp) {
          rendererConnection = connection
          t.linkUp()
        }
      })
    })
  }

  const serviceGone = () => {
    if (!serviceUp) return
    serviceUp = false
    // The GUI's answer to a push can no longer reach the service, so settle those pushes here, with
    // the error the transport gives its own calls on a lost link
    const settles = [...pushes.values()]
    pushes.clear()
    settles.forEach(settle => settle({error: makeDisconnectError()}))
    sendLinkFrame(false)
  }

  // EngineRelay.dropLink, reached over IPC
  const onReset = () => {
    toService.send(() => {
      relayDropped = true
      serviceGone()
    })
  }

  const makeClient: MakeClient = (incoming, connect, disconnect) => {
    const t = new FakeTransport(onWrite, onReset, incoming, connect, disconnect)
    transport = t
    return {invoke: t.invoke.bind(t) as InvokeType, transport: t}
  }

  const engine = new Engine(
    changes => useWaitingState.getState().dispatch.batch(changes),
    () => {},
    opts?.onEngineIncoming,
    makeClient
  )
  engine.onUndeclaredIncoming = message => failures.push(message)

  const fake: FakeEngine = {
    answer: (method, reply) => {
      scripts.set(method, {kind: 'answer', reply})
    },
    calls,
    cancelPush: method => {
      const seqids = [...pushes.keys()].filter(seqid => pushMethods.get(seqid) === method)
      if (!seqids.length) {
        throw new Error(`fake engine: no pending ${method} push to cancel`)
      }
      for (const seqid of seqids) {
        const settle = pushes.get(seqid)
        pushes.delete(seqid)
        serviceSends([MESSAGE_TYPE_CANCEL, seqid])
        settle?.({error: {code: StatusCode.sccanceled, desc: 'fake engine: the service cancelled it'}})
      }
    },
    connected: () => getTransport().isLinkUp,
    drop: serviceGone,
    engine,
    hold: method => {
      const held: Array<HeldCall> = []
      scripts.set(method, {held, kind: 'hold'})
      return held
    },
    push: async (method, params, o) => {
      if (dead || !serviceUp) {
        throw new Error(`fake engine: cannot push ${method} while the link is down`)
      }
      const param = [o?.sessionID === undefined ? params : {...params, sessionID: o.sessionID}]
      if (o?.oneway) {
        serviceSends([MESSAGE_TYPE_NOTIFY, method, param])
        return {}
      }
      const seqid = nextPushSeqid++
      return new Promise<PushResult>(resolve => {
        pushes.set(seqid, resolve)
        pushMethods.set(seqid, method)
        serviceSends([MESSAGE_TYPE_INVOKE, seqid, method, param])
      })
    },
    restart: () => {
      if (relayDropped) {
        throw new Error('fake engine: after an engine reset the link stays down until the renderer reloads')
      }
      if (serviceUp) {
        throw new Error('fake engine: restart while the link is up')
      }
      serviceUp = true
      serviceConnection += 1
      sendLinkFrame(true)
    },
  }

  const shutdown = () => {
    // What the GUI already sent still reaches the service, so the strict check below sees it
    toService.deliverAll()
    dead = true
    serviceGone()
    toRenderer.clear()
    const t = getTransport()
    if (t.isLinkUp) {
      quietly(() => t.linkDown())
    }
    // Refuses any call made after uninstall
    t.close()
    engine._throttledDispatchWaitingAction.flush()
  }

  installed = {failures, previousPort, shutdown}
  installCallPort(engine)
  return fake
}

// Fails everything still in flight, then throws, naming each, if any call reached the fake with
// nothing scripted, an answer threw, the GUI answered a push that was not waiting, or a listener got
// an incoming method it neither handles nor declared as left to global handling.
export const uninstallFakeEngine = () => {
  const i = installed
  if (!i) return
  installed = undefined
  try {
    i.shutdown()
  } finally {
    if (i.previousPort) {
      installCallPort(i.previousPort)
    } else {
      uninstallCallPort()
    }
  }
  if (i.failures.length) {
    throw new Error(`fake engine: traffic the test did not script:\n  ${[...new Set(i.failures)].join('\n  ')}`)
  }
}

// Every test file that uses the fake gets the strict check, even when a test forgets to uninstall
// or throws before it does.
afterEach(() => uninstallFakeEngine())
