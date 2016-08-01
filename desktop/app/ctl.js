import {app} from 'electron'
import {keybaseBinPath} from './paths'
import exec from './exec'

export function ctlStop (callback) {
  const binPath = keybaseBinPath()
  const args = ['ctl', 'stop', '--exclude=app', '--no-wait']
  exec(binPath, args, 'darwin', 'prod', false, callback)
}

export function quit () {
  // Only quit the app in dev mode
  if (__DEV__) {
    console.log('Only quiting gui in dev mode')
    app.exit(0)
    return
  }

  console.log('Quit the app')
  ctlStop(function (stopErr) {
    console.log('Done with ctlstop')
    if (stopErr) {
      console.log('Error in ctl stop, when quiting:', stopErr)
    }
    app.exit(0)
  })
}
