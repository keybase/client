import capitalize from 'lodash/capitalize'
import KB2 from '@/util/electron'
// Native-only modules — nulled to empty on desktop (native-only-modules.js), so the
// isMobile-guarded uses below are dead code there.
import * as RNKBmod from 'react-native-kb'
import ExpoConstants from 'expo-constants'
import {Platform as RNPlatform, Dimensions as RNDimensions} from 'react-native'

// ─── Mobile runtime imports ────────────────────────────────────────────────
// These are all guarded with isMobile so they won't execute on desktop.

type RNKBModule = {
  androidIsDeviceSecure: boolean
  androidIsTestDevice: boolean
  fsCacheDir: string
  uses24HourClock: boolean
  version: string
  fsDownloadDir?: string
}

const _getRNKB = (): RNKBModule => RNKBmod as unknown as RNKBModule

// ─── Platform detection ────────────────────────────────────────────────────

export const isDarwin: boolean = isMobile ? false : KB2.constants.platform === 'darwin'
export const isWindows: boolean = isMobile ? false : KB2.constants.platform === 'win32'
export const isLinux: boolean = isMobile ? false : KB2.constants.platform === 'linux'
export const isMac: boolean = isDarwin && !isIOS

export const getModKey = (e: {metaKey: boolean; ctrlKey: boolean}): boolean => {
  if (isMobile) return false
  return isMac ? e.metaKey : e.ctrlKey
}

export const defaultUseNativeFrame: boolean = isMobile ? true : isDarwin || isLinux
// For storyshots, we only want to test macOS
export const fileUIName: string = isMobile
  ? 'File Explorer'
  : isDarwin
    ? 'Finder'
    : isWindows
      ? 'Explorer'
      : 'File Explorer'
export const shortcutSymbol: string = isMobile ? '' : isDarwin ? '⌘' : 'Ctrl-'
export const realDeviceName: string = isMobile
  ? (() => {
      const Constants = ExpoConstants as unknown as {deviceName?: string | null}
      return Constants.deviceName ?? ''
    })()
  : ''

// ─── Mobile-only exports ──────────────────────────────────────────────────

export const isTablet: boolean = isMobile
  ? (() => {
      const Platform = RNPlatform as unknown as {OS: string; isPad?: boolean}
      return Platform.OS === 'ios' && !!Platform.isPad
    })()
  : false

export const isPhone: boolean = isMobile ? !isTablet : false
export const isDebuggingInChrome: boolean = isMobile ? typeof location !== 'undefined' : true

export const mobileOsVersion: string | number = isMobile
  ? (() => {
      const Platform = RNPlatform as unknown as {Version: string | number}
      return Platform.Version
    })()
  : ''

const _mobileOsVersionNumber: number = isMobile
  ? typeof mobileOsVersion === 'string'
    ? parseInt(mobileOsVersion)
    : (mobileOsVersion as number)
  : 0

export const isAndroidNewerThanM: boolean = isAndroid && _mobileOsVersionNumber > 22
export const isAndroidNewerThanN: boolean = isAndroid && _mobileOsVersionNumber >= 26
// Currently this is given to us as a boolean, but no real documentation on this, so just in case it changes in the future.
// Android only field that tells us if there is a lock screen.
export const isDeviceSecureAndroid: boolean = isMobile ? _getRNKB().androidIsDeviceSecure : false
export const androidIsTestDevice: boolean = isMobile ? _getRNKB().androidIsTestDevice : false
export const isNewArch: boolean = isMobile ? !!global.__turboModuleProxy : false

// isLargeScreen means you have at larger screen like iPhone 6,7 or Pixel
// See https://material.io/devices/
export const isLargeScreen: boolean = isMobile
  ? (() => {
      const Dimensions = RNDimensions as unknown as {
        get: (name: string) => {height: number; width: number}
      }
      return Dimensions.get('window').height >= 667
    })()
  : true

// ─── Desktop-only path helpers ────────────────────────────────────────────

export const dokanPath: string = isMobile ? '' : KB2.constants.dokanPath
export const windowsBinPath: string = isMobile ? '' : KB2.constants.windowsBinPath
export const pathSep: string = isMobile ? '/' : KB2.constants.pathSep

const _join = (...args: Array<string>): string =>
  [...args].join(pathSep).replace(new RegExp(`${pathSep}+`, 'g'), pathSep)
const _joinAddSep = (...args: Array<string>): string => _join(...args) + pathSep

const socketName = 'keybased.sock'

const _getLinuxPaths = () => {
  const env = KB2.constants.env
  const homeEnv = env.HOME
  const runMode = env.KEYBASE_RUN_MODE
  const useXDG = (runMode !== 'devel' || env.KEYBASE_DEVEL_USE_XDG) && !env.KEYBASE_XDG_OVERRIDE
  const homeConfigDir = (useXDG && env.XDG_CONFIG_HOME) || _join(homeEnv, '.config')
  const runtimeDir = (useXDG && env.XDG_RUNTIME_DIR) || ''
  const socketDir = (useXDG && runtimeDir) || homeConfigDir
  const appName = `keybase${runMode === 'prod' ? '' : `.${runMode}`}`

  if (!runtimeDir && !homeEnv) {
    console.warn("You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path.")
  }

  const logDir = (useXDG && env.XDG_CACHE_HOME) || _join(homeEnv, '.cache', appName)
  return {
    cacheRoot: logDir,
    dataRoot: (useXDG && env.XDG_DATA_HOME) || _join(homeEnv, '.local/share', appName),
    guiConfigFilename: _join(homeConfigDir, appName, 'gui_config.json'),
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: _join(socketDir, appName, socketName),
  }
}

