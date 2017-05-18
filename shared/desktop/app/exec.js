// @flow
import {exec} from 'child_process'
import fs from 'fs'
import os from 'os'

import {runMode} from '../../constants/platform.desktop'

// Execute at path with args.
// If you specify platformOnly or runModeOnly, then callback will be called
// without error if we don't match that environment.
// If killOnExit is true, then the executing process will be killed if the
// parent process is killed.
// Callback is optional and accepts (error, boolean), where boolean is if we
// attempted to execute.
export default function(
  path: ?string,
  args: any,
  platformOnly: any,
  runModeOnly: ?string,
  killOnExit: boolean,
  callback: (err: any, attempted: boolean) => void
): void {
  const platform = os.platform()
  if (platformOnly && platform !== platformOnly) {
    console.log('Exec (%s) not available for platform: %s != %s', path, platformOnly, platform)
    if (callback) callback(null, false)
    return
  }
  if (!path) {
    console.log('Exec path not available:', path)
    if (callback) callback(null, false)
    return
  }
  if (runModeOnly && runMode !== runModeOnly) {
    console.log('Exec path not available for this run mode: %s != %s', runModeOnly, runMode)
    if (callback) callback(null, false)
    return
  }

  fs.access(path, fs.X_OK, function(err) {
    if (err) {
      console.log('Exec path not found (or accessible as executable):', path)
      if (callback) callback(null, false)
      return
    }

    args.unshift(path)
    var cmd = args.join(' ')
    console.log('Executing:', cmd)
    var procExec = exec(cmd, function(execErr, stdout, stderr) {
      if (stdout) {
        console.log('Exec (stdout):', stdout)
      }
      if (stderr) {
        console.log('Exec (stderr):', stderr)
      }
      if (execErr) {
        console.log('Exec (err):', execErr)
      }
      if (callback) callback(execErr, true)
    })

    if (killOnExit && procExec) {
      // Kill the process if parent process exits
      process.on('exit', function() {
        procExec.kill()
      })
    }
  })
}
