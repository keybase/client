// @flow
import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import type {TypedState} from '../../constants/reducer'
import {showImagePicker} from 'react-native-image-picker'
import {isIOS} from '../../constants/platform'
import {makeRetriableErrorHandler} from './shared'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

const pickAndUploadToPromise = (state: TypedState, action: FsGen.PickAndUploadPayload): Promise<any> =>
  new Promise((resolve, reject) =>
    showImagePicker(
      {
        mediaType: action.payload.type,
        quality: 1,
        videoQuality: 'high',
      },
      response =>
        response.didCancel
          ? resolve()
          : response.error
          ? reject(response.error)
          : isIOS
          ? response.uri
            ? resolve(response.uri.replace('file://', ''))
            : reject(new Error('uri field is missing from response'))
          : response.path
          ? resolve(response.path)
          : reject(new Error('path field is missing from response'))
    )
  )
    .then(localPath => localPath && FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
    .catch(makeRetriableErrorHandler(action))

const downloadSuccess = (state, action) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta
  switch (intent) {
    case 'camera-roll':
      return saveAttachmentDialog(localPath)
        .then(() => FsGen.createDismissDownload({key}))
        .catch(makeRetriableErrorHandler(action))
    case 'share':
      return showShareActionSheetFromURL({mimeType, url: localPath})
        .then(() => FsGen.createDismissDownload({key}))
        .catch(makeRetriableErrorHandler(action))
    case 'none':
      return
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
  }
}

export default function* nativeSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<FsGen.PickAndUploadPayload>(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainAction<FsGen.DownloadSuccessPayload>(FsGen.downloadSuccess, downloadSuccess)
}
