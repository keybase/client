import BaseTransport from './rpc'
import fs from 'fs'

class DesktopTransport extends BaseTransport {
  constructor (incomingRPCCallback, writeCallback, connectCallback) {
    const runMode = process.env.KEYBASE_RUN_MODE || 'devel'
    const envedPathOSX = {
      staging: 'KeybaseStaging',
      devel: 'KeybaseDevel',
      // TODO: Purposely set to devel, change before release
      prod: 'KeybaseDevel'
    }

    const paths = [
      // Hardcoded for now!
      // OS X
      `${process.env.HOME}/Library/Caches/${envedPathOSX[runMode]}/keybased.sock`,
      // Linux
      `${process.env.XDG_RUNTIME_DIR}/keybase.${runMode}/keybased.sock`
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

export default DesktopTransport
