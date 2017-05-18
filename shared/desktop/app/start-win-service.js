// @flow
import {spawn} from 'child_process'
import {keybaseBinPath} from './paths'

export default function () {
  console.log('Not connected - starting keybase')
  const binPath = keybaseBinPath()
  if (!binPath) {
    console.log('No keybaseBinPath')
    return
  }
  const rqPath = binPath.replace('keybase.exe', 'keybaserq.exe')
  const args = [binPath, 'ctl', 'watchdog2']

  spawn(rqPath, args, {
    detached: true,
    stdio: 'ignore',
  })
}
