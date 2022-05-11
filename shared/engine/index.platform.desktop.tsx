// import net from 'net'
import logger from '../logger'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {isWindows, socketPath} from '../constants/platform.desktop'
import {printRPCBytes} from '../local-debug'
import type {SendArg, createClientType, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'
import KB2 from '../util/electron.desktop'

const {engineSend, ipcRendererOn} = KB2.functions
const {isRenderer} = KB2.constants

// used by node
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

// used by renderer
function windowsHack() {
  // This net.connect() is a heinous hack.
  //
  // On Windows, but *only* in the renderer thread, our RPC connection
  // hangs until other random net module operations, at which point it
  // unblocks.  Could be Electron, could be a node-framed-msgpack-rpc
  // bug, who knows.
  if (!isWindows || !KB2.constants.isRenderer) {
    return
  }

  const net = require('net')
  const fake = net.connect({port: 9999})
  // net.connect({}) throws; we don't need to see the error, but we
  // do need it not to raise up to the main thread.
  fake.on('error', function () {})
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

  invoke(arg, cb) {
    console.log('aaa proxy native invoke', arg)
    engineSend?.(arg, cb)
  }

  // send(msg: SendArg) {
  // const packed = encode(msg)
  // const len = encode(packed.length)
  // const buf = new Uint8Array(len.length + packed.length)
  // buf.set(len, 0)
  // buf.set(packed, len.length)
  // // Pass data over to the native side to be handled, with JSI!
  // if (typeof global.rpcOnGo !== 'function') {
  //   NativeModules.GoJSIBridge.install()
  // }
  // try {
  //   global.rpcOnGo(buf.buffer)
  // } catch (e) {
  //   logger.error('>>>> rpcOnGo JS thrown!', e)
  // }

  //   engineSend?.(msg)
  //   return true
  // }
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

    // ipcRendererOn?.('engineIncoming', (_e, action) => {
    //   try {
    //     client.transport._dispatch(action.payload.objs)
    //   } catch (e) {
    //     logger.error('>>>> rpcOnJs JS thrown!', e)
    //   }
    // })

    return client
  }
}

function resetClient(client: createClientType) {
  client.transport.reset()
}

export {resetClient, createClient, rpcLog}
