// @flow
import MainWindow from './main-window'
import devTools from './dev-tools'
import hello from '../../util/hello'
import installer from './installer'
import menuBar from './menu-bar'
import os from 'os'
import semver from 'semver'
import splash from '../../util/splash.desktop'
import storeHelper from './store-helper'
import urlHelper from './url-helper'
import windowHelper from './window-helper'
import {BrowserWindow, app, ipcMain, dialog} from 'electron'
import {setupExecuteActionsListener, executeActionsForContext} from '../../util/quit-helper.desktop'
import {setupTarget} from '../../util/forward-logs'
import {allowMultipleInstances} from '../../local-debug.desktop'
import startWinService from './start-win-service'
import {showMainWindow} from '../../actions/platform-specific.desktop'



let mainWindow = null

function start() {
  if (!allowMultipleInstances) {
    // Only one app per app in osx...
    const shouldQuit = app.makeSingleInstance(() => {
      if (mainWindow) {
        mainWindow.show(true)
      }
      // Wasn't showing on Windows without this
      showMainWindow()
    })

    if (shouldQuit) {
      console.log('Only one instance of keybase GUI allowed, bailing!')
      app.quit()
      return
    }
  }

  // Check supported OS version
  if (os.platform() === 'darwin') {
    // Release numbers for OS versions can be looked up here: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
    // 14.0.0 == 10.10.0
    // 15.0.0 == 10.11.0
    if (!semver.satisfies(os.release(), '>=14.0.0')) {
      dialog.showErrorBox('Keybase Error', "This version of macOS isn't currently supported.")
      app.quit()
      return
    }
  }

  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  // MUST do this else we get limited by simultaneous hot reload event streams
  app.commandLine.appendSwitch('ignore-connections-limit', 'localhost')

  if (__DEV__) {
    // eslint-disable-line no-undef
    app.commandLine.appendSwitch('enable-logging')
    app.commandLine.appendSwitch('v', 3)
  }

  hello(process.pid, 'Main Thread', process.argv, __VERSION__, false) // eslint-disable-line no-undef

  setupTarget()
  devTools()
  menuBar()
  urlHelper()
  windowHelper(app)

  console.log('Version:', app.getVersion())

  app.once('ready', () => {
    mainWindow = MainWindow()
    storeHelper(mainWindow)
  })

  ipcMain.on('install-check', (event, arg) => {
    installer(err => {
      if (err) {
        console.log('Error: ', err)
      }
      splash()
      event.sender.send('installed')
    })
  })

  ipcMain.on('kb-service-check', (event, arg) => {
    if (isWindows) {
      console.log('kb-service-check: starting keybase.exe')
      startWinService()
    }
  })

  // Called when the user clicks the dock icon
  app.on('activate', () => {
    mainWindow && mainWindow.show(true)
  })

  // Don't quit the app, instead try to close all windows
  app.on('close-windows', event => {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(w => {
      // We tell it to close, we can register handlers for the 'close' event if we want to
      // keep this window alive or hide it instead.
      w.close()
    })
  })

  // quit through dock. only listen once
  app.once('before-quit', event => {
    console.log('Quit through before-quit')
    event.preventDefault()
    executeActionsForContext('beforeQuit')
  })
}

start()
setupExecuteActionsListener()
