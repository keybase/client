// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import type {TypedState} from '../constants/reducer'
import RNFetchBlob from 'react-native-fetch-blob'
import {copy, unlink} from '../util/file'
import {PermissionsAndroid} from 'react-native'

export function openInFileUISaga(payload: FsGen.OpenInFileUIPayload, state: TypedState) {}
export function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {}
export function fuseStatusResultSaga() {}
export function* installFuseSaga(): Saga.SagaGenerator<any, any> {}
export function installDokanSaga() {}
export function installKBFS() {}
export function installKBFSSuccess(payload: RPCTypes.InstallResult) {}
export function openSecurityPreferences() {}
export function uninstallKBFSConfirmSaga() {
  return new Promise((resolve, reject) => reject(new Error('unimplemented')))
}
export function uninstallKBFSSaga() {}
export function uninstallKBFSSagaSuccess(result: RPCTypes.UninstallResult) {}
export function copyToDownloadDir(path: string, mime: string) {
  const fileName = path.substring(path.lastIndexOf('/') + 1)
  const downloadPath = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
    title: 'Keybase Storage Permission',
    message: 'Keybase needs access to your storage so we can download a file to it',
  })
    .then(permissionStatus => {
      if (permissionStatus !== 'granted') {
        throw new Error('Unable to acquire storage permissions')
      }
      return copy(path, downloadPath)
    })
    .then(() => unlink(path))
    .then(() =>
      RNFetchBlob.android.addCompleteDownload({
        title: fileName,
        description: `Keybase downloaded ${fileName}`,
        mime,
        path: downloadPath,
        showNotification: true,
      })
    )
    .catch(err => {
      console.log('Error completing download')
      console.log(err)
      throw err
    })
}
