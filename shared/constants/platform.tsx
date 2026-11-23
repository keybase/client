import capitalize from 'lodash/capitalize'
import KB2 from '@/util/electron'
// Native-only modules — nulled to empty on desktop (native-only-modules.js), so the
// isMobile-guarded uses below are dead code there.
import * as RNKBmod from 'react-native-kb'
import {isGlassEffectAPIAvailable, isLiquidGlassAvailable} from 'expo-glass-effect'
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

// ─── Mobile-only exports ──────────────────────────────────────────────────

export const isTablet: boolean = isMobile
  ? (() => {
      const Platform = RNPlatform as unknown as {OS: string; isPad?: boolean}
      return Platform.OS === 'ios' && !!Platform.isPad
    })()
  : false

export const isPhone: boolean = isMobile ? !isTablet : false
// The app renders the Liquid Glass design and the UIGlassEffect API exists (missing on some iOS 26 betas)
export const isLiquidGlassSupported: boolean = isIOS && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
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
// Android decodes HEIC/HEIF from 9 (P) on
export const isAndroidPreP: boolean = isAndroid && _mobileOsVersionNumber < 28
export const isAndroidPreQ: boolean = isAndroid && _mobileOsVersionNumber < 29
export const isAndroidQ: boolean = isAndroid && _mobileOsVersionNumber === 29
// Currently this is given to us as a boolean, but no real documentation on this, so just in case it changes in the future.
// Android only field that tells us if there is a lock screen.
export const isDeviceSecureAndroid: boolean = isMobile ? _getRNKB().androidIsDeviceSecure : false
export const androidIsTestDevice: boolean = isMobile ? _getRNKB().androidIsTestDevice : false

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

// pathSep is a backslash on windows, which is a regex escape, so it can't go in a pattern raw
const _sepRun = new RegExp(`${pathSep.replaceAll(/[\\^$*+?.()|[\]{}]/g, '\\$&')}+`, 'g')
const _join = (...args: Array<string>): string => [...args].join(pathSep).replace(_sepRun, pathSep)
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

const screenProtectorConfigKey = 'ui.screenprotector'
// The screen protector when the setting was never saved: on for Android (its native default is a
// secure window), off for iOS, which shipped without one, so updating changes nothing there.
const secureByDefault = isAndroid

// The saved setting. One that can't be read counts as on: a failed read must not leave a user who
// turned the protector on unprotected.
export const getSecureFlagSetting = async (): Promise<boolean> => {
  if (!isMobile) {
    await Promise.resolve()
    return false
  }
  try {
    const RPCGen = await import('@/constants/rpc/rpc-gen')
    const value = await RPCGen.configGuiGetValueRpcPromise({path: screenProtectorConfigKey})
    return value.isNull ? secureByDefault : value.b !== false
  } catch {
    return true
  }
}

// Android starts protected at launch (constants/init), before any apply
let screenProtectorOn = isAndroid
// Counts the user's changes to the setting, so a startup read that a change overtook is not applied.
let screenProtectorWrites = 0
export const screenProtectorWriteCount = () => screenProtectorWrites

// Turns the screen protector on or off. Android's secure window keeps the app out of screenshots,
// screen recordings and the app switcher. On iOS screenshots leave out the window that was key when
// it was turned on, a recording shows a cover over the app, and the app switcher shows a blur.
export const applyScreenProtector = async (secure: boolean) => {
  screenProtectorOn = secure
  const ScreenCapture = await import('expo-screen-capture')
  if (secure) {
    // first, so app switcher protection holds even when there is no window to protect yet
    if (isIOS) await ScreenCapture.enableAppSwitcherProtectionAsync()
    await ScreenCapture.preventScreenCaptureAsync('screenprotector')
  } else {
    await ScreenCapture.allowScreenCaptureAsync('screenprotector')
    if (isIOS) await ScreenCapture.disableAppSwitcherProtectionAsync()
  }
}

// iOS protects only the window that was key when the protector went on, and fails when there was
// none (a launch into the background). On becoming active the window is protected again; the library
// reaches native only for its first call under a key, so this calls native itself, which does nothing
// for a window already protected.
export const reapplyScreenProtectorIOS = async () => {
  if (!isIOS || !screenProtectorOn) return
  const {requireNativeModule} = await import('expo')
  await requireNativeModule<{preventScreenCapture: () => Promise<void>}>('ExpoScreenCapture').preventScreenCapture()
}

export const setSecureFlagSetting = async (secure: boolean): Promise<boolean> => {
  if (!isMobile) {
    await Promise.resolve()
    return false
  }
  screenProtectorWrites++
  const was = screenProtectorOn
  try {
    const RPCGen = await import('@/constants/rpc/rpc-gen')
    await applyScreenProtector(secure)
    await RPCGen.configGuiSetValueRpcPromise({
      path: screenProtectorConfigKey,
      value: {b: secure, isNull: false},
    })
    return true
  } catch {
    // what holds matches what is saved: an apply that took is undone when its save failed
    await applyScreenProtector(was).catch(() => {})
    return false
  }
}
