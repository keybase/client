// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import type {TypedState} from '../constants/reducer'
import RNFetchBlob from 'react-native-fetch-blob'
import {isAndroid} from '../constants/platform'

export function openInFileUISaga(payload: FsGen.OpenInFileUIPayload, state: TypedState) {}
export function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {}
export function fuseStatusResultSaga() {}
export function* installFuseSaga(): Saga.SagaGenerator<any, any> {}
export function installDokanSaga() {}
export function installKBFS() {}
export function installKBFSSuccess(payload: RPCTypes.InstallResult) {}
export function openSecurityPreferences() {}
export function uninstallKBFSConfirmSaga(): Promise<*> {
  return new Promise((resolve, reject) => reject(new Error('unimplemented')))
}
export function uninstallKBFSSaga() {}
export function uninstallKBFSSagaSuccess(result: RPCTypes.UninstallResult) {}
export function copyToDownloadDir(path: string, mime: string): Promise<*> {
  if (isAndroid) {
    return RNFetchBlob.android.addCompleteDownload({
      title: 'Keybase Download',
      description: 'Keybase Download',
      mime,
      path,
      showNotification: true,
    })
  }
  return new Promise((resolve, reject) => resolve())
}
