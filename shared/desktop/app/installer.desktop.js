// @flow
import * as SafeElectron from '../../util/safe-electron.desktop'
import fs from 'fs'
import path from 'path'
import exec from './exec.desktop'
import {keybaseBinPath} from './paths.desktop'
import {quit} from './ctl.desktop'
import {isDarwin} from '../../constants/platform'
import logger from '../../logger'
import type {InstallResult} from '../../constants/types/rpc-gen'

const file = path.join(SafeElectron.getApp().getPath('userData'), 'installer.json')
let state = {promptedForCLI: false}

const load = () => {
  try {
    const data = fs.readFileSync(file, 'utf8')
    state = JSON.parse(data)
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.log('No installer.json file')
    } else {
      console.warn('Error loading state:', err)
    }
  }
}

const save = () => {
  try {
    fs.writeFileSync(file, JSON.stringify(state))
  } catch (err) {
    console.warn('Error saving state:', err)
  }
}

type CheckErrorsResult = {
  errors: Array<string>,
  hasCLIError: boolean,
  hasFUSEError: boolean,
  hasKBNMError: boolean,
}

function checkErrors(result: InstallResult): CheckErrorsResult {
  // Copied from old constants/favorite.js
  // See Installer.m: KBExitFuseKextError
  const ExitCodeFuseKextError = 4
  // See Installer.m: KBExitFuseKextPermissionError
  const ExitCodeFuseKextPermissionError = 5
  // See Installer.m: KBExitAuthCanceledError
  const ExitCodeAuthCanceledError = 6

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
          `We were unable to load the part of Keybase that lets you access your files in your file system. You should be able to do so if you wait a few minutes and restart Keybase.`
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

// To test the installer from dev (on MacOS), you can point KEYBASE_GET_APP_PATH
// to a place where keybase bin is bundled, for example:
//   KEYBASE_GET_APP_PATH=/Applications/Keybase.app/Contents/Resources/app/ yarn run start
//
// Reminder: hot-server doesn't reload code in here (/desktop)
const install = isDarwin
  ? (callback: (err: any) => void): void => {
      load()
      logger.info('Installer check starting now')
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
      exec(
        keybaseBin,
        ['--debug', 'install-auto', '--format=json', `--timeout=${timeout}s`],
        'darwin',
        'prod',
        true,
        (err, attempted, stdout, stderr) => {
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
            const showOkay = errorsResult.hasFUSEError || errorsResult.hasKBNMError
            const detail =
              errorsResult.errors.join('\n') + `\n\nPlease run \`keybase log send\` to report the error.`
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
            return
          }

          // If we had an error install CLI, let's prompt and try to do it via
          // privileged install.
          if (errorsResult.hasCLIError && !state.promptedForCLI) {
            state.promptedForCLI = true
            save()
            exec(
              keybaseBin,
              ['--debug', 'install', '--components=clipaths', '--format=json', '--timeout=120s'],
              'darwin',
              'prod',
              true,
              callback
            )
            return
          }

          callback(null)
        }
      )
    }
  : callback => callback(null) // nothing on other platforms

export default install
