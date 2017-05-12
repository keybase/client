// @flow
import path from 'path'
import getenv from 'getenv'

const isMobile = false
const isAndroid = false
const isIOS = false

const isElectron = true
const isDarwin = process.platform === 'darwin'
const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'

const fileUIName = isDarwin
  ? 'Finder'
  : isWindows ? 'Explorer' : 'File Explorer'

const runMode = getenv('KEYBASE_RUN_MODE', 'prod')

if (__DEV__) {
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
const darwinSandboxCacheRoot = `${getenv('HOME', '')}/Library/Group Containers/keybase/Library/Caches/${envedPathOSX[runMode]}/`
const darwinSandboxSocketPath = path.join(darwinSandboxCacheRoot, socketName)

function findSocketDialPath(): Array<string> {
  const paths = {
    darwin: darwinSandboxSocketPath,
    linux: linuxSocketDialPath(),
    win32: win32SocketDialPath(),
  }
  return paths[process.platform]
}

function findDataRoot(): string {
  const linuxDefaultRoot = `${getenv('HOME', '')}/.local/share`
  const paths = {
    darwin: `${getenv('HOME', '')}/Library/Application Support/${envedPathOSX[runMode]}/`,
    linux: `${getenv('XDG_DATA_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/`,
    win32: `${getenv('LOCALAPPDATA', '')}\\Keybase\\`,
  }

  return paths[process.platform]
}

function findCacheRoot(): string {
  const linuxDefaultRoot = `${getenv('HOME', '')}/.cache`
  const paths = {
    darwin: darwinCacheRoot,
    linux: `${getenv('XDG_CACHE_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/`,
    win32: `${getenv('APPDATA', '')}\\Keybase\\`,
  }

  return paths[process.platform]
}

function logFileName(): string {
  const paths = {
    darwin: `${getenv('HOME', '')}/Library/Logs/${envedPathOSX[runMode]}.app.log`,
    linux: null, // linux is null because we can redirect stdout
    win32: `${getenv('LOCALAPPDATA', '')}\\${envedPathWin32[runMode]}\\keybase.app.log`,
  }

  return paths[process.platform]
}

const jsonDebugFileName = (function() {
  const linuxDefaultRoot = `${getenv('HOME', '')}/.local/share`
  const paths = {
    darwin: `${getenv('HOME', '')}/Library/Logs/${envedPathOSX[runMode]}.app.debug`,
    linux: `${getenv('XDG_DATA_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/keybase.app.debug`,
    win32: `${getenv('LOCALAPPDATA', '')}\\${envedPathWin32[runMode]}\\keybase.app.debug`,
  }

  return paths[process.platform]
})()

const socketPath = findSocketDialPath()
const dataRoot = findDataRoot()
const cacheRoot = findCacheRoot()

const version = 'TODO'
const appVersionName = 'Not Implemented - Mobile only'
const appVersionCode = 'Not Implemented - Mobile only'

export {
  cacheRoot,
  dataRoot,
  fileUIName,
  isAndroid,
  isDarwin,
  isElectron,
  isIOS,
  isLinux,
  isMobile,
  isWindows,
  logFileName,
  jsonDebugFileName,
  runMode,
  socketPath,
  version,
  appVersionName,
  appVersionCode,
}
