// @flow
import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../fs-gen'
import RNFetchBlob from 'react-native-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'
import {shareNative, saveMedia, pickAndUpload, pickAndUploadSuccess} from './common.native'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'

function copyToDownloadDir(path: string, mimeType: string) {
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
        mime: mimeType,
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

function platformSpecificIntentEffect(
  intent: Types.TransferIntent,
  localPath: string,
  mimeType: string
): ?Saga.Effect {
  switch (intent) {
    case 'none':
      return Saga.call(copyToDownloadDir, localPath, mimeType)
    case 'camera-roll':
      return Saga.call(saveAttachmentDialog, localPath)
    case 'share':
      return Saga.call(showShareActionSheet, {url: localPath, mimeType})
    case 'web-view':
    case 'web-view-text':
      return null
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(intent);
      */
      return null
  }
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.shareNative, shareNative)
  yield Saga.safeTakeEveryPure(FsGen.saveMedia, saveMedia)
  yield Saga.safeTakeEveryPure(FsGen.pickAndUpload, pickAndUpload, pickAndUploadSuccess)
}

export {platformSpecificIntentEffect, platformSpecificSaga}
