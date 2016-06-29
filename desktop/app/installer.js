import {app} from 'electron'
import {appInstallerPath, appBundlePath} from './paths'
import exec from './exec'

import {runMode} from '../shared/constants/platform.native.desktop'

export default callback => {
  const installerPath = appInstallerPath()
  const bundlePath = appBundlePath()
  const args = ['--app-path=' + bundlePath, '--run-mode=' + runMode]

  exec(installerPath, args, 'darwin', 'prod', function (err) {
    if (err) {
      if (err.code === 1) {
        // Quit
        app.quit()
      } else if (err.code === 2) {
        // TODO: Show error details
      }
      callback(err)
      return
    }
    callback(null)
  })
}
