import KB2 from '../util/electron.desktop'
import * as Path from '../util/path'
const {env, platform} = KB2.constants

export const androidIsTestDevice = false
export const isMobile = false
export const isPhone = false
export const isAndroid = false
export const isIOS = false
export const isLargeScreen = true
export const isIPhoneX = false
export const isTablet = false
export const windowHeight = 0 // not implemented on desktop
export const isDebuggingInChrome = true

export const dokanPath = KB2.constants.dokanPath
export const windowsBinPath = KB2.constants.windowsBinPath
export const pathSep = KB2.constants.pathSep

export const isElectron = true
export const isDarwin = platform === 'darwin'
export const isWindows = platform === 'win32'
export const isLinux = platform === 'linux'
export const isMac = isDarwin && !isIOS

export const isAndroidNewerThanN = false
export const shortcutSymbol = isDarwin ? '⌘' : 'Ctrl-'
export const realDeviceName = ''

export const defaultUseNativeFrame = isDarwin || isLinux

// For storyshots, we only want to test macOS
export const fileUIName = isDarwin || __STORYBOOK__ ? 'Finder' : isWindows ? 'Explorer' : 'File Explorer'

const runMode = env.KEYBASE_RUN_MODE
const homeEnv = env.HOME

if (__DEV__ && !__STORYBOOK__) {
  console.log(`Run mode: ${runMode}`)
}

const socketName = 'keybased.sock'

const getLinuxPaths = () => {
  const useXDG = (runMode !== 'devel' || env.KEYBASE_DEVEL_USE_XDG) && !env.KEYBASE_XDG_OVERRIDE

  // If XDG_RUNTIME_DIR is defined use that, else use $HOME/.config.
  const homeConfigDir = (useXDG && env.XDG_CONFIG_HOME) || Path.join(homeEnv, '.config')
  const runtimeDir = (useXDG && env.XDG_RUNTIME_DIR) || ''
  const socketDir = (useXDG && runtimeDir) || homeConfigDir

  const appName = `keybase${runMode === 'prod' ? '' : `.${runMode}`}`

  if (!runtimeDir && !homeEnv) {
    console.warn(
      "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
    )
  }

  const logDir = (useXDG && env.XDG_CACHE_HOME) || Path.join(homeEnv, '.cache', appName)

  return {
    cacheRoot: logDir,
    dataRoot: (useXDG && env.XDG_DATA_HOME) || Path.join(homeEnv, '.local/share', appName),
    guiConfigFilename: Path.join(homeConfigDir, appName, 'gui_config.json'),
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: Path.join(socketDir, appName, socketName),
  }
}

const getWindowsPaths = () => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  let appdata = env.LOCALAPPDATA || ''
  // Remove leading drive letter e.g. C:
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  const dir = `\\\\.\\pipe\\kbservice${appdata}\\${appName}`
  const logDir = Path.joinAddSep(env.LOCALAPPDATA, appName)
  return {
    cacheRoot: Path.joinAddSep(env.APPDATA, appName),
    dataRoot: Path.joinAddSep(env.LOCALAPPDATA, appName),
    guiConfigFilename: Path.join(env.LOCALAPPDATA, appName, 'gui_config.json'),
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: Path.join(dir, socketName),
  }
}

const getDarwinPaths = () => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  const libraryDir = `${homeEnv}/Library/`
  const logDir = `${libraryDir}Logs/`

  return {
    cacheRoot: `${libraryDir}Caches/${appName}/`,
    dataRoot: `${libraryDir}Application Support/${appName}/`,
    guiConfigFilename: `${libraryDir}Application Support/${appName}/gui_config.json`,
    jsonDebugFileName: `${logDir}${appName}.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}${appName}.app.serverConfig`,
    socketPath: Path.join(`${libraryDir}Group Containers/keybase/Library/Caches`, appName, socketName),
  }
}

const paths =
  (isLinux && getLinuxPaths()) || (isWindows && getWindowsPaths()) || (isDarwin && getDarwinPaths())
if (!paths) {
  throw new Error('Unknown OS')
}

export const {dataRoot, cacheRoot, socketPath, jsonDebugFileName, serverConfigFileName, guiConfigFilename} =
  paths

export const downloadFolder = __STORYBOOK__ ? '' : env.XDG_DOWNLOAD_DIR || KB2.constants.downloadFolder

// Empty string means let the service figure out the right directory.
export const pprofDir = ''
export const version = 'TODO'
export {runMode}

const getTimeLocale = () => {
  if (!isLinux) {
    return Intl.DateTimeFormat().resolvedOptions().locale
  }
  const locale = env.LC_ALL || env.LC_TIME || env.LANG
  if (locale) {
    return locale.slice(0, 2)
  }
  return []
}
const uses24HourClockF = () => {
  try {
    return new Date('1999 Jan 1 20:00').toLocaleString(getTimeLocale()).includes(' 20:')
  } catch {
    // unknown locale
    return false
  }
}
export const uses24HourClock = uses24HourClockF()
export const getAssetPath = (...a: Array<string>) => KB2.constants.assetRoot + a.join('/')
