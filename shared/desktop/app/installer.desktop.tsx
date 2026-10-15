import * as Electron from 'electron'
import fs from 'fs'
import path from 'path'
import exec from './exec.desktop'
import {type ExecException} from 'child_process'
import {keybaseBinPath} from './paths.desktop'
import {ctlQuit} from './ctl.desktop'
import {isDarwin, runMode} from '@/constants/platform'
import logger from '@/logger'
import {ensureError} from '@/util/errors'
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

// Warn (not Info): prod Info is a 1000-line ring and gets wiped by chat traffic before log send.
const logComponentResults = (result: InstallResultJSON) => {
  const results = result?.componentResults || []
  if (results.length === 0) {
    logger.warn('[Installer]: install-auto returned no componentResults')
    return
  }
  for (const cr of results) {
    logger.warn(
      `[Installer]: component=${cr.name ?? '?'} statusCode=${cr.status?.code ?? 'unknown'} exitCode=${cr.exitCode ?? 0} desc=${cr.status?.desc ?? ''}`
    )
  }
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
  waiters.forEach(waiter => {
    waiter(err, attempted, stdout, stderr)
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
  const args = ['--debug', 'install', '--components=clipaths', '--format=json', '--timeout=120s']
  try {
    exec(
      keybaseBinPath(),
      args,
      'darwin',
      'prod',
      true,
      finishCommandLineTool
    )
  } catch (error) {
    finishCommandLineTool(Object.assign(ensureError(error), {cmd: `keybase ${args.join(' ')}`}), false, '', '')
  }
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
  const keybaseBin = keybaseBinPath()
  const openedAtLogin = Electron.app.getLoginItemSettings().wasOpenedAtLogin
  let timeout = 30
  // If the app was opened at login, there might be contention for lots
  // of resources, so let's bump the install timeout to something large.
  if (openedAtLogin) {
    timeout = 90
  }

  logger.warn('[Installer]: starting install-auto', {
    keybaseBin: keybaseBin || '(missing)',
    keybaseOpenFrom: process.env['KEYBASE_OPEN_FROM'] || '',
    keybaseStartUI: process.env['KEYBASE_START_UI'] || '',
    openedAtLogin,
    runMode,
    timeoutSec: timeout,
  })

  if (!keybaseBin) {
    callback(new Error('No keybase bin path'))
    return
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

  const handleResults = (
    err: ExecException | null,
    attempted: boolean,
    stdout: string,
    stderr: string
  ) => {
    // exec() no-ops (attempted=false) when platform/runMode/bin checks fail — previously ignored.
    if (!attempted) {
      logger.warn('[Installer]: install-auto was not executed', {
        err: err?.message,
        keybaseBin,
        runMode,
        stderrLen: stderr.length,
        stdoutLen: stdout.length,
      })
      callback(null)
      return
    }

    logger.warn('[Installer]: install-auto finished', {
      errCode: err?.code,
      errMessage: err?.message,
      stderrLen: stderr.length,
      stdoutLen: stdout.length,
    })

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
          logComponentResults(result)
          checkErrors(result, errors, errorTypes)
          helperInstalled = legacyHelperInstalled(result)
        } else {
          errors.push(`There was an error trying to run the install. No output.`)
        }
      } catch (parseErr) {
        logger.warn('[Installer]: failed to parse install-auto stdout', {
          parseErr: parseErr instanceof Error ? parseErr.message : String(parseErr),
          stdoutPrefix: stdout.slice(0, 500),
        })
        errors.push(
          `There was an error trying to run the install. We were unable to parse the output of keybase install-auto.`
        )
      }
    } else {
      logger.warn('[Installer]: install-auto produced empty stdout')
    }

    if (errors.length > 0) {
      logger.warn('[Installer]: Install errored', {errors})
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
      logger.warn('[Installer]: Has cli errors and not installed yet, trying CLI install')
      if (loadState().promptedForCLI) {
        logger.warn('[Installer]: Bailing on already tried to install cli previously')
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

    logger.warn('[Installer]: install-auto completed without reported errors')
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
