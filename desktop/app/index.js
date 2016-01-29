import {BrowserWindow} from 'electron'
import splash from './splash'
import installer from './installer'
import {app} from 'electron'
import ListenLogUi from '../shared/native/listen-log-ui'
import menuHelper from './menu-helper'
import consoleHelper, {ipcLogs} from './console-helper'
import devTools from './dev-tools'
import menuBar from './menu-bar'
import storeHelper from './store-helper'
import mainWindow from './main-window'
import urlHelper from './url-helper'
import hello from '../shared/util/hello'

// MUST do this else we get limited by simultaneous hot reload event streams
app.commandLine.appendSwitch('ignore-connections-limit', 'localhost')

if (__DEV__) { // eslint-disable-line no-undef
  app.commandLine.appendSwitch('enable-logging')
  app.commandLine.appendSwitch('v', 3)
}

hello(process.pid, 'Main Thread', process.argv)

consoleHelper()
ipcLogs()
devTools()
menuBar()
const mw = mainWindow()
storeHelper(mw)
urlHelper()
ListenLogUi()

// Only one app per app in osx...
if (process.platform === 'darwin') {
  menuHelper()
}

installer(err => {
  if (err) {
    console.log('Error: ', err)
  }
  splash()
})

if (app.dock) {
  app.dock.hide()
}

// Don't quit the app, instead try to close all windows
app.on('close-windows', event => {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(w => {
    // We tell it to close, we can register handlers for the 'close' event if we want to
    // keep this window alive or hide it instead.
    w.close()
  })
})

app.on('before-quit', event => {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(w => {
    w.destroy()
  })

  // TODO: send some event to the service to tell it to shutdown all the things as well
})

