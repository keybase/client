// @flow
import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import RNFetchBlob from 'rn-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'
import nativeSaga from './common.native'

function copyToDownloadDir(path: string, mimeType: string) {
  const fileName = path.substring(path.lastIndexOf('/') + 1)
  const downloadPath = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
    message: 'Keybase needs access to your storage so we can download a file to it',
    title: 'Keybase Storage Permission',
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
        description: `Keybase downloaded ${fileName}`,
        mime: mimeType,
        path: downloadPath,
        showNotification: true,
        title: fileName,
      })
    )
    .catch(err => {
      console.log('Error completing download')
      console.log(err)
      throw err
    })
}

const downloadSuccessAndroid = (state, action) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta
  if (intent !== 'none') {
    return
  }
  return copyToDownloadDir(localPath, mimeType)
}

export default function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(nativeSaga)
  yield* Saga.chainAction<FsGen.DownloadSuccessPayload>(FsGen.downloadSuccess, downloadSuccessAndroid)
}
