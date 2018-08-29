// @flow
import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {type TypedState} from '../../util/container'
import RNFetchBlob from 'rn-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'
import {pickAndUploadToPromise} from './common.native'
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

const downloadSuccessToAction = (state: TypedState, action: FsGen.DownloadSuccessPayload) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return null
  }
  const {intent, localPath} = download.meta
  switch (intent) {
    case 'camera-roll':
      return Saga.sequentially([
        Saga.call(saveAttachmentDialog, localPath),
        Saga.put(FsGen.createDismissDownload({key})),
      ])
    case 'share':
      return Saga.sequentially([
        Saga.call(showShareActionSheet, {url: localPath, mimeType}),
        Saga.put(FsGen.createDismissDownload({key})),
      ])
    case 'none':
      return Saga.sequentially([
        Saga.call(copyToDownloadDir, localPath, mimeType),
        // TODO: dismiss download when we get rid of download cards on mobile
      ])
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(intent);
      */
      return null
  }
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield Saga.actionToAction(FsGen.downloadSuccess, downloadSuccessToAction)
}

export default platformSpecificSaga
