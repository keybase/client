// @flow
import {app, dialog} from 'electron'
import exec from './exec'
import {keybaseBinPath} from './paths'
import {quit} from './ctl'
import {isWindows} from '../../constants/platform'

// Install components.
//
// User components (not requiring privileges): updater,service,cli,kbfs,kbnm
// KBFS componnets (requiring privileges): helper,fuse,mountdir
//
// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where keybase bin is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start
export default (components: string, callback: (err: any) => void): void => {
  if (isWindows) {
    console.log('Skipping installer on win32')
    callback(null)
    return
  }
  const keybaseBin = keybaseBinPath()
  if (!keybaseBin) {
    callback(new Error('No keybase bin path'))
  }
  let timeout = 30
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (app.getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }
  const args = ['--debug', 'install', '--timeout=' + timeout + 's', `--components=${components}`]

  exec(keybaseBin, args, 'darwin', 'prod', true, function(err) {
    if (err) {
      dialog.showMessageBox(
        {
          buttons: ['Quit'],
          detail: `There was an error trying to install (${err.code}). Please report to ...`,
          message: 'Keybase Install Error',
        },
        resp => {
          quit()
        }
      )
      return
    }
    callback(err)
  })
}
