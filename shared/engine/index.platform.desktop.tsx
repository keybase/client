import net from 'net'
import logger from '../logger'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {isWindows, socketPath} from '../constants/platform.desktop'
import {printRPCBytes} from '../local-debug'
import type {createClientType, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'
const {process} = KB

class NativeTransport extends TransportShared {
  constructor(
    incomingRPCCallback: incomingRPCCallbackType,
    connectCallback?: connectDisconnectCB,
    disconnectCallback?: connectDisconnectCB
  ) {
    console.log('Transport using', socketPath)
    super({path: socketPath}, connectCallback, disconnectCallback, incomingRPCCallback)
    this.needsConnect = true
  }

  _connect_critical_section(cb: unknown) {
    super._connect_critical_section(cb)
    windowsHack()
  }

  // Override Transport._raw_write -- see transport.iced in
  // framed-msgpack-rpc.
  _raw_write(msg: string, encoding: 'binary') {
    if (printRPCBytes) {
      const b = Buffer.from(msg, encoding)
      logger.debug('[RPC] Writing', b.length, 'bytes:', b.toString('hex'))
    }
    super._raw_write(msg, encoding)
  }

  // Override Packetizer.packetize_data -- see packetizer.iced in
  // framed-msgpack-rpc.
  packetize_data(m: Buffer) {
    if (printRPCBytes) {
      logger.debug('[RPC] Read', m.length, 'bytes:', m.toString('hex'))
    }
    super.packetize_data(m)
  }
}

function windowsHack() {
  // This net.connect() is a heinous hack.
  //
  // On Windows, but *only* in the renderer thread, our RPC connection
  // hangs until other random net module operations, at which point it
  // unblocks.  Could be Electron, could be a node-framed-msgpack-rpc
  // bug, who knows.
  if (!isWindows || process.type !== 'renderer') {
    return
  }

  const fake = net.connect({port: 9999})
  // net.connect({}) throws; we don't need to see the error, but we
  // do need it not to raise up to the main thread.
  fake.on('error', function () {})
}

function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
) {
  return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
}

function resetClient(client: createClientType) {
  client.transport.reset()
}

export {resetClient, createClient, rpcLog}
