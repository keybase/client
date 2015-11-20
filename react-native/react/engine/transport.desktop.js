'use strict'

import BaseTransport from './rpc'
import fs from 'fs'
import {socketPath} from '../constants/platform.native.desktop'

export default class DesktopTransport extends BaseTransport {
  constructor (incomingRPCCallback, writeCallback, connectCallback) {
    let sockfile = null

    let exists = fs.existsSync(socketPath)
    if (exists) {
      console.log('Found keybased socket file at ' + socketPath)
      sockfile = socketPath
    } else {
      console.error('No keybased socket file found!')
    }

    let hooks = null
    if (connectCallback) {
      hooks = {connected: connectCallback}
    }

    super(
      {path: sockfile, hooks},
      null,
      incomingRPCCallback
    )
    this.needsConnect = true
    this.needsBase64 = false
  }
}
