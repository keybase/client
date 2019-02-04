// @flow
import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import * as FsGen from '../fs-gen'
import RNFetchBlob from 'rn-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'
import {pickAndUploadToPromise} from './common.native'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

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

function* downloadSuccessToAction(state, action) {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta
  switch (intent) {
    case 'camera-roll':
      yield Saga.callUntyped(saveAttachmentDialog, localPath)
      yield Saga.put(FsGen.createDismissDownload({key}))
      break
    case 'share':
      yield Saga.callUntyped(showShareActionSheetFromURL, {mimeType, url: localPath})
      yield Saga.put(FsGen.createDismissDownload({key}))
      break
    case 'none':
      yield Saga.callUntyped(copyToDownloadDir, localPath, mimeType)
      // TODO: dismiss download when we get rid of download cards on mobile
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
  }
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<FsGen.PickAndUploadPayload>(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainGenerator<FsGen.DownloadSuccessPayload>(FsGen.downloadSuccess, downloadSuccessToAction)
}

export default platformSpecificSaga
