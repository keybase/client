import {appInstallerPath, appBundlePath} from './paths'
import exec from './exec'
import {quit} from './ctl'

import {runMode} from '../shared/constants/platform.native.desktop'

export default callback => {
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
  const args = ['--app-path=' + bundlePath, '--run-mode=' + runMode]

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
