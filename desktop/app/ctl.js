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
    console.log('Only quiting app in dev mode')
    app.quit()
    return
  }

  console.log('Quit the app')
  ctlStop(function (stopErr) {
    if (stopErr) {
      console.log('Error in ctl stop, when quiting:', stopErr)
    }
    app.quit()
  })
}
