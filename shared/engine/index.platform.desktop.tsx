import net from 'net'
import logger from '../logger'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {isWindows, socketPath} from '../constants/platform.desktop'
import {createClientType, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'
import {printRPCBytes} from '../local-debug'

class NativeTransport extends TransportShared {
  constructor(incomingRPCCallback, connectCallback, disconnectCallback) {
    console.log('Transport using', socketPath)
    super({path: socketPath}, connectCallback, disconnectCallback, incomingRPCCallback)
    this.needsConnect = true
  }

  _connect_critical_section(cb: any) {
    // eslint-disable-line camelcase
    // @ts-ignore codemode issue
    super._connect_critical_section(cb)
    windowsHack()
  }

  // Override Transport._raw_write -- see transport.iced in
  // framed-msgpack-rpc.
  _raw_write(msg, encoding) {
    if (printRPCBytes) {
      const b = Buffer.from(msg, encoding)
      logger.debug('[RPC] Writing', b.length, 'bytes:', b.toString('hex'))
    }
    // @ts-ignore codemode issue
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

  // @ts-ignore codemode issue
  var fake = net.connect({})
  // net.connect({}) throws; we don't need to see the error, but we
  // do need it not to raise up to the main thread.
  fake.on('error', function() {})
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
