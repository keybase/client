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
    let errors = []
    if (err) {
      errors = [`There was an error trying to run the install (${err.code}).`]
    } else if (stdout !== '') {
      const result = JSON.parse(stdout)
      if (result) {
        errors = checkErrors(result)
      }
    }

    if (errors.length > 0) {
      showError(errors, callback)
      return
    }

    callback(null)
  })
}

function checkErrors(result: any): Array<string> {
  let errors = []
  for (let cr of result.componentResults) {
    if (cr.status.code !== 0) {
      if (cr.name === 'fuse') {
        if (cr.exitCode === ExitCodeFuseKextError) {
          errors.push(
            `We were unable to load KBFS (Fuse kext). This may be due to a limitation in MacOS where there aren't any device slots available. Device slots can be taken up by apps such as VMWare, VirtualBox, anti-virus programs, VPN programs and Intel HAXM.`
          )
        } else if (cr.exitCode === ExitCodeFuseKextPermissionError) {
          // This will occur if they started install and didn't allow the extension in >= 10.13, and then restarted the app.
          // The app will deal with this scenario in the folders tab, so we can ignore this specific error here.
        }
      } else if (cr.name === 'cli') {
        // Handle CLI error
      } else {
        errors.push(`There was an error trying to install the ${cr.name}.`)
      }
    }
  }
  return errors
}

function showError(errors: Array<string>, callback: () => void) {
  const detail = errors.join('\n') + `Please run \`keybase log send\` to report the error.`
  dialog.showMessageBox(
    {
      buttons: ['Ignore', 'Quit'],
      detail: detail,
      message: 'Keybase Install Error',
    },
    resp => {
      if (resp === 1) {
        quit()
      } else {
        callback()
      }
    }
  )
}
