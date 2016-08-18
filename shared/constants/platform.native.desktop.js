// @flow
import {OS_ELECTRON} from './platform.shared'
import path from 'path'
import getenv from 'getenv'

const OS = OS_ELECTRON
const isMobile = false

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

function dialWin32SocketPaths (): Array<string> {
  let appdata = getenv('APPDATA', '')
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
  return [path.join(dir, socketName)]
}

function dialLinuxSocketPaths (): Array<string> {
  if (runMode === 'prod') {
    return [path.join(`${getenv('XDG_RUNTIME_DIR', '')}/keybase/`, socketName)]
  }
  return [path.join(`${getenv('XDG_RUNTIME_DIR', '')}/keybase.${runMode}/`, socketName)]
}

const darwinCacheRoot = `${getenv('HOME', '')}/Library/Caches/${envedPathOSX[runMode]}/`
const darwinSocketPath = path.join(darwinCacheRoot, socketName)
const darwinSandboxCacheRoot = `${getenv('HOME', '')}/Library/Group Containers/keybase/Library/Caches/${envedPathOSX[runMode]}/`
const darwinSandboxSocketPath = path.join(darwinSandboxCacheRoot, socketName)

function findDialSocketPaths (): Array<string> {
  const paths = {
    // Move darwinSandboxSocketPath first, when we can support dialing multiple paths
    'darwin': [darwinSocketPath, darwinSandboxSocketPath],
    'linux': dialLinuxSocketPaths(),
    'win32': dialWin32SocketPaths(),
  }
  return paths[process.platform]
}

function findDataRoot () {
  const linuxDefaultRoot = `${getenv('HOME', '')}/.local/share`
  const paths = {
    'darwin': `${getenv('HOME', '')}/Library/Application Support/${envedPathOSX[runMode]}/`,
    'linux': `${getenv('XDG_DATA_HOME', linuxDefaultRoot)}/${envedPathLinux[runMode]}/`,
    'win32': `${getenv('APPDATA', '')}\\Keybase\\`,
  }

  return paths[process.platform]
}

function logFileName () {
  const paths = {
    'darwin': `${getenv('HOME', '')}/Library/Logs/${envedPathOSX[runMode]}.app.log`,
    'linux': null, // linux is null because we can redirect stdout
    'win32': `${getenv('APPDATA', '')}\\${envedPathWin32[runMode]}\\keybase.app.log`,
  }

  return paths[process.platform]
}

const socketPath = findDialSocketPaths()[0]
const dataRoot = findDataRoot()
const splashRoot = process.platform === 'darwin' ? darwinCacheRoot : dataRoot

export {
  OS,
  dataRoot,
  isMobile,
  logFileName,
  runMode,
  socketPath,
  splashRoot,
}
