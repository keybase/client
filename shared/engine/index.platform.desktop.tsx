import logger from '../logger'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {socketPath} from '@/constants/platform.desktop'
import {printRPCBytes} from '../local-debug'
import type {createClientType, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'
import KB2 from '../util/electron.desktop'

const {engineSend, ipcRendererOn, mainWindowDispatchEngineIncoming} = KB2.functions
const {isRenderer} = KB2.constants

// used by node
class NativeTransport extends TransportShared {
  constructor(
    incomingRPCCallback: incomingRPCCallbackType,
    connectCallback?: connectDisconnectCB,
    disconnectCallback?: connectDisconnectCB
  ) {
    super({path: socketPath}, connectCallback, disconnectCallback, incomingRPCCallback)
    this.needsConnect = true
  }

  _connect_critical_section(cb: unknown) {
    super._connect_critical_section(cb)
  }

  // Override Transport._raw_write -- see transport.iced in framed-msgpack-rpc.
  _raw_write(msg: string, encoding: 'binary') {
    if (printRPCBytes) {
      logger.debug('[RPC] Writing', msg.length)
    }
    super._raw_write(msg, encoding)
  }

  // Override Packetizer.packetize_data -- see packetizer.iced in framed-msgpack-rpc.
  packetize_data(m: Uint8Array) {
    if (printRPCBytes) {
      logger.debug('[RPC] Read', m.length)
    }
    mainWindowDispatchEngineIncoming(m)
  }
}

class ProxyNativeTransport extends TransportShared {
  constructor(
    incomingRPCCallback: incomingRPCCallbackType,
    connectCallback?: connectDisconnectCB,
    disconnectCallback?: connectDisconnectCB
  ) {
    super({}, connectCallback, disconnectCallback, incomingRPCCallback)

    // We're connected locally so we never get disconnected
    this.needsConnect = false
  }

  // We're always connected, so call the callback
  connect(cb: (err?: any) => void) {
    cb()
  }
  is_connected() {
    return true
  }

  // Override and disable some built in stuff in TransportShared
  reset() {}
  close() {}
  get_generation() {
    return 1
  }

  send(msg: unknown) {
    engineSend?.(msg as Uint8Array)
    return true
  }
}

function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
) {
  if (!isRenderer) {
    return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
  } else {
    const client = sharedCreateClient(
      new ProxyNativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
    )

    // plumb back data from the node side
    ipcRendererOn?.('engineIncoming', (_e, data: Uint8Array) => {
      try {
        client.transport.packetize_data(data)
      } catch (e) {
        logger.error('>>>> rpcOnJs JS thrown!', e)
      }
    })

    return client
  }
}

function resetClient(client: createClientType) {
  client.transport.reset()
}

export {resetClient, createClient, rpcLog}
