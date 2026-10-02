// The desktop engine as the app wires it: the renderer's engine talks over IPC to the node process's
// relay, which owns the unix socket to the service. The renderer runs the real Engine and
// ProxyNativeTransport, node the real EngineRelay; only the socket and the Electron IPC between the
// two processes are stood in for.
import {EventEmitter} from 'events'
import {setImmediate} from 'node:timers'
import {decodeMulti} from '@msgpack/msgpack'
import {Engine} from '@/engine'
import {EngineRelay} from '@/desktop/app/engine-relay.desktop'
import {encodeFrame, type RPCMessage} from '@/engine/rpc-transport'
import type {CreateClientType} from '@/engine/index.platform'
import type {KB2} from '@/util/electron'

class MockSocket extends EventEmitter {
  written = new Array<Uint8Array>()
  destroyed = false
  write(b: Uint8Array) {
    this.written.push(b)
    return true
  }
  destroy() {
    this.destroyed = true
  }
}

// The relay opens a fresh socket on every (re)connect
const mockSockets = new Array<MockSocket>()
jest.mock('net', () => ({
  connect: () => {
    const socket = new MockSocket()
    mockSockets.push(socket)
    return socket
  },
}))

// EngineRelay's reconnect timer
const reconnectDelayMs = 1000

export type DesktopEnginePair = {
  renderer: CreateClientType
  // The service process exits: the node socket closes.
  serviceDies: () => void
  // A new service is up and node's reconnect reaches it. Takes the reconnect delay, so anything
  // still crossing IPC arrives first.
  serviceComesBack: () => void
  // Every message the running service has received on its socket.
  serviceReceived: () => Array<RPCMessage>
  // The running service writes a message to its socket.
  serviceSends: (message: RPCMessage) => void
  // Each time the renderer engine told the app the link went up (true) or down (false).
  linkChanges: Array<boolean>
  // The renderer's app says its listeners are ready again, as an HMR reload does.
  listenersReadyAgain: () => void
}

let teardown: (() => void) | undefined

export const makeDesktopEnginePair = (): DesktopEnginePair => {
  if (teardown) {
    throw new Error('desktop engine pair: one is already made in this test')
  }
  const preload = globalThis._fromPreload as KB2
  const {functions} = preload
  const made: {renderer?: Engine} = {}
  // Electron IPC is asynchronous both ways: what one process sends arrives a turn later, in order.
  // So a renderer call can reach the relay after the socket died but before the renderer has heard.
  const inTransit = new Array<() => void>()
  // Set before anything global changes, so a setup that throws part way is still undone
  teardown = () => {
    try {
      inTransit.length = 0
      made.renderer?._rpcClient.transport.reset()
    } finally {
      preload.functions = functions
      jest.useRealTimers()
      mockSockets.length = 0
    }
  }
  jest.useFakeTimers({doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate']})
  mockSockets.length = 0

  const currentSocket = () => {
    const s = mockSockets.at(-1)
    if (!s) throw new Error('desktop engine pair: node never opened a socket')
    return s
  }

  const deliverNext = () => inTransit.shift()?.()
  const overIPC = (deliver: () => void) => {
    inTransit.push(deliver)
    setImmediate(deliverNext)
  }
  const deliverAll = () => {
    while (inTransit.length) {
      deliverNext()
    }
  }

  let rendererIncoming: ((e: unknown, data: unknown) => void) | undefined
  // preload: node forwards the service's bytes and the relay's link frames to the main window's
  // 'engineIncoming'
  const relay = new EngineRelay(data => overIPC(() => rendererIncoming?.(undefined, data)))

  preload.functions = {
    ...functions,
    // ipc-handlers.desktop.tsx: the renderer's engineSend lands on the relay
    engineSend: send => overIPC(() => relay.send(send)),
    ipcRendererOn: (channel, cb) => {
      if (channel === 'engineIncoming') {
        rendererIncoming = cb
      }
      return undefined
    },
  }

  const linkChanges = new Array<boolean>()
  const renderer = new Engine(
    () => {},
    up => linkChanges.push(up)
  )
  made.renderer = renderer

  // As the app boots: the service is up, the renderer starts (node replays the link state to it),
  // then the renderer's listeners are ready
  currentSocket().emit('connect')
  relay.replayLinkState()
  deliverAll()
  renderer.listenersAreReady()

  return {
    linkChanges,
    listenersReadyAgain: () => renderer.listenersAreReady(),
    renderer: renderer._rpcClient,
    serviceComesBack: () => {
      deliverAll()
      const before = mockSockets.length
      jest.advanceTimersByTime(reconnectDelayMs)
      if (mockSockets.length !== before + 1) {
        throw new Error('desktop engine pair: node did not reconnect')
      }
      currentSocket().emit('connect')
    },
    serviceDies: () => {
      currentSocket().emit('close')
    },
    serviceReceived: () => {
      const bytes = Buffer.concat(currentSocket().written)
      // Each frame is a msgpack uint32 length followed by the message, so the stream decodes as
      // alternating lengths and messages
      return [...decodeMulti(bytes)].filter((m): m is RPCMessage => Array.isArray(m))
    },
    serviceSends: message => {
      currentSocket().emit('data', Buffer.from(encodeFrame(message)))
    },
  }
}

const teardownDesktopEnginePair = () => {
  const t = teardown
  teardown = undefined
  t?.()
}

afterEach(() => teardownDesktopEnginePair())
