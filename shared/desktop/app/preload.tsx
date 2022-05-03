import path from 'path'
import os from 'os'
import {execFile} from 'child_process'
import * as SafeElectron from '../../util/safe-electron.desktop'

const getTimeLocale = (isLinux: boolean) => {
  if (!isLinux) {
    return Intl.DateTimeFormat().resolvedOptions().locale
  }
  const locale = process.env.LC_ALL || process.env.LC_TIME || process.env.LANG
  if (locale) {
    return locale.slice(0, 2)
  }
  return []
}
const uses24HourClockF = (isLinux: boolean) => {
  try {
    return new Date('1999 Jan 1 20:00').toLocaleString(getTimeLocale(isLinux)).includes(' 20:')
  } catch {
    // unknown locale
    return false
  }
}

// TODO think about htis
const checkRPCOwnership = async () => {
  const localAppData = String(process.env.LOCALAPPDATA)
  const binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
  const args = ['pipeowner', socketPath]
  return new Promise<void>((resolve, reject) => {
    execFile(binPath, args, {windowsHide: true}, (error, stdout) => {
      if (error) {
        console.log(`pipeowner check result: ${stdout.toString()}`)
        // error will be logged in bootstrap check
        getEngine().reset()
        reject(error)
        return
      }
      const result = JSON.parse(stdout.toString())
      if (result.isOwner) {
        resolve(undefined)
        return
      }
      console.log(`pipeowner check result: ${stdout.toString()}`)
      reject(new Error('pipeowner check failed'))
    })
  })
}

const imageResolvers = (constants: typeof global.KB.constants) => {
  const appPath = SafeElectron.getApp().getAppPath()
  const root = !__DEV__ ? path.join(appPath, './desktop') : path.join(__dirname, '..')
  const prefix = constants.isWindows ? 'file:///' : 'file://'
  const fixRegExp = new RegExp('\\' + constants.pathSep, 'g')
  const fixPath =
    constants.pathSep === '/' ? (s: string) => s : (s: string) => (s ? s.replace(fixRegExp, '/') : s)
  const fix = (s: string) => encodeURI(fixPath(s))
  const imageRoot = path.resolve(root, '..', 'images')
  const resolveRoot = (...to: Array<string>) => path.resolve(root, ...to)
  const resolveRootAsURL = (...to: Array<string>) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
  const resolveImage = (...to: Array<string>) => path.join(imageRoot, ...to)
  const resolveImageAsURL = (...to: Array<string>) => `${prefix}${fix(resolveImage(...to))}`
  return {
    resolveImage,
    resolveImageAsURL,
    resolveRoot,
    resolveRootAsURL,
  }
}

const makeHelpers = (constants: typeof global.KB.constants): typeof KB.functions => {
  return {
    ...imageResolvers(),
  }
}

// const remote = require(isRenderer ? '@electron/remote' : '@electron/remote/main')

