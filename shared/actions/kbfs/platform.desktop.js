/* @flow */

import {shell} from 'electron'
import * as Constants from '../../constants/config'
import {Common} from '../../constants/types/keybase-v1'
import type {AsyncAction} from '../../constants/types/flux'
import path from 'path'

const open = (kbfsPath: string, dir: string = '') => { // eslint-disable-line space-infix-ops
  dir = path.join(kbfsPath, dir)
  console.log('openItem:', dir)
  shell.openItem(dir)
}

// Paths MUST start with defaultKBFSPath
export function openInKBFS (path: string = Constants.defaultKBFSPath): AsyncAction {
  console.log('openInKBFS:', path)
  if (!path.startsWith(Constants.defaultKBFSPath)) {
    console.error(`openInKBFS requires ${Constants.defaultKBFSPath} prefix`)
    return () => {}
  }
  path = path.slice(Constants.defaultKBFSPath.length)

  return (dispatch, getState) => new Promise((resolve, reject) => {
    const state = getState()
    const kbfsPath = state.config.kbfsPath

    // On windows the path isn't /keybase
    // We can figure it out by looking at the extendedConfig though
    if (process.platform === 'win32') {
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
          open(kbfsPath, path)
        }).catch(e => {
          console.warn('Error in parsing kbfsPath: ', e)
        })
      } else {
        open(kbfsPath, path)
      }
    } else {
      open(Constants.defaultKBFSPath, path)
    }
  })
}
