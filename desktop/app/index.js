import {BrowserWindow, app, dialog} from 'electron'
import splash from './splash'
import installer from './installer'
import ListenLogUi from '../shared/native/listen-log-ui'
import menuHelper from './menu-helper'
import consoleHelper, {ipcLogs} from './console-helper'
import devTools from './dev-tools'
import menuBar from './menu-bar'
import storeHelper from './store-helper'
import MainWindow from './main-window'
import windowHelper from './window-helper'
import urlHelper from './url-helper'
import hello from '../shared/util/hello'
import semver from 'semver'
import os from 'os'

let mainWindow = null

// Only one app per app in osx...
const shouldQuit = app.makeSingleInstance(() => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.window.focus()
  }
})

if (shouldQuit) {
  console.log('Only one instance of keybase GUI allowed, bailing!')
  app.quit()
} else {
  // Check supported OS version
  if (os.platform() === 'darwin') {
    // Release numbers for OS versions can be looked up here: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
    // 14.0.0 == 10.10.0
    // 15.0.0 == 10.11.0
    if (!semver.satisfies(os.release(), '>=14.0.0')) {
      dialog.showErrorBox('Keybase Error', 'This version of OS X isn\'t currently supported.')
      app.quit()
    }
  }

  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  // MUST do this else we get limited by simultaneous hot reload event streams
  app.commandLine.appendSwitch('ignore-connections-limit', 'localhost')

  if (__DEV__) { // eslint-disable-line no-undef
    app.commandLine.appendSwitch('enable-logging')
    app.commandLine.appendSwitch('v', 3)
  }

  hello(process.pid, 'Main Thread', process.argv, __VERSION__) // eslint-disable-line no-undef

  consoleHelper()
  ipcLogs()
  devTools()
  menuBar()
  urlHelper()
  ListenLogUi()
  windowHelper(app)

  if (process.platform === 'darwin') {
    menuHelper()
  }

  installer(err => {
    if (err) {
      console.log('Error: ', err)
    }
    splash()
  })

  app.once('ready', () => {
    mainWindow = MainWindow()
    storeHelper(mainWindow)
    if (app.dock && !mainWindow.initiallyVisible) {
      app.dock.hide()
    }
  })

  app.on('before-quit', event => {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(w => {
      w.destroy()
    })

    // TODO: send some event to the service to tell it to shutdown all the things as well
  })
}