const makeConstants = (): typeof KB.constants => {
  const constants: typeof KB.constants = {
    binPath: '',
    cacheRoot: '',
    dataRoot: '',
    downloadFolder: '',
    guiConfigFilename: '',
    isDarwin: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    isMac: process.platform === 'darwin',
    isRenderer: process.type === 'renderer',
    isWindows: process.platform === 'win32',
    jsonDebugFileName: '',
    logDir: '',
    pathSep: path.sep,
    pid: process.pid,
    runMode: process.env['KEYBASE_RUN_MODE'] || 'prod',
    serverConfigFileName: '',
    socketPath: '',
    useFakeEngine: process.env.KEYBASE_NO_ENGINE === '1',
    uses24HourClock: false,
  }

  constants.downloadFolder = process.env.XDG_DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads')
  constants.uses24HourClock = uses24HourClockF(constants.isLinux)

  const socketName = 'keybased.sock'
  const guiConfigName = 'gui_config.json'
  const runMode = constants.runMode
  if (__DEV__) {
    console.log(`Run mode: ${runMode}`)
  }
  const homeEnv = process.env['HOME'] || ''
  let appName: string = ''

  switch (process.platform) {
    case 'darwin':
      {
        appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
        const libraryDir = `${homeEnv}/Library/`
        constants.logDir = `${libraryDir}Logs/`
        constants.cacheRoot = `${libraryDir}Caches/${appName}/`
        constants.dataRoot = `${libraryDir}Application Support/${appName}/`
        constants.guiConfigFilename = `${constants.dataRoot}${guiConfigName}`
        constants.socketPath = path.join(
          `${libraryDir}Group Containers/keybase/Library/Caches/${appName}/`,
          socketName
        )
        constants.binPath = path.resolve(
          SafeElectron.getApp().getAppPath(),
          '..',
          '..',
          '..',
          'Contents',
          'SharedSupport',
          'bin',
          'keybase'
        )
      }
      break
    case 'win32':
      {
        appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
        let appdata = process.env['LOCALAPPDATA'] || ''
        // Remove leading drive letter e.g. C:
        if (/^[a-zA-Z]:/.test(appdata)) {
          appdata = appdata.slice(2)
        }
        constants.logDir = `${process.env['LOCALAPPDATA'] || ''}\\${appName}\\`
        constants.cacheRoot = `${process.env['APPDATA'] || ''}\\${appName}\\`
        constants.dataRoot = constants.logDir
        constants.guiConfigFilename = `${constants.logDir}${guiConfigName}`
        constants.socketPath = path.join(`\\\\.\\pipe\\kbservice${appdata}\\${appName}`, socketName)

        let guiAppPath = SafeElectron.getApp().getAppPath()
        if (process.env.LOCALAPPDATA && !guiAppPath) {
          guiAppPath = path.resolve(process.env.LOCALAPPDATA, 'Keybase', 'Gui', 'resources', 'app')
        }
        if (!guiAppPath) {
          console.log('No keybase bin path')
        } else {
          const kbPath = path.resolve(guiAppPath, '..', '..', '..')
          console.log(`expected path to keybase binaries is ${kbPath}`)
          constants.binPath = path.resolve(String(kbPath), 'keybase.exe')
        }
      }
      break
    case 'linux':
      {
        const useXDG =
          (runMode !== 'devel' || process.env['KEYBASE_DEVEL_USE_XDG']) &&
          !process.env['KEYBASE_XDG_OVERRIDE']

        // If XDG_RUNTIME_DIR is defined use that, else use $HOME/.config.
        const homeConfigDir = (useXDG && process.env['XDG_CONFIG_HOME']) || path.join(homeEnv, '.config')
        const runtimeDir = (useXDG && process.env['XDG_RUNTIME_DIR']) || ''
        const socketDir = (useXDG && runtimeDir) || homeConfigDir
        appName = `keybase${runMode === 'prod' ? '' : `.${runMode}`}`

        if (!runtimeDir && !homeEnv) {
          console.warn(
            "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
          )
        }

        constants.logDir = `${(useXDG && process.env['XDG_CACHE_HOME']) || `${homeEnv}/.cache`}/${appName}/`
        constants.cacheRoot = constants.logDir
        constants.dataRoot = `${
          (useXDG && process.env['XDG_DATA_HOME']) || `${homeEnv}/.local/share`
        }/${appName}/`
        constants.guiConfigFilename = `${homeConfigDir}/${appName}/${guiConfigName}`
        constants.socketPath = path.join(socketDir, appName, socketName)
      }
      break
  }

  constants.jsonDebugFileName = `${constants.logDir}${appName}.app.debug`
  constants.serverConfigFileName = `${constants.logDir}${appName}.app.serverConfig`
  return constants
}

const makePreload = () => {
  const constants = makeConstants()
  const helpers = makeHelpers(constants)
  return {constants, helpers}
}

export default makePreload()
