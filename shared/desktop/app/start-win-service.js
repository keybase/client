// @flow
import {spawn} from 'child_process'
import {keybaseBinPath} from './paths'

export default function() {
  console.log('Not connected - starting keybase')
  const binPath = keybaseBinPath()
  if (!binPath) {
    return
  }
  const rqPath = binPath.replace('keybase.exe', 'keybaserq.exe')
  const wdLogPath = binPath.replace('keybase.exe', 'watchdog')
  const args = [binPath, 'ctl', 'watchdog2', '--log-prefix=' + wdLogPath]

  spawn(rqPath, args, {
    detached: true,
    stdio: 'ignore',
  })
}