const _getWindowsPaths = () => {
  const env = KB2.constants.env
  const runMode = env.KEYBASE_RUN_MODE
  const appName = `Keybase${runMode === 'prod' ? '' : capitalize(runMode)}`
  let appdata = env.LOCALAPPDATA || ''
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  const dir = `\\\\.\\pipe\\kbservice${appdata}\\${appName}`
  const logDir = _joinAddSep(env.LOCALAPPDATA, appName)
  return {
    cacheRoot: _joinAddSep(env.APPDATA, appName),
    dataRoot: _joinAddSep(env.LOCALAPPDATA, appName),
    guiConfigFilename: _join(env.LOCALAPPDATA, appName, 'gui_config.json'),
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: _join(dir, socketName),
  }
}

const _getDarwinPaths = () => {
  const env = KB2.constants.env
  const homeEnv = env.HOME
  const runMode = env.KEYBASE_RUN_MODE
  const appName = `Keybase${runMode === 'prod' ? '' : capitalize(runMode)}`
  const libraryDir = `${homeEnv}/Library/`
  const logDir = `${libraryDir}Logs/`
  return {
    cacheRoot: `${libraryDir}Caches/${appName}/`,
    dataRoot: `${libraryDir}Application Support/${appName}/`,
    guiConfigFilename: `${libraryDir}Application Support/${appName}/gui_config.json`,
    jsonDebugFileName: `${logDir}${appName}.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}${appName}.app.serverConfig`,
    socketPath: _join(`${libraryDir}Caches`, appName, socketName),
  }
}

// Desktop paths — computed once, undefined on mobile
const _desktopPaths = isMobile
  ? undefined
  : (isLinux ? _getLinuxPaths() : undefined) ||
    (isWindows ? _getWindowsPaths() : undefined) ||
    (isDarwin ? _getDarwinPaths() : undefined)

if (!isMobile && !_desktopPaths) {
  throw new Error('Unknown OS')
}

if (__DEV__ && !isMobile) {
  console.log(`Run mode: ${KB2.constants.env.KEYBASE_RUN_MODE}`)
}

export const runMode: string = isMobile ? 'prod' : KB2.constants.env.KEYBASE_RUN_MODE
export const dataRoot: string = isMobile ? '' : _desktopPaths!.dataRoot
export const cacheRoot: string = isMobile ? '' : _desktopPaths!.cacheRoot
export const socketPath: string = isMobile ? '' : _desktopPaths!.socketPath
export const jsonDebugFileName: string = isMobile ? '' : _desktopPaths!.jsonDebugFileName
export const guiConfigFilename: string = isMobile ? '' : _desktopPaths!.guiConfigFilename

// serverConfigFileName: on mobile it lives under fsCacheDir; on desktop from OS paths
export const serverConfigFileName: string = isMobile
  ? `${_getRNKB().fsCacheDir}/Keybase/keybase.app.serverConfig`
  : _desktopPaths!.serverConfigFileName

// Native-specific dir exports
export const logFileDir: string = isMobile ? `${_getRNKB().fsCacheDir}/Keybase` : ''
// Empty string means let the service figure out the right directory.
export const pprofDir: string = isMobile ? `${_getRNKB().fsCacheDir}/Keybase` : ''
export const fsCacheDir: string = isMobile ? _getRNKB().fsCacheDir : ''
export const downloadFolder: string = isMobile
  ? ''
  : KB2.constants.env.XDG_DOWNLOAD_DIR || KB2.constants.downloadFolder

export const version: string = isMobile ? _getRNKB().version : __VERSION__

export const uses24HourClock: boolean = isMobile
  ? _getRNKB().uses24HourClock
  : (() => {
      const env = KB2.constants.env
      const getTimeLocale = (): string | string[] => {
        if (!isLinux) {
          return Intl.DateTimeFormat().resolvedOptions().locale
        }
        const locale = env.LC_ALL || env.LC_TIME || env.LANG
        if (locale) {
          return locale.slice(0, 2)
        }
        return []
      }
      try {
        return new Date('1999 Jan 1 20:00').toLocaleString(getTimeLocale()).includes(' 20:')
      } catch {
        return false
      }
    })()

export const getAssetPath = (...a: Array<string>): string => {
  if (isMobile) return ''
  return KB2.constants.assetRoot + a.join('/')
}

export const getSecureFlagSetting = async (): Promise<boolean> => {
  if (!isMobile) {
    await Promise.resolve()
    return false
  }
  if (!isAndroid) return false
  try {
    const RPCGen = await import('@/constants/rpc/rpc-gen')
    const screenProtectorConfigKey = 'ui.screenprotector'
    const value = await RPCGen.configGuiGetValueRpcPromise({path: screenProtectorConfigKey})
    // Default to secure (true) if not explicitly set
    if (!value.isNull && value.b === false) return false
    return true
  } catch {
    return true
  }
}

export const setSecureFlagSetting = async (secure: boolean): Promise<boolean> => {
  if (!isMobile) {
    await Promise.resolve()
    return false
  }
  if (!isAndroid) return false
  try {
    const ScreenCapture = await import('expo-screen-capture')
    const RPCGen = await import('@/constants/rpc/rpc-gen')
    const screenProtectorConfigKey = 'ui.screenprotector'
    if (secure) {
      await ScreenCapture.preventScreenCaptureAsync('screenprotector')
    } else {
      await ScreenCapture.allowScreenCaptureAsync('screenprotector')
    }
    await RPCGen.configGuiSetValueRpcPromise({
      path: screenProtectorConfigKey,
      value: {b: secure, isNull: false},
    })
    return true
  } catch {
    return false
  }
}
