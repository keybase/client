// @flow
import * as Constants from '../../constants/config'
import path from 'path'
import type {AsyncAction} from '../../constants/types/flux'
import {Common} from '../../constants/types/keybase-v1'
import {ipcRenderer} from 'electron'

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
      const extendedConfig = Promise.resolve(state.config.extendedConfig)

      extendedConfig.then(extendedConfig => {
        const kbfsClients = extendedConfig.Clients.filter(c => c.clientType === Common.ClientType.kbfs)
        if (kbfsClients.length !== 1) {
          return Promise.reject("There isn't exactly one kbfs client")
        }

        // Hacky Regex to find a mount point on windows matches anything like foobar:\ or K:\
        const kbfsPath = kbfsClients[0].argv.filter(arg => arg.search(/.*:\\?$/) === 0)[0]

        if (!kbfsPath) {
          return Promise.reject("Couldn't figure out kbfs path from argv")
        }

        return Promise.resolve(kbfsPath + '\\')
      }).then(kbfsPath => {
        dispatch({type: Constants.changeKBFSPath, payload: {path: kbfsPath}})

        openPath = path.resolve(kbfsPath, openPath)
        // Check to make sure our resolved path starts with the kbfsPath
        // i.e. (not opening a folder outside kbfs)
        if (!openPath.startsWith(kbfsPath)) {
          console.warn(`openInKBFS requires ${kbfsPath} prefix: ${openPath}`)
          return
        }
        open(openPath)
      }).catch(e => {
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
