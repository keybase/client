import BaseTransport from './rpc'
import {socketPath} from '../constants/platform.native.desktop'

export default class DesktopTransport extends BaseTransport {
  constructor (incomingRPCCallback, writeCallback, connectCallback) {
    let hooks = null
    if (connectCallback) {
      hooks = {connected: () => {
        this.needsConnect = false
        connectCallback()
      }}
    }

    super({path: socketPath, hooks}, null, incomingRPCCallback)
    this.needsConnect = true
    this.needsBase64 = false
  }
}
