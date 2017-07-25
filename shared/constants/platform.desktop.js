// @flow
import path from 'path'
import getenv from 'getenv'

const isMobile = false
const isAndroid = false
const isIOS = false
const isLargeScreen = true
const isSimulator = false

const isElectron = true
const isDarwin = process.platform === 'darwin'
const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const mobileOsVersion = 'Not implemented on desktop'

const fileUIName = isDarwin ? 'Finder' : isWindows ? 'Explorer' : 'File Explorer'

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
const darwinSandboxCacheRoot = `${getenv('HOME', '')}/Library/Group Containers/keybase/Library/Caches/${envedPathOSX[runMode]}/`
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

function logFileName(): ?string {
  switch (process.platform) {
    case 'darwin':
      return `${getenv('HOME', '')}/Library/Logs/${envedPathOSX[runMode]}.app.log`
    case 'linux':
      return null // linux is null because we can redirect stdout
    case 'win32':
      return `${getenv('LOCALAPPDATA', '')}\\${envedPathWin32[runMode]}\\keybase.app.log`
  }
  throw new Error(`Unknown platform ${process.platform}`)
}

const jsonDebugFileName = (function() {
  switch (process.platform) {
    case 'darwin':
      return `${getenv('HOME', '')}/Library/Logs/${envedPathOSX[runMode]}.app.debug`
    case 'linux':
      const linuxDefaultRoot = `${getenv('HOME', '')}/.local/share`
      return `${getenv('XDG_DATA_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/keybase.app.debug`
    case 'win32':
      return `${getenv('LOCALAPPDATA', '')}\\${envedPathWin32[runMode]}\\keybase.app.debug`
  }
  throw new Error(`Unknown platform ${process.platform}`)
})()

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
  isDarwin,
  isElectron,
  isIOS,
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
  version,
}
