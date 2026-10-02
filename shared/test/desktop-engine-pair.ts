// The desktop engine as the app wires it: the renderer's engine talks over IPC to the node
// process's engine, which owns the unix socket to the service. Both are the real Engine and
// platform transports (ProxyNativeTransport in the renderer, NativeTransport in node); only the
// socket and the Electron IPC between the two processes are stood in for.
import {EventEmitter} from 'events'
import {decodeMulti} from '@msgpack/msgpack'
import {Engine} from '@/engine'
import type {CreateClientType} from '@/engine/index.platform'
import type {RPCMessage} from '@/engine/rpc-transport'
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

// NativeTransport requires 'net' lazily on every connect, so each (re)connect gets a fresh socket
const mockSockets = new Array<MockSocket>()
jest.mock('net', () => ({
  connect: () => {
    const socket = new MockSocket()
    mockSockets.push(socket)
    return socket
  },
}))

// NativeTransport's reconnect timer
const reconnectDelayMs = 1000

export type DesktopEnginePair = {
  renderer: CreateClientType
  // The service process exits: the node socket closes.
  serviceDies: () => void
  // A new service is up and node's reconnect reaches it.
  serviceComesBack: () => void
  // Every message the running service has received on its socket.
  serviceReceived: () => Array<RPCMessage>
}

let teardown: (() => void) | undefined

export const makeDesktopEnginePair = (): DesktopEnginePair => {
  if (teardown) {
    throw new Error('desktop engine pair: one is already made in this test')
  }
  const preload = globalThis._fromPreload as KB2
  const {functions} = preload
  const {isRenderer} = preload.constants
  jest.useFakeTimers({doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate']})
  mockSockets.length = 0

  const currentSocket = () => {
    const s = mockSockets.at(-1)
    if (!s) throw new Error('desktop engine pair: node never opened a socket')
    return s
  }

  // In the app node.desktop.tsx sends this to the renderer as RemoteGen.engineConnection, and
  // remote-event-handler hands it to onEngineConnected/onEngineDisconnected. Those drive app stores
  // (daemon handshake, UI registration) and never reach the renderer's engine or transport. The
  // stores are left out here because their handshake RPCs would reach the service, so the signal
  // stops at the renderer's door, as it does at the engine layer in the app.
  const deliverEngineConnectionToRenderer = (_connected: boolean) => {}

  preload.constants.isRenderer = false
  const nodeEngine = new Engine(() => {}, deliverEngineConnectionToRenderer)
  preload.constants.isRenderer = true

  let rendererIncoming: ((e: unknown, data: unknown) => void) | undefined
  preload.functions = {
    ...functions,
    // ipc-handlers.desktop.tsx: the renderer's engineSend lands as a raw send on node's transport
    engineSend: m => {
      nodeEngine._rpcClient.transport.send(m)
    },
    ipcRendererOn: (channel, cb) => {
      if (channel === 'engineIncoming') {
        rendererIncoming = cb
      }
    },
    // preload: node forwards the service's bytes untouched to the main window's 'engineIncoming'
    mainWindowDispatchEngineIncoming: data => rendererIncoming?.(undefined, data),
  }

  const rendererEngine = new Engine(
    () => {},
    () => {}
  )

  currentSocket().emit('connect')

  teardown = () => {
    rendererEngine._rpcClient.transport.reset()
    nodeEngine._rpcClient.transport.close()
    preload.constants.isRenderer = isRenderer
    preload.functions = functions
    jest.useRealTimers()
    mockSockets.length = 0
  }

  return {
    renderer: rendererEngine._rpcClient,
    serviceComesBack: () => {
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
  }
}

const teardownDesktopEnginePair =() => {
  const t = teardown
  teardown = undefined
  t?.()
}

afterEach(() => teardownDesktopEnginePair())
