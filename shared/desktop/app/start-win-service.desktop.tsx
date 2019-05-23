import {spawn} from 'child_process'
import {keybaseBinPath} from './paths.desktop'

export default function() {
  console.log('Not connected - starting keybase')
  const binPath = keybaseBinPath()
  if (!binPath) {
    return
  }
  const rqPath = binPath.replace('keybase.exe', 'keybaserq.exe')
  const wdLogPath = binPath.replace('keybase.exe', 'watchdog.')
  const args = [binPath, '--log-format=file', '--log-prefix=' + wdLogPath, 'ctl', 'watchdog2']

  spawn(rqPath, args, {
    detached: true,
    stdio: 'ignore',
  })
}
