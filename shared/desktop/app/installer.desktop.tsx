import * as Electron from 'electron'
import fs from 'fs'
import path from 'path'
import exec from './exec.desktop'
import {type ExecException} from 'child_process'
import {keybaseBinPath} from './paths.desktop'
import {ctlQuit} from './ctl.desktop'
import {isDarwin} from '@/constants/platform'
import logger from '@/logger'
import zlib from 'zlib'
import {legacyHelperInstalled, legacyHelperRetirementResult, type InstallResultJSON} from './install-result.desktop'

const file = path.join(Electron.app.getPath('userData'), 'installer.json')

type InstallerState = {promptedForCLI?: boolean; promptedForHelper?: boolean}

const loadState = (): InstallerState => {
  try {
    const data = fs.readFileSync(file, 'utf8')
    const p = JSON.parse(data) as undefined | {promptedForCLI?: unknown; promptedForHelper?: unknown}
    return {promptedForCLI: !!p?.promptedForCLI, promptedForHelper: !!p?.promptedForHelper}
  } catch (error_) {
    const error = error_ as {code?: string} | undefined
    if (error?.code === 'ENOENT') {
      console.log('[Installer] loadState: No installer.json file')
    } else {
      console.warn('[Installer] loadState: Error loading state:', error)
    }
    return {}
  }
}

const savePrompted = (key: keyof InstallerState) => {
  try {
    fs.writeFileSync(file, JSON.stringify({...loadState(), [key]: true}))
  } catch (err) {
    console.warn('[Installer] savePrompted: Error saving state:', err)
  }
}

type ErrorTypes = {
  cli: boolean
}

const checkErrors = (result: InstallResultJSON, errors: Array<string>, errorTypes: ErrorTypes) => {
  const results = result?.componentResults || []
  results.forEach(cr => {
    if (cr.status?.code === 0) {
      return
    }
    if (cr.name === 'cli') {
      errorTypes.cli = true
    } else {
      errors.push(`There was an error trying to install the ${cr.name ?? ''}.`)
      errors.push(`\n${cr.status?.desc ?? ''}`)
    }
  })
}

type CB = (err: Error | null) => void

type CommandLineToolCallback = (
  err: ExecException | null,
  attempted: boolean,
  stdout: string,
  stderr: string
) => void

let commandLineToolWaiters: Array<CommandLineToolCallback> | undefined

const finishCommandLineTool: CommandLineToolCallback = (err, attempted, stdout, stderr) => {
  const waiters = commandLineToolWaiters ?? []
  commandLineToolWaiters = undefined
  // one throwing waiter must not keep the rest waiting
  waiters.forEach(waiter => {
    try {
      waiter(err, attempted, stdout, stderr)
    } catch (error) {
      logger.error('[Installer]: Command line tool callback threw', error)
    }
  })
}

// Makes the keybase command available in Terminal behind a one-time macOS administrator prompt: links it into
// /usr/local/bin, or when that directory is missing, adds the app's bin directory to /etc/paths.d/Keybase. Only
// runs in prod. One install runs at a time: a caller while one runs gets that install's result.
export const installCommandLineTool = (callback: CommandLineToolCallback) => {
  if (commandLineToolWaiters) {
    commandLineToolWaiters.push(callback)
    return
  }
  commandLineToolWaiters = [callback]
  exec(
    keybaseBinPath(),
    ['--debug', 'install', '--components=clipaths', '--format=json', '--timeout=120s'],
    'darwin',
    'prod',
    true,
    finishCommandLineTool
  )
}

// Removes the legacy root helper, its FUSE driver and the old redirector directories behind one macOS administrator
// prompt. Only runs in prod. A cancel or failure is logged and never shown.
const retireLegacyHelper = () => {
  exec(
    keybaseBinPath(),
    ['--debug', 'uninstall', '--components=helper', '--format=json'],
    'darwin',
    'prod',
    true,
    (err, attempted, stdout) => {
      if (!attempted) {
        logger.info('[Installer]: Legacy helper retirement not attempted')
      } else if (err) {
        logger.warn('[Installer]: Legacy helper retirement failed to run', err.message)
      } else {
        const r = legacyHelperRetirementResult(stdout)
        logger.info(`[Installer]: Legacy helper retirement ${r.ok ? 'succeeded' : 'failed'}: ${r.desc}`)
      }
    }
  )
}

