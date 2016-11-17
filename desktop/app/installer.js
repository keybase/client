// @flow
import {app} from 'electron'
import exec from './exec'
import {appInstallerPath, appBundlePath} from './paths'
import {quit} from './ctl'
import {runMode} from '../shared/constants/platform.desktop'

export default (callback: (err: any) => void): void => {
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
  let timeout = 10
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (app.getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }
  const args = ['--app-path=' + bundlePath, '--run-mode=' + runMode, '--timeout=' + timeout]

  exec(installerPath, args, 'darwin', 'prod', true, function (err) {
    if (err && err.code === 1) {
      // The installer app returns exit status 1, if there was an error and
      // the user chooses to quit the app.
      quit()
      return
    }
    callback(err)
  })
}
