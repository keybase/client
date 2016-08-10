// @flow
import * as Constants from '../../constants/config'
import path from 'path'
import type {AsyncAction} from '../../constants/types/flux'
import {Common} from '../../constants/types/keybase-v1'
import {getExtendedStatus} from '../config'
import {ipcRenderer} from 'electron'

import type {ExtendedStatus} from '../../constants/types/flow-types'

function open (openPath: string) {
  console.log('openItem:', openPath)
  ipcRenderer.send('openInKBFS', openPath)
}

function openInDefault (openPath: string): AsyncAction {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    console.log('openInDefault:', openPath)
    // Path resolve removes any ..
    openPath = path.resolve(openPath)
    // Paths MUST start with defaultKBFSPath
    if (!openPath.startsWith(Constants.defaultKBFSPath)) {
      console.warn(`openInKBFS requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
      return
    }
    open(openPath)
  })
}

function formKbfsPathWindows (extendedConfig: ExtendedStatus): string {
  const kbfsClients = extendedConfig.Clients && extendedConfig.Clients.length && extendedConfig.Clients.filter(c => c.clientType === Common.ClientType.kbfs) || []

  if (kbfsClients.length > 1) {
    throw new Error('There is more than one kbfs client')
  }

  if (kbfsClients.length === 0) {
    throw new Error('There are no kbfs clients')
  }

  // Hacky Regex to find a mount point on windows matches anything like foobar:\ or K:\
  const kbfsPath = kbfsClients[0].argv && kbfsClients[0].argv.filter(arg => arg.search(/.*:\\?$/) === 0)[0]

  if (!kbfsPath) {
    throw new Error('Could not figure out kbfs path from argv')
  }

  return kbfsPath + '\\'
}

function openInWindows (openPath: string = Constants.defaultKBFSPath): AsyncAction {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    if (!openPath.startsWith(Constants.defaultKBFSPath)) {
      console.warn(`openInKBFS requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
      return
    }
    openPath = openPath.slice(Constants.defaultKBFSPath.length)

    const state = getState()
    const kbfsPath = state.config.kbfsPath

    // On windows the path isn't /keybase
    // We can figure it out by looking at the extendedConfig though
    if (kbfsPath === Constants.defaultKBFSPath) {
      const extendedConfigPromise = Promise.resolve(state.config.extendedConfig)

      extendedConfigPromise
        .then(formKbfsPathWindows)
        // In case the first try fails, let's try to get the extendedConfig again
        // This can happen because kbfs loads after the first getExtended status call
        .catch(() => dispatch(getExtendedStatus()).then(formKbfsPathWindows))
        .then(kbfsPath => {
          dispatch({type: Constants.changeKBFSPath, payload: {path: kbfsPath}})

          openPath = path.resolve(kbfsPath, openPath)
          // Check to make sure our resolved path starts with the kbfsPath
          // i.e. (not opening a folder outside kbfs)
          if (!openPath.startsWith(kbfsPath)) {
            throw new Error(`openInKBFS requires ${kbfsPath} prefix: ${openPath}`)
          }
          open(openPath)
        })
        .catch(e => {
          console.warn('Error in parsing kbfsPath:', e)
        })
    } else {
      open(path.resolve(kbfsPath, openPath))
    }
  })
}

export function openInKBFS (openPath: string = Constants.defaultKBFSPath): AsyncAction {
  console.log('openInKBFS:', openPath)
  if (process.platform === 'win32') {
    return openInWindows(openPath)
  }
  return openInDefault(openPath)
}