const darwinInstall = (callback: CB) => {
  logger.info('[Installer]: Installer check starting now')
  const keybaseBin = keybaseBinPath()
  if (!keybaseBin) {
    callback(new Error('No keybase bin path'))
    return
  }
  let timeout = 30
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (Electron.app.getLoginItemSettings().wasOpenedAtLogin) {
    timeout = 90
  }

  const logOutput = async (stdout: string, stderr: string) =>
    Promise.all([
      new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(stdout, (error, res) => (error ? reject(error) : resolve(res)))
      }),
      new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(stderr, (error, res) => (error ? reject(error) : resolve(res)))
      }),
    ])
      .then(([zStdout, zStderr]) =>
        logger.info(
          '[Installer]: got result from install-auto. To read, pipe the base64 strings to "| base64 -d | gzip -d".',
          `stdout=${zStdout.toString('base64')}`,
          `stderr=${zStderr.toString('base64')}`
        )
      )
      .catch((err: unknown) => logger.error('[Installer]: Error zipping up logs: ', err))

  const handleResults = (err: ExecException | null, _: unknown, stdout: string, stderr: string) => {
    const loggingPromise = logOutput(stdout, stderr)
    const errors: Array<string> = []
    const errorTypes: ErrorTypes = {
      cli: false,
    }
    let helperInstalled = false
    if (err) {
      errors.push(`There was an error trying to run the install (${err.code}).`)
    } else if (stdout !== '') {
      try {
        const result = JSON.parse(stdout) as InstallResultJSON
        if (result) {
          checkErrors(result, errors, errorTypes)
          helperInstalled = legacyHelperInstalled(result)
        } else {
          errors.push(`There was an error trying to run the install. No output.`)
        }
      } catch {
        errors.push(
          `There was an error trying to run the install. We were unable to parse the output of keybase install-auto.`
        )
      }
    }

    if (errors.length > 0) {
      logger.info(errors.join('\n'))
      logger.info('[Installer]: Install errorred')
      const buttons = ['Ignore', 'Quit']
      const detail = errors.join('\n') + `\n\nPlease run \`keybase log send\` to report the error.`
      const message = 'Keybase Install Error'
      loggingPromise
        .then(async () => Electron.dialog.showMessageBox({buttons, detail, message}))
        .then(({response}) => {
          if (response === 1) {
            ctlQuit()
          } else {
            callback(null)
          }
        })
        .catch(() => {})
      return
    }

    // Each one-time prompt is remembered before it runs, so a cancel is never asked again. The helper prompt can
    // wait minutes for the user, so the install is reported done first and the retirement runs after it.
    const finish = () => {
      callback(null)
      if (!helperInstalled) {
        return
      }
      if (loadState().promptedForHelper) {
        logger.info('[Installer]: Legacy helper installed; already asked to remove it previously')
        return
      }
      logger.info('[Installer]: Legacy helper installed, trying to remove it')
      savePrompted('promptedForHelper')
      retireLegacyHelper()
    }

    // If we had an error install CLI, let's prompt and try to do it via privileged install.
    if (errorTypes.cli) {
      logger.info('[Installer]: Has cli errors and not installed yet, trying CLI install')
      if (loadState().promptedForCLI) {
        logger.info('[Installer]: Bailing on already tried to install cli previously')
      } else {
        savePrompted('promptedForCLI')
        installCommandLineTool(cliErr => {
          if (cliErr) {
            logger.warn('[Installer]: CLI install failed', cliErr.message)
          }
          finish()
        })
        return
      }
    }

    finish()
  }
  exec(
    keybaseBin,
    ['--debug', 'install-auto', '--format=json', `--timeout=${timeout}s`],
    'darwin',
    'prod',
    true,
    handleResults
  )
}

const install = isDarwin ? darwinInstall : (callback: CB) => callback(null) // nothing on other platforms
export default install
