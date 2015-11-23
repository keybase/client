import BaseTransport from './rpc'
import fs from 'fs'
import {socketPath} from '../constants/platform.native.desktop'

export default class DesktopTransport extends BaseTransport {
  constructor (incomingRPCCallback, writeCallback, connectCallback) {
    let hooks = null
    if (connectCallback) {
      hooks = {connected: connectCallback}
    }

    super({hooks}, null, incomingRPCCallback)
    this.needsConnect = true
    this.needsBase64 = false
  }

  _connect_critical_section (cb) {
    let sockfile = null

    let exists = fs.existsSync(socketPath)
    if (exists) {
      console.log('Found keybased socket file at ' + socketPath)
      sockfile = socketPath
    } else {
      console.error('No keybased socket file found!')
    }

    this.net_opts.path = sockfile

    if (sockfile) {
      super._connect_critical_section(cb)
    } else {
      cb(new Error('No socketfile'))
    }
  }
}
