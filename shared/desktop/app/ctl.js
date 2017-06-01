// @flow
import {app} from 'electron'
import {keybaseBinPath} from './paths'
import exec from './exec'
import {isWindows} from '../../constants/platform'

export function ctlStop(callback: any) {
  const binPath = keybaseBinPath()
  var plat = 'darwin'
  var args = ['ctl', 'stop', '--exclude=app']
  if (isWindows) {
    args = ['ctl', 'stop', '--kill-kbfs']
    plat = 'win32'
  }
  exec(binPath, args, plat, 'prod', false, callback)
}

function exitApp() {
  // For some reason the first app.exit kills only popups (remote components and pinentry)
  // The main window survives. This makes sure to keep exiting until we are actually out.
  // It seems to work even when we have a broken reference to a browser window.
  // (Which happens because our first exit killed the browser window w/o updating our book keeping state)
  setInterval(() => app.exit(0), 200)
  // If we haven't exited after trying, then let's ensure it happens
  setTimeout(() => exitProcess(), 500)
}

function exitProcess() {
  console.log('Forcing process exit')
  process.exit(0)
}

export function quit() {
  // Only quit the app in dev mode
  if (__DEV__) {
    console.log('Only quiting gui in dev mode')
    exitApp()
    return
  }

  console.log('Quit the app')
  ctlStop(function(stopErr) {
    console.log('Done with ctlstop')
    if (stopErr) {
      console.log('Error in ctl stop, when quiting:', stopErr)
    }
    exitApp()
  })
}
