import {execFile, type ChildProcess, type ExecException} from 'child_process'
import fs from 'fs'
import os from 'os'

import {runMode} from '@/constants/platform'
import {ensureError} from '@/util/errors'

const killOnExitChildren = new Set<ChildProcess>()
let exitListenerAdded = false
const killChildOnExit = (child: ChildProcess) => {
  killOnExitChildren.add(child)
  child.once('exit', () => killOnExitChildren.delete(child))
  if (exitListenerAdded) return
  exitListenerAdded = true
  process.on('exit', () => {
    killOnExitChildren.forEach(c => c.kill())
  })
}

// Execute at path with args.
// If you specify platformOnly or runModeOnly, then callback will be called
// without error if we don't match that environment.
// If killOnExit is true, then the executing process will be killed if the
// parent process is killed.
// Callback is optional and accepts (error, boolean), where boolean is if we
// attempted to execute.
export default function exec(
  path: string | undefined,
  args: Array<string>,
  platformOnly: undefined | ReturnType<typeof os.platform>,
  runModeOnly: string | undefined,
  killOnExit: boolean,
  callback: (err: ExecException | null, attempted: boolean, stdout: string, stderr: string) => void
): void {
  const platform = os.platform()
  if (platformOnly && platform !== platformOnly) {
    console.log('Exec (%s) not available for platform: %s != %s', path, platformOnly, platform)
    callback(null, false, '', '')
    return
  }
  if (!path) {
    console.log('Exec path not available:', path)
    callback(null, false, '', '')
    return
  }
  if (runModeOnly && runMode !== runModeOnly) {
    console.log('Exec path not available for this run mode: %s != %s', runModeOnly, runMode)
    callback(null, false, '', '')
    return
  }

  fs.access(path, fs.constants.X_OK, function (err) {
    if (err) {
      console.log('Exec path not found (or accessible as executable):', path)
      callback(null, false, '', '')
      return
    }

    console.log('Executing:', path, args.join(' '))
    let child: ChildProcess
    try {
      child = execFile(path, args, function (execErr, stdout, stderr) {
        if (stdout) {
          console.log('Exec (stdout):', stdout)
        }
        if (stderr) {
          console.log('Exec (stderr):', stderr)
        }
        if (execErr) {
          console.log('Exec (err):', execErr)
        }
        callback(execErr, true, stdout, stderr)
      })
    } catch (error) {
      // this runs in the fs.access callback, past any try/catch of the caller, so a throwing callback is logged
      console.log('Exec (err):', error)
      try {
        callback(Object.assign(ensureError(error), {cmd: [path, ...args].join(' ')}), true, '', '')
      } catch (callbackError) {
        console.log('Exec (callback threw):', callbackError)
      }
      return
    }

    if (killOnExit) {
      killChildOnExit(child)
    }
  })
}
