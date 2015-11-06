'use strict'

import BaseTransport from './rpc'
import fs from 'fs'

class DesktopTransport extends BaseTransport {
  constructor (incomingRPCCallback) {
    const paths = [
      // Hardcoded for now!
      // OS X
      process.env.HOME + '/Library/Caches/KeybaseDevel/keybased.sock',
      // Linux
      process.env.XDG_RUNTIME_DIR + '/keybase.devel/keybased.sock'
    ]
    let sockfile = null
    paths.map(path => {
      let exists = fs.existsSync(path)
      if (exists) {
        console.log('Found keybased socket file at ' + path)
        sockfile = path
      }
    })
    if (!sockfile) {
      console.error('No keybased socket file found!')
    }
    super(
      { path: sockfile },
      null,
      incomingRPCCallback
    )
    this.needsConnect = true
    this.needsBase64 = false
  }
}

export default DesktopTransport
