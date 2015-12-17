import {OS_DESKTOP} from './platform.shared'
import path from 'path'

/* eslint-disable no-undef */ // Injected by webpack
export const isDev = __DEV__
/* eslint-enable no-undef */
export const OS = OS_DESKTOP
export const isMobile = false

const runMode = process.env.KEYBASE_RUN_MODE || 'prod'

if (isDev) {
  console.log(`Run mode: ${runMode}`)
}

const envedPathOSX = {
  staging: 'KeybaseStaging',
  devel: 'KeybaseDevel',
  prod: 'Keybase'
}

function buildWin32SocketRoot() {
  let appdata = process.env.APPDATA
  // Remove leading drive letter e.g. C:
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  return `\\\\.\\pipe\\kbservice\\${appdata}\\Keybase`
}

function findSocketRoot () {
  const paths = {
    'darwin': `${process.env.HOME}/Library/Caches/${envedPathOSX[runMode]}/`,
    'linux': runMode === 'prod' ? `${process.env.XDG_RUNTIME_DIR}/keybase/` : `${process.env.XDG_RUNTIME_DIR}/keybase.${runMode}/`,
    'win32': buildWin32SocketRoot()
  }

  return paths[process.platform]
}

export const socketRoot = findSocketRoot()
export const socketName = 'keybased.sock'
export const socketPath = path.join(socketRoot, socketName)

function findDataRoot () {
  const paths = {
    'darwin': `${process.env.HOME}/Library/Application Support/${envedPathOSX[runMode]}/`,
    'linux': `${process.env.XDG_DATA_DIR}/keybase.${runMode}/`,
    'win32': `${process.env.APPDATA}\\Keybase\\`
  }

  return paths[process.platform]
}

export const dataRoot = findDataRoot()
