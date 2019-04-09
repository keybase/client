// @flow
import * as SafeElectron from '../../util/safe-electron.desktop'

function exitApp() {
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
    exitApp()
  }
}
