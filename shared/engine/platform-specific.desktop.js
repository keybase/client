// @flow
import net from 'net'
import type {incomingRPCCallbackType, connectCallbackType} from './platform-specific'
import {TransportShared, sharedCreateClient} from './transport-shared'
import {socketPath} from '../constants/platform.native.desktop'

class NativeTransport extends TransportShared {
  constructor (incomingRPCCallback, connectCallback) {
    super({path: socketPath}, connectCallback, incomingRPCCallback)
    this.needsConnect = true
  }

  _connect_critical_section (cb: any) { // eslint-disable-line camelcase
    super._connect_critical_section(cb)
    windowsHack()
  }
}

function windowsHack () {
  // This net.connect() is a heinous hack.
  //
  // On Windows, but *only* in the renderer thread, our RPC connection
  // hangs until other random net module operations, at which point it
  // unblocks.  Could be Electron, could be a node-framed-msgpack-rpc
  // bug, who knows.
  // $FlowIssue
  if (process.platform !== 'win32' || process.type !== 'renderer') {
    return
  }

  var fake = net.connect({})
  // net.connect({}) throws; we don't need to see the error, but we
  // do need it not to raise up to the main thread.
  fake.on('error', function () {})
}

function createClient (incomingRPCCallback: incomingRPCCallbackType, connectCallback: connectCallbackType) {
  return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback))
}

function resetClient () {
}

export {
  resetClient,
  createClient,
}
