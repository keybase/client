// @flow
import * as Constants from '../../constants/config'
import path from 'path'
import {CommonClientType} from '../../constants/types/flow-types'
import {delay} from 'redux-saga'
import {call, put, select, race, take} from 'redux-saga/effects'
import {getExtendedStatus} from '../config'
import {ipcRenderer} from 'electron'

import type {FSOpen} from '../../constants/kbfs'
import type {ExtendedStatus} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'

function open (openPath: string) {
  console.log('openItem:', openPath)
  ipcRenderer.send('openInKBFS', openPath)
}

function openInDefault (openPath: string) {
  console.log('openInDefault:', openPath)
  // Path resolve removes any ..
  openPath = path.resolve(openPath)
  // Paths MUST start with defaultKBFSPath
  if (!openPath.startsWith(Constants.defaultKBFSPath)) {
    console.warn(`openInKBFS requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
    return
  }
  open(openPath)
}

function windowsKBFSRoot (extendedConfig: ExtendedStatus): string {
  const kbfsClients = extendedConfig.Clients && extendedConfig.Clients.length && extendedConfig.Clients.filter(c => c.clientType === CommonClientType.kbfs) || []

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

function * openInWindows (openPath: string): SagaGenerator<any, any> {
  if (!openPath.startsWith(Constants.defaultKBFSPath)) {
    console.warn(`openInKBFS requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
    return
  }
  openPath = openPath.slice(Constants.defaultKBFSPath.length)

  let kbfsPath = yield select(state => state.config.kbfsPath)

  // On windows the path isn't /keybase
  // We can figure it out by looking at the extendedConfig though
  if (kbfsPath === Constants.defaultKBFSPath) {
    let kbfsPathError
    kbfsPath = null

    // there can be a race between extendedConfig / kbfs / everything loading so we try a couple of times
    for (let i = 0; i < 3; ++i) {
      const extendedConfig = yield select(state => state.config.extendedConfig)
      try {
        kbfsPath = yield call(windowsKBFSRoot, extendedConfig)
        if (kbfsPath) {
          break
        }
      } catch (error) {
        kbfsPathError = error
      }

      yield put(getExtendedStatus())
      yield race({
        loaded: take(Constants.extendedConfigLoaded),
        timeout: call(delay, 1000),
      })
    }

    if (!kbfsPath) {
      console.warn('Error in parsing kbfsPath: ', kbfsPathError)
      return
    }

    yield put({type: Constants.changeKBFSPath, payload: {path: kbfsPath}})
  }

  if (kbfsPath) {
    openPath = path.resolve(kbfsPath, openPath)
    // Check to make sure our resolved path starts with the kbfsPath
    // i.e. (not opening a folder outside kbfs)
    if (!openPath.startsWith(kbfsPath)) {
      throw new Error(`openInKBFS requires ${kbfsPath} prefix: ${openPath}`)
    }
    open(openPath)
  }
}

function * openSaga (action: FSOpen): SagaGenerator<any, any> {
  const openPath = action.payload.path || Constants.defaultKBFSPath

  console.log('openInKBFS:', openPath)
  if (process.platform === 'win32') {
    yield * openInWindows(openPath)
  } else {
    yield call(openInDefault, openPath)
  }
}

export {
  openSaga,
}
