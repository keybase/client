import * as Electron from 'electron'
import {keybaseBinPath} from './paths.desktop'
import exec from './exec.desktop'
import {isWindows} from '@/constants/platform'
import {spawn} from 'child_process'
import {type ExecException} from 'child_process'

export function ctlStop(
  callback: (err: ExecException | null, attempted: boolean, stdout: string, stderr: string) => void
) {
  const binPath = keybaseBinPath()
  if (isWindows) {
    if (!binPath) {
      callback(new Error("cannot get keybaseBinPath which shouldn't happen"), false, '', '')
      return
    }
    spawn(binPath, ['ctl', 'stop'], {
      detached: true,
      stdio: 'inherit',
    })
    callback(null, false, '', '')
    return
  }
  const plat = 'darwin'
  const args = ['ctl', 'stop', '--exclude=app']
  exec(binPath, args, plat, 'prod', false, callback)
}

function exitApp() {
  console.log('exiting app')
  // For some reason the first app.exit kills only popups (remote components and pinentry)
  // The main window survives. This makes sure to keep exiting until we are actually out.
  // It seems to work even when we have a broken reference to a browser window.
  // (Which happens because our first exit killed the browser window w/o updating our book keeping state)
  setInterval(() => Electron.app.exit(0), 200)
  // If we haven't exited after trying, then let's ensure it happens
  setTimeout(() => exitProcess(), 500)
}

function exitProcess() {
  console.log('Forcing process exit')
  process.exit(0)
}

export function ctlQuit(appOnly: boolean = false) {
  if (appOnly || __DEV__) {
    console.log('Only quitting gui')
    exitApp()
    return
  }

  console.log('Quit the app')
  ctlStop(stopErr => {
    console.log('Done with ctlstop')
    if (stopErr) {
      console.log('Error in ctl stop, when quitting:', stopErr)
    }
    exitApp()
  })
}
