// @flow
import {app, dialog} from 'electron'
import exec from './exec'
import {appInstallerPath, appBundlePath, keybaseBinPath} from './paths'
import {quit} from './ctl'
import {runMode} from '../../constants/platform.desktop'
import {isWindows} from '../../constants/platform'

// Install user components such as service,updater,cli,kbnm (not requiring privileges)
//
// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where keybase bin is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start
export default (callback: (err: any) => void): void => {
  if (isWindows) {
    console.log('Skipping installer on win32')
    callback(null)
    return
  }
  const keybaseBin = keybaseBinPath()
  if (!keybaseBin) {
    callback(new Error('No keybase bin path'))
  }
  let timeout = timeoutForExec()
  const args = ['--debug', 'install', '--timeout=' + timeout + 's', '--components=updater,service,cli,kbnm']

  exec(keybaseBin, args, 'darwin', 'prod', true, function(err) {
    if (err) {
      dialog.showMessageBox(
        {message: 'There was an error trying to install Keybase', title: 'Install Error'},
        resp => {
          quit()
        }
      )
      return
    }
    callback(err)
  })
}

// If the app was opened at login, there might be contention for lots
// of resources, so we use a larger timeout in that case.
const timeoutForExec = (): number => {
  return app.getLoginItemSettings().wasOpenedAtLogin ? 90 : 30
}

// Install KBFS components (requiring privileges).
// For other platforms, this immediately returns that there is no installer.
//
// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where the installer is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start
export const installKBFSComponents = (callback: (err: any) => void): void => {
  if (isWindows) {
    console.log('Skipping installer on win32')
    callback(null)
    return
  }
  const installerPath = appInstallerPath()
  if (!installerPath) {
    callback(new Error('No installer path'))
    return
  }
  const bundlePath = appBundlePath()
  if (!bundlePath) {
    callback(new Error('No bundle path for installer'))
    return
  }
  let timeout = timeoutForExec()
  const args = [
    '--debug',
    '--app-path=' + bundlePath,
    '--run-mode=' + runMode,
    '--timeout=' + timeout,
    '--install-helper',
  ]

  exec(installerPath, args, 'darwin', 'prod', true, function(err) {
    if (err && err.code === 1) {
      // The installer app returns exit status 1, if there was an error and
      // the user chooses to quit the app.
      quit()
      return
    }
    callback(err)
  })
}
