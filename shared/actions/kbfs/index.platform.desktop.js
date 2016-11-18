// @flow
import * as Constants from '../../constants/config'
import path from 'path'
import {kbfsMountGetCurrentMountDirRpcPromise} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {ipcRenderer} from 'electron'
import {isWindows} from '../../constants/platform'

import type {FSOpen} from '../../constants/kbfs'
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
    // make call
    kbfsPath = yield call(kbfsMountGetCurrentMountDirRpcPromise)

    if (!kbfsPath) {
      console.warn('Error in finding kbfspath')
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
  if (isWindows) {
    yield * openInWindows(openPath)
  } else {
    yield call(openInDefault, openPath)
  }
}

export {
  openSaga,
}
