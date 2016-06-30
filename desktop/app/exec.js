import {exec} from 'child_process'
import fs from 'fs'
import os from 'os'

import {runMode} from '../shared/constants/platform.native.desktop'

export default function (path, args, platformOnly, runModeOnly, callback) {
  const platform = os.platform()
  if (platformOnly && platform !== platformOnly) {
    console.log('Exec (%s) not available for platform: %s != %s', path, platformOnly, platform)
    callback(null)
    return
  }
  if (!path) {
    console.log('Exec path not available:', path)
    callback(null)
    return
  }
  if (runModeOnly && runMode !== runModeOnly) {
    // Only run in prod
    console.log('Exec path not available for this run mode: %s != %s', runModeOnly, runMode)
    callback(null)
    return
  }

  fs.access(path, fs.X_OK, function (err) {
    if (err) {
      console.log('Exec path not found (or accessible as executable):', path)
      callback(null)
      return
    }

    args.unshift(path)
    var cmd = args.join(' ')
    console.log('Executing:', cmd)
    var proc = exec(cmd, function (execErr, stdout, stderr) {
      if (stdout) {
        console.log('Exec (stdout):', stdout)
      }
      if (stderr) {
        console.log('Exec (stderr):', stderr)
      }
      if (execErr) {
        console.log('Exec (err):', execErr)
      }
      if (callback) {
        callback(execErr)
      }
    })

    // Kill the process if parent process exits
    proc.on('exit', function () {
      proc.kill()
    })
  })
}
