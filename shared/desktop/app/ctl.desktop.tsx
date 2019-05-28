import * as SafeElectron from '../../util/safe-electron.desktop'
import {keybaseBinPath} from './paths.desktop'
import exec from './exec.desktop'
import {isWindows} from '../../constants/platform'

export function ctlStop(callback: any) {
  const binPath = keybaseBinPath()
  var plat = 'darwin'
  var args = ['ctl', 'stop', '--exclude=app']
  if (isWindows) {
    args = ['ctl', 'stop']
    plat = 'win32'
  }
  exec(binPath, args, plat, 'prod', false, callback)
}

function exitApp() {
  console.log('exiting app')
  // For some reason the first app.exit kills only popups (remote components and pinentry)
  // The main window survives. This makes sure to keep exiting until we are actually out.
  // It seems to work even when we have a broken reference to a browser window.
  // (Which happens because our first exit killed the browser window w/o updating our book keeping state)
  setInterval(() => SafeElectron.getApp().exit(0), 200)
  // If we haven't exited after trying, then let's ensure it happens
  setTimeout(() => exitProcess(), 500)
}

function exitProcess() {
  console.log('Forcing process exit')
  process.exit(0)
}

export function quit(appOnly: boolean = false) {
  if (appOnly || __DEV__) {
    console.log('Only quitting gui')
    exitApp()
    return
  }

  console.log('Quit the app')
  ctlStop(function(stopErr) {
    console.log('Done with ctlstop')
    if (stopErr) {
      console.log('Error in ctl stop, when quitting:', stopErr)
    }
    exitApp()
  })
}
