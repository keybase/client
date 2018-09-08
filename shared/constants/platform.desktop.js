// @flow
import path from 'path'
import getenv from 'getenv'

const isMobile = false
const isAndroid = false
const isIOS = false
const isLargeScreen = true
const isSimulator = false
const isIPhoneX = false
const isDeviceSecureAndroid: boolean = false
const isAndroidNewerThanM: boolean = false
const isAndroidNewerThanN: boolean = false

const isElectron = true
// For storyshots, we only want to test macOS
const isDarwin = process.platform === 'darwin'
const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const mobileOsVersion = 'Not implemented on desktop'

const fileUIName = isDarwin || __STORYBOOK__ ? 'Finder' : isWindows ? 'Explorer' : 'File Explorer'

const runMode = getenv('KEYBASE_RUN_MODE', 'prod')

if (__DEV__ && !__STORYBOOK__) {
  console.log(`Run mode: ${runMode}`)
}

const envedPathLinux = {
  staging: 'keybase.staging',
  devel: 'keybase.devel',
  prod: 'keybase',
}

const envedPathOSX = {
  staging: 'KeybaseStaging',
  devel: 'KeybaseDevel',
  prod: 'Keybase',
}

const envedPathWin32 = {
  staging: 'KeybaseStaging',
  devel: 'KeybaseDevel',
  prod: 'Keybase',
}

const socketName = 'keybased.sock'

function win32SocketDialPath(): string {
  let appdata = getenv('LOCALAPPDATA', '')
  // Remove leading drive letter e.g. C:
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  // Handle runModes, prod has no extension.
  let extension = ''
  if (runMode !== 'prod') {
    extension = runMode.charAt(0).toUpperCase() + runMode.substr(1)
  }
  let dir = `\\\\.\\pipe\\kbservice${appdata}\\Keybase${extension}`
  return path.join(dir, socketName)
}

function linuxSocketDialPath(): string {
  // If XDG_RUNTIME_DIR is defined use that, else use $HOME/.config.
  const homeDir = getenv('HOME', '')
  const homeConfigDir = path.join(homeDir, '.config')
  const runtimeDir = getenv('XDG_RUNTIME_DIR', '')

  const cacheDir = runtimeDir || homeConfigDir
  const suffix = runMode === 'prod' ? '' : `.${runMode}`

  if (!runtimeDir && !homeDir) {
    console.warn(
      "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
    )
  }

  return path.join(cacheDir, `keybase${suffix}`, socketName)
}

const darwinCacheRoot = `${getenv('HOME', '')}/Library/Caches/${envedPathOSX[runMode]}/`
const darwinSandboxCacheRoot = `${getenv('HOME', '')}/Library/Group Containers/keybase/Library/Caches/${
  envedPathOSX[runMode]
}/`
const darwinSandboxSocketPath = path.join(darwinSandboxCacheRoot, socketName)

function findSocketDialPath(): string {
  switch (process.platform) {
    case 'darwin':
      return darwinSandboxSocketPath
    case 'linux':
      return linuxSocketDialPath()
    case 'win32':
      return win32SocketDialPath()
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

function findDataRoot(): string {
  switch (process.platform) {
    case 'darwin':
      return `${getenv('HOME', '')}/Library/Application Support/${envedPathOSX[runMode]}/`
    case 'linux':
      const linuxDefaultRoot = `${getenv('HOME', '')}/.local/share`
      return `${getenv('XDG_DATA_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/`
    case 'win32':
      return `${getenv('LOCALAPPDATA', '')}\\Keybase\\`
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

function findCacheRoot(): string {
  switch (process.platform) {
    case 'darwin':
      return darwinCacheRoot
    case 'linux':
      const linuxDefaultRoot = `${getenv('HOME', '')}/.cache`
      return `${getenv('XDG_CACHE_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/`
    case 'win32':
      return `${getenv('APPDATA', '')}\\Keybase\\`
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

function logDir(): string {
  // See LogDir() functions in go/libkb/home.go.
  //
  // TODO: darwin and win32 cases are inconsistent with their LogDir()
  // counterparts. Fix this.
  switch (process.platform) {
    case 'darwin':
      return `${getenv('HOME', '')}/Library/Logs`
    case 'linux':
      return findCacheRoot()
    case 'win32':
      return `${getenv('LOCALAPPDATA', '')}\\${envedPathWin32[runMode]}`
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

function logFileName(): string {
  // See DesktopLogFileName in go/libkb/constants.go.
  //
  // TODO: darwin and win32 cases are inconsistent with
  // DesktopLogFileName. Fix this.
  switch (process.platform) {
    case 'darwin':
      return `${logDir()}/${envedPathOSX[runMode]}.app.log`
    case 'linux':
      return `${logDir()}/Keybase.app.log`
    case 'win32':
      return `${logDir()}\\keybase.app.log`
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

const jsonDebugFileName = (function() {
  switch (process.platform) {
    case 'darwin':
      return `${logDir()}/${envedPathOSX[runMode]}.app.debug`
    case 'linux':
      return `${logDir()}/keybase.app.debug`
    case 'win32':
      return `${logDir()}\\keybase.app.debug`
  }
  throw new Error(`Unknown platform ${process.platform}`)
})()

function pprofDir(): string {
  // Empty string means let the service figure out the right directory.
  return ''
}

const socketPath = findSocketDialPath()
const dataRoot = findDataRoot()
const cacheRoot = findCacheRoot()

const version = 'TODO'
// TODO: Use now?
const appStart = new Date(0)
const appVersionName = 'Not Implemented - Mobile only'
const appVersionCode = 'Not Implemented - Mobile only'

export {
  appStart,
  appVersionCode,
  appVersionName,
  cacheRoot,
  dataRoot,
  fileUIName,
  isAndroid,
  isAndroidNewerThanM,
  isAndroidNewerThanN,
  isDarwin,
  isDeviceSecureAndroid,
  isElectron,
  isIOS,
  isIPhoneX,
  isLargeScreen,
  isLinux,
  isMobile,
  isSimulator,
  isWindows,
  jsonDebugFileName,
  logFileName,
  mobileOsVersion,
  runMode,
  socketPath,
  pprofDir,
  version,
}
