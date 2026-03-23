import * as Electron from 'electron'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import logger from '@/logger'
import os from 'os'
import {isWindows, cacheRoot} from '@/constants/platform.desktop'
import {ctlQuit} from './ctl.desktop'
import {allowMultipleInstances} from '@/local-debug.desktop'
import KB2 from '@/util/electron.desktop'
const {env} = KB2.constants

const isPathSaltpack = (p: string) =>
  p.endsWith('.signed.saltpack') || p.endsWith('.encrypted.saltpack')

export const isRelevantDeepLink = (x: string) => {
  return x.startsWith('web+stellar:') || x.startsWith('keybase://')
}

export const isValidSaltpackFilePath = (p: string) => {
  const valid = isPathSaltpack(p)
  if (!valid) {
    logger.warn(
      'Received Electron open-file event with a file not ending in either ".encrypted.saltpack" or ".signed.saltpack".'
    )
    return false
  }
  return valid
}

export const installCrashReporter = () => {
  if (env.KEYBASE_CRASH_REPORT) {
    console.log(`Adding crash reporting (local). Crash files located in ${Electron.app.getPath('temp')}`)
    Electron.app.setPath('crashDumps', cacheRoot)
    Electron.crashReporter.start({
      companyName: 'Keybase',
      productName: 'Keybase',
      submitURL: '',
      uploadToServer: false,
    })
  }
}

const areWeThePrimaryInstance = () => {
  if (allowMultipleInstances) {
    return true
  }
  return Electron.app.requestSingleInstanceLock()
}

export const appShouldDieOnStartup = () => {
  if (!areWeThePrimaryInstance()) {
    console.log('Only one instance of keybase GUI allowed, bailing!')
    return true
  }

  // Check supported OS version
  if (os.platform() === 'darwin') {
    // Release numbers for OS versions can be looked up here: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
    // 14.0.0 == 10.10.0
    // 15.0.0 == 10.11.0
    if (parseInt(os.release().split('.')[0] ?? '', 10) < 14) {
      Electron.dialog.showErrorBox('Keybase Error', "This version of macOS isn't currently supported.")
      return true
    }
  }
  return false
}

export const changeCommandLineSwitches = () => {
  // MUST do this else we get limited by simultaneous hot reload event streams
  Electron.app.commandLine.appendSwitch('ignore-connections-limit', 'localhost')
}

export const fixWindowsNotifications = () => {
  // Windows needs this for notifications to show on certain versions
  // https://msdn.microsoft.com/en-us/library/windows/desktop/dd378459(v=vs.85).aspx
  Electron.app.setAppUserModelId('Keybase.Keybase.GUI')
}

export const handleCrashes = () => {
  process.on('uncaughtException', e => {
    console.log('Uncaught exception on main thread:', e)
  })

  if (__DEV__) {
    return
  }

  Electron.app.on('browser-window-created', (_, win) => {
    win.on('unresponsive', () => {
      console.log('Browser window unresponsive')
      win.reload()
    })

    win.webContents.on('render-process-gone', (_, details) => {
      if (details.reason === 'clean-exit') return
      console.log('browser window killed', details)
      win.reload()
    })
  })
}

export const stopNav = () => {
  Electron.app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', event => {
      event.preventDefault()
    })
    contents.setWindowOpenHandler(() => {
      return {action: 'deny'}
    })
  })
}

export const focusSelfOnAnotherInstanceLaunching = (
  getMainWindow: () => Electron.BrowserWindow | null,
  commandLine: Array<string>
) => {
  const mw = getMainWindow()
  if (!mw) {
    return
  }

  mw.show()
  mw.focus()

  // The new instance might be due to a URL schema handler launch.
  logger.info('Launched with URL', commandLine)
  if (commandLine.length > 1 && commandLine[1]) {
    // Allow both argv1 and argv2 to be the link to support "/usr/lib/electron/electron path-to-app"-style
    // invocations (used in the Arch community packages).
    //
    // Windows looks like:
    // ["Keybase.exe", "--somearg", "--someotherarg", "actuallink"]
    for (const link of commandLine.slice(1)) {
      if (isRelevantDeepLink(link)) {
        R.remoteDispatch(RemoteGen.createLink({link}))
        return
      } else if (isValidSaltpackFilePath(link)) {
        R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path: link}))
        return
      }
    }
  }
}

// On Windows and Linux startup, open-file and open-url arguments will be
// passed via process.argv instead of via Electron event arguments.
export const getStartupProcessArgs = () => {
  let arg: string | undefined

  if (
    process.argv.length > 1 &&
    (isRelevantDeepLink(process.argv[1] ?? '') || isValidSaltpackFilePath(process.argv[1] ?? ''))
  ) {
    arg = process.argv[1]
  } else if (
    process.argv.length > 2 &&
    (isRelevantDeepLink(process.argv[2] ?? '') || isValidSaltpackFilePath(process.argv[2] ?? ''))
  ) {
    arg = process.argv[2]
  }

  // Bail if nothing was passed
  if (!arg) {
    logger.info(
      `Received open-file or open-url event on ${
        isWindows ? 'Windows' : 'Linux'
      } but did not get filePath or url from process.argv`
    )
    return
  }

  if (isRelevantDeepLink(arg)) {
    R.remoteDispatch(RemoteGen.createLink({link: arg}))
  } else if (isValidSaltpackFilePath(arg)) {
    R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path: arg}))
  }
}

export const handleActivate = (getMainWindow: () => Electron.BrowserWindow | null) => {
  getMainWindow()?.show()
  const dock = Electron.app.dock
  dock
    ?.show()
    .then(() => {})
    .catch(() => {})
}

export const handleQuitting = (event: Electron.Event) => {
  console.log('Quit through before-quit')
  event.preventDefault()
  ctlQuit()
}

export const willFinishLaunching = (deps: {
  getAppStartedUp: () => boolean
  setSaltpackFilePath: (path: string) => void
  setStartupURL: (url: string) => void
}) => {
  Electron.app.on('open-file', (event, path) => {
    event.preventDefault()
    if (!deps.getAppStartedUp()) {
      deps.setSaltpackFilePath(path)
    } else {
      R.remoteDispatch(RemoteGen.createSaltpackFileOpen({path}))
    }
  })

  Electron.app.on('open-url', (event, link) => {
    event.preventDefault()
    if (!deps.getAppStartedUp()) {
      deps.setStartupURL(link)
    } else {
      R.remoteDispatch(RemoteGen.createLink({link}))
    }
  })
}
