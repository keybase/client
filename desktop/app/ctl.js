import {keybaseBinPath} from './paths'
import exec from './exec'

export function ctlStop () {
  const binPath = keybaseBinPath()
  const args = ['ctl', 'stop']
  exec(binPath, args, 'darwin', 'prod', function () {})
}
