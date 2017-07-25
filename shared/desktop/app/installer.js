// @flow
import {app, dialog} from 'electron'
import exec from './exec'
import {keybaseBinPath} from './paths'
import {quit} from './ctl'
import {isWindows} from '../../constants/platform'
import {ExitCodeFuseKextError, ExitCodeFuseKextPermissionError} from '../../constants/favorite'

// Install components.
//
// User components (not requiring privileges).
//
// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where keybase bin is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start
//
// Reminder: hot-server doesn't reload code in here (/desktop)
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
  let timeout = 30
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (app.getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }
  const args = ['--debug', 'install-auto', '--format=json', '--timeout=' + timeout + 's']

  exec(keybaseBin, args, 'darwin', 'prod', true, function(err, attempted, stdout, stderr) {
    if (err) {
      let errorDetail = `There was an error trying to install (${err.code}). Please run \`keybase log send\` to report the error.`
      if (stdout !== '') {
        const result = JSON.parse(stdout)
        const fuseResults = result ? result.componentResults.filter(c => c.name === 'fuse') : []
        if (fuseResults.length > 0) {
          if (fuseResults[0].exitCode === ExitCodeFuseKextError) {
            errorDetail = `We were unable to load KBFS (${err.code}). This may be due to a limitation in MacOS where there aren't any device slots available. Device slots can be taken up by apps such as VMWare, VirtualBox, anti-virus programs, VPN programs and Intel HAXM.`
          } else if (fuseResults[0].exitCode === ExitCodeFuseKextPermissionError) {
            // This will show if they started install and didn't allow the extension, and then restarted the app.
            // The app will deal with this scenario in the folders tab, and we can ignore this specific error here.
            callback(err)
            return
          }
        }
      }

      dialog.showMessageBox(
        {
          buttons: ['Ignore', 'Quit'],
          detail: errorDetail,
          message: 'Keybase Install Error',
        },
        resp => {
          if (resp === 1) {
            quit()
          } else {
            callback(err)
          }
        }
      )
      return
    }
    callback(null)
  })
}
