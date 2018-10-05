// @flow
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Styles from '../../styles'
import exec from './exec.desktop'
import {keybaseBinPath} from './paths.desktop'
import {quit} from './ctl.desktop'
import {isLinux, isWindows} from '../../constants/platform'
import logger from '../../logger'
import UserData from './user-data.desktop'

import type {InstallResult} from '../../constants/types/rpc-gen'

// Copied from old constants/favorite.js
//
// See Installer.m: KBExitFuseKextError
const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
const ExitCodeAuthCanceledError = 6

type State = {
  promptedForCLI: boolean,
}
class InstallerData extends UserData<State> {}
// prevent error spewage on windows by not instantiating
// InstallerData. Flow seems to require this fake stub.
const installerState = isWindows
  ? {
      save: () => {},
      state: {
        promptedForCLI: false,
      },
    }
  : new InstallerData('installer.json', {promptedForCLI: false})

type CheckErrorsResult = {
  errors: Array<string>,
  hasCLIError: boolean,
  hasFUSEError: boolean,
  hasKBNMError: boolean,
}

// Install.
//
// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where keybase bin is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start
//
// Reminder: hot-server doesn't reload code in here (/desktop)
export default (callback: (err: any) => void): void => {
  logger.info('Installer check starting now')
  if (isWindows || isLinux) {
    logger.info('Skipping installer on this platform')
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
  if (SafeElectron.getApp().getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }
  const args = ['--debug', 'install-auto', '--format=json', '--timeout=' + timeout + 's']

  exec(keybaseBin, args, 'darwin', 'prod', true, (err, attempted, stdout, stderr) => {
    let errorsResult: CheckErrorsResult = {
      errors: [],
      hasCLIError: false,
      hasFUSEError: false,
      hasKBNMError: false,
    }
    if (err) {
      errorsResult.errors = [`There was an error trying to run the install (${err.code}).`]
    } else if (stdout !== '') {
      try {
        const result = JSON.parse(stdout)
        if (result) {
          errorsResult = checkErrors(result)
        } else {
          errorsResult.errors = [`There was an error trying to run the install. No output.`]
        }
      } catch (err) {
        errorsResult.errors = [
          `There was an error trying to run the install. We were unable to parse the output of keybase install-auto.`,
        ]
      }
    }

    if (errorsResult.errors.length > 0) {
      logger.info(errorsResult.errors.join('\n'))
      logger.info(`Install errors: stdout=${stdout || ''}, stderr=${stderr || ''}`)
      showError(errorsResult.errors, errorsResult.hasFUSEError || errorsResult.hasKBNMError, callback)
      return
    }

    // If we had an error install CLI, let's prompt and try to do it via
    // privileged install.
    if (errorsResult.hasCLIError && !installerState.state.promptedForCLI) {
      promptForInstallCLIPrivileged(keybaseBin, callback)
      return
    }

    callback(null)
  })
}

function checkErrors(result: InstallResult): CheckErrorsResult {
  let errors = []
  let hasCLIError = false
  let hasFUSEError = false
  let hasKBNMError = false
  const crs = (result && result.componentResults) || []
  for (let cr of crs) {
    if (cr.status.code !== 0) {
      if (cr.name === 'fuse') {
        hasFUSEError = true
        if (cr.exitCode === ExitCodeFuseKextError) {
          errors.push(
            `We were unable to load KBFS (Fuse kext). This may be due to a limitation in MacOS where there aren't any device slots available. Device slots can be taken up by apps such as VMWare, VirtualBox, anti-virus programs, VPN programs and Intel HAXM.`
          )
        } else if (cr.exitCode === ExitCodeFuseKextPermissionError) {
          // This will occur if they started install and didn't allow the extension in >= 10.13, and then restarted the app.
          // The app will deal with this scenario in the folders tab, so we can ignore this specific error here.
        }
      } else if (cr.name === 'helper' && cr.exitCode === ExitCodeAuthCanceledError) {
        // Consider this a FUSE error for the purpose of showing it to the user.
        hasFUSEError = true
        errors.push(
          `Installation was canceled. The file system will not be available until authorization is granted.`
        )
      } else if (cr.name === 'cli') {
        hasCLIError = true
      } else if (cr.name === 'redirector') {
        hasFUSEError = true
        errors.push(
          `We were unable to load the part of Keybase that lets you access your files in ${Styles.fileUIName}. You should be able to do so if you wait a few minutes and restart Keybase.`
        )
      } else {
        errors.push(`There was an error trying to install the ${cr.name}.`)
        errors.push(`\n${cr.status.desc}`)
        if (cr.name === 'kbnm') {
          hasKBNMError = true
        }
      }
    }
  }
  return {errors, hasCLIError, hasFUSEError, hasKBNMError}
}

function showError(errors: Array<string>, showOkay: boolean, callback: (err: ?Error) => void) {
  const detail = errors.join('\n') + `\n\nPlease run \`keybase log send\` to report the error.`
  SafeElectron.getDialog().showMessageBox(
    null,
    {
      buttons: showOkay ? ['Okay'] : ['Ignore', 'Quit'],
      detail,
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
  installerState.state.promptedForCLI = true
  installerState.save()
  installCLIPrivileged(keybaseBin, callback)
}

function installCLIPrivileged(keybaseBin: string, callback: (err: ?Error) => void) {
  const args = ['--debug', 'install', '--components=clipaths', '--format=json', '--timeout=120s']
  exec(keybaseBin, args, 'darwin', 'prod', true, callback)
}
