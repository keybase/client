import {OS_DESKTOP} from './platform.shared'
import path from 'path'
import getenv from 'getenv'

export const OS = OS_DESKTOP
export const isMobile = false
export const kbfsPath = `/keybase`

export const runMode = getenv('KEYBASE_RUN_MODE', 'prod')

if (__DEV__) { // eslint-disable-line no-undef
  console.log(`Run mode: ${runMode}`)
}

const envedPathOSX = {
  staging: 'KeybaseStaging',
  devel: 'KeybaseDevel',
  prod: 'Keybase'
}

function buildWin32SocketRoot () {
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
  let path = `\\\\.\\pipe\\kbservice${appdata}\\Keybase${extension}`
  return path
}

function findSocketRoot () {
  const paths = {
    'darwin': `${getenv('HOME', '')}/Library/Caches/${envedPathOSX[runMode]}/`,
    'linux': runMode === 'prod' ? `${getenv('XDG_RUNTIME_DIR', '')}/keybase/` : `${getenv('XDG_RUNTIME_DIR', '')}/keybase.${runMode}/`,
    'win32': buildWin32SocketRoot()
  }

  return paths[process.platform]
}

function findDataRoot () {
  const paths = {
    'darwin': `${getenv('HOME', '')}/Library/Application Support/${envedPathOSX[runMode]}/`,
    'linux': `${getenv('XDG_DATA_DIR', '')}/keybase.${runMode}/`,
    'win32': `${getenv('APPDATA', '')}\\Keybase\\`
  }

  return paths[process.platform]
}

export const socketRoot = findSocketRoot()
export const socketName = 'keybased.sock'
export const socketPath = path.join(socketRoot, socketName)
export const dataRoot = findDataRoot()
export const splashRoot = process.platform === 'darwin' ? socketRoot : dataRoot
