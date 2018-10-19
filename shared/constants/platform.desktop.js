// @flow
import path from 'path'

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

const runMode = process.env['KEYBASE_RUN_MODE'] || 'prod'
const homeEnv = process.env['HOME'] || ''

if (__DEV__ && !__STORYBOOK__) {
  console.log(`Run mode: ${runMode}`)
}

const envedPathLinux = {
  devel: 'keybase.devel',
  prod: 'keybase',
  staging: 'keybase.staging',
}

const envedPathOSX = {
  devel: 'KeybaseDevel',
  prod: 'Keybase',
  staging: 'KeybaseStaging',
}

const envedPathWin32 = {
  devel: 'KeybaseDevel',
  prod: 'Keybase',
  staging: 'KeybaseStaging',
}

const socketName = 'keybased.sock'

function win32SocketDialPath(): string {
  let appdata = process.env['LOCALAPPDATA'] || ''
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
  const homeConfigDir = path.join(homeEnv, '.config')
  const runtimeDir = process.env['XDG_RUNTIME_DIR'] || ''

  const cacheDir = runtimeDir || homeConfigDir
  const suffix = runMode === 'prod' ? '' : `.${runMode}`

  if (!runtimeDir && !homeEnv) {
    console.warn(
      "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
    )
  }

  return path.join(cacheDir, `keybase${suffix}`, socketName)
}

const darwinCacheRoot = `${homeEnv}/Library/Caches/${envedPathOSX[runMode]}/`
const darwinSandboxCacheRoot = `${homeEnv}/Library/Group Containers/keybase/Library/Caches/${
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
      return `${homeEnv}/Library/Application Support/${envedPathOSX[runMode]}/`
    case 'linux':
      const linuxDefaultRoot = `${homeEnv}/.local/share`
      return `${process.env['XDG_DATA_HOME'] || linuxDefaultRoot}/${envedPathLinux[runMode]}/`
    case 'win32':
      return `${process.env['LOCALAPPDATA'] || ''}\\Keybase\\`
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

function findCacheRoot(): string {
  switch (process.platform) {
    case 'darwin':
      return darwinCacheRoot
    case 'linux':
      const linuxDefaultRoot = `${homeEnv}/.cache`
      return `${process.env['XDG_CACHE_HOME'] || linuxDefaultRoot}/${envedPathLinux[runMode]}/`
    case 'win32':
      return `${process.env['APPDATA'] || ''}\\Keybase\\`
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
      return `${homeEnv}/Library/Logs`
    case 'linux':
      return findCacheRoot()
    case 'win32':
      return `${process.env['LOCALAPPDATA'] || ''}\\${envedPathWin32[runMode]}`
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

const serverConfigFileName = (function() {
  switch (process.platform) {
    case 'darwin':
      return `${logDir()}/${envedPathOSX[runMode]}.app.serverConfig`
    case 'linux':
      return `${logDir()}/keybase.app.serverConfig`
    case 'win32':
      return `${logDir()}\\keybase.app.serverConfig`
  }
  throw new Error(`Unknown platform ${process.platform}`)
})()

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
const appVersionName = 'Not Implemented - Mobile only'
const appVersionCode = 'Not Implemented - Mobile only'

export {
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
  serverConfigFileName,
  logFileName,
  mobileOsVersion,
  runMode,
  socketPath,
  pprofDir,
  version,
}
