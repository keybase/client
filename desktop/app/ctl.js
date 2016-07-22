import {app} from 'electron'
import {keybaseBinPath} from './paths'
import exec from './exec'

export function ctlStop (callback) {
  const binPath = keybaseBinPath()
  // Don't need to stop app, since we will quit ourselves
  // We don't stop the updater either since quit may be triggered from the
  // updater itself.
  // See https://keybase.atlassian.net/browse/CORE-3418
  const args = ['ctl', 'stop', '--exclude=app,updater', '--no-wait']
  exec(binPath, args, 'darwin', 'prod', false, callback)
}

export function quit () {
  // Only quit the app in dev mode
  if (__DEV__) {
    console.log('Only quiting gui in dev mode')
    app.quit()
    return
  }

  console.log('Quit the app')
  ctlStop(function (stopErr) {
    console.log('Done with ctlstop')
    if (stopErr) {
      console.log('Error in ctl stop, when quiting:', stopErr)
    }
    app.quit()
  })
}
