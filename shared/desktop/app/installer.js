// @flow
import {app} from 'electron'
import exec from './exec'
import {appInstallerPath, appBundlePath} from './paths'
import {quit} from './ctl'
import {runMode} from '../../constants/platform.desktop'
import {isWindows} from '../../constants/platform'

// Runs the installer (on MacOS).
// For other platforms, this immediately returns that there is no installer.
//
// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where the installer is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start-hot
export default (callback: (err: any) => void): void => {
  if (isWindows) {
    console.log('skipping installer on win32')
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
  let timeout = 30
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (app.getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }
  const args = ['--debug', '--app-path=' + bundlePath, '--run-mode=' + runMode, '--timeout=' + timeout]

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
