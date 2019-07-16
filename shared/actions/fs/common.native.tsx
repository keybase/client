import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import {TypedState} from '../../constants/reducer'
import * as ImagePicker from 'expo-image-picker'
import {parseUri} from '../../util/expo-image-picker'
import {makeRetriableErrorHandler} from './shared'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

const pickAndUploadToPromise = (state: TypedState, action: FsGen.PickAndUploadPayload): Promise<any> =>
  new Promise((resolve, reject) => {
    let mediaTypeParam: ImagePicker.MediaTypeOptions
    switch (action.payload.type) {
      case Types.MobilePickType.Photo:
        mediaTypeParam = ImagePicker.MediaTypeOptions.Images
        break
      case Types.MobilePickType.Video:
        mediaTypeParam = ImagePicker.MediaTypeOptions.Videos
        break
      case Types.MobilePickType.Mixed:
        mediaTypeParam = ImagePicker.MediaTypeOptions.All
        break
    }
    return ImagePicker.launchImageLibraryAsync({mediaTypes: mediaTypeParam}).then(result => {
      result.cancelled === true ? resolve() : resolve(parseUri(result))
    })
  })
    .then(
      (localPath: string | null) =>
        localPath &&
        FsGen.createUpload({
          localPath,
          parentPath: action.payload.parentPath,
        })
    )
    .catch(makeRetriableErrorHandler(action))

const downloadSuccess = (state, action: FsGen.DownloadSuccessPayload) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta as Types.DownloadMeta
  switch (intent) {
    case Types.DownloadIntent.CameraRoll:
      return saveAttachmentDialog(localPath)
        .then(() => FsGen.createDismissDownload({key}))
        .catch(makeRetriableErrorHandler(action))
    case Types.DownloadIntent.Share:
      // @ts-ignore codemod-issue probably a real issue
      return showShareActionSheetFromURL({mimeType, url: localPath})
        .then(() => FsGen.createDismissDownload({key}))
        .catch(makeRetriableErrorHandler(action))
    case Types.DownloadIntent.None:
      return
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
  }
}

export default function* nativeSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<FsGen.PickAndUploadPayload>(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainAction<FsGen.DownloadSuccessPayload>(FsGen.downloadSuccess, downloadSuccess)
}
