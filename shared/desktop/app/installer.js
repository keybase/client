// @flow
import {app, dialog} from 'electron'
import exec from './exec'
import {keybaseBinPath} from './paths'
import {quit} from './ctl'
import {isWindows} from '../../constants/platform'
import {ExitCodeFuseKextError, ExitCodeFuseKextPermissionError} from '../../constants/favorite'
import UserData from './user-data'

type State = {
  promptedForCLI: boolean,
}
class InstallerData extends UserData<State> {}
const installerState = new InstallerData('installer.json', {promptedForCLI: false})

type InstallResult = {
  errors: Array<string>,
  hasCLIError: boolean,
}

// Install.
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
    return
  }
  let timeout = 30
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (app.getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }
  const args = ['--debug', 'install-auto', '--format=json', '--timeout=' + timeout + 's']

  exec(keybaseBin, args, 'darwin', 'prod', true, (err, attempted, stdout, stderr) => {
    let installResult: InstallResult = {errors: [], hasCLIError: false}
    if (err) {
      installResult.errors = [`There was an error trying to run the install (${err.code}).`]
    } else if (stdout !== '') {
      try {
        const result = JSON.parse(stdout)
        if (result) {
          installResult = checkErrors(result)
        } else {
          installResult.errors = [`There was an error trying to run the install. No output.`]
        }
      } catch (err) {
        installResult.errors = [
          `There was an error trying to run the install. We were unable to parse the output of keybase install-auto.`,
        ]
      }
    }

    if (installResult.errors.length > 0) {
      showError(installResult.errors, callback)
      return
    }

    // If we had an error install CLI, let's prompt and try to do it via
    // privileged install.
    if (installResult.hasCLIError && !installerState.state.promptedForCLI) {
      promptForInstallCLIPrivileged(keybaseBin, callback)
      return
    }

    callback(null)
  })
}

function checkErrors(result: any): InstallResult {
  let errors = []
  let hasCLIError = false
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
        hasCLIError = true
      } else {
        errors.push(`There was an error trying to install the ${cr.name}.`)
      }
    }
  }
  return {errors, hasCLIError}
}

function showError(errors: Array<string>, callback: (err: ?Error) => void) {
  const detail = errors.join('\n') + `\n\nPlease run \`keybase log send\` to report the error.`
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
        callback(null)
      }
    }
  )
}

function promptForInstallCLIPrivileged(keybaseBin: string, callback: (err: ?Error) => void) {
  dialog.showMessageBox(
    {
      buttons: ['Yes, Install', 'No'],
      checkboxChecked: true,
      checkboxLabel: "Don't ask again",
      detail: 'Do you want to install Keybase for use in the Terminal?',
      message: 'Install Command Line',
    },
    (resp, checkboxChecked) => {
      if (checkboxChecked) {
        installerState.state.promptedForCLI = true
        installerState.save()
      }
      if (resp === 0) {
        installCLIPrivileged(keybaseBin, callback)
      } else {
        callback(null)
      }
    }
  )
}

function installCLIPrivileged(keybaseBin: string, callback: (err: ?Error) => void) {
  const args = ['--debug', 'install', '--components=clipaths', '--format=json', '--timeout=120s']
  exec(keybaseBin, args, 'darwin', 'prod', true, callback)
}
