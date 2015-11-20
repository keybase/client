'use strict'

import {OS_DESKTOP} from './platform.shared'
import path from 'path'

export const isDev = process.env.NODE_ENV === 'development'
export const OS = OS_DESKTOP
export const isMobile = false

const runMode = process.env.KEYBASE_RUN_MODE || 'devel'
const envedPathOSX = {
  staging: 'KeybaseStaging',
  devel: 'KeybaseDevel',
  prod: 'Keybase'
}

function findSocketRoot () {
  const paths = {
    'darwin': `${process.env.HOME}/Library/Caches/${envedPathOSX[runMode]}/`,
    'linux': `${process.env.XDG_RUNTIME_DIR}/keybase.${runMode}/`
  }

  return paths[process.platform]
}

export const socketRoot = findSocketRoot()
export const socketName = 'keybased.sock'
export const socketPath = path.join(socketRoot, socketName)

function findDataRoot () {
  const paths = {
    'darwin': `${process.env.HOME}/Library/Application Support/${envedPathOSX[runMode]}/`,
    'linux': `${process.env.XDG_DATA_DIR}/keybase.${runMode}/`
  }

  return paths[process.platform]
}

export const dataRoot = findDataRoot()
