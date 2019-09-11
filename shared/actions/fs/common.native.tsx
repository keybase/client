import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import {TypedState} from '../../constants/reducer'
import {parseUri, launchImageLibraryAsync} from '../../util/expo-image-picker'
import {makeRetriableErrorHandler} from './shared'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

const pickAndUploadToPromise = async (_: TypedState, action: FsGen.PickAndUploadPayload) => {
  try {
    const result = await launchImageLibraryAsync(action.payload.type)
    return result.cancelled === true
      ? null
      : FsGen.createUpload({
          localPath: parseUri(result),
          parentPath: action.payload.parentPath,
        })
  } catch (e) {
    return makeRetriableErrorHandler(action)(e)
  }
}

const downloadSuccess = async (state: TypedState, action: FsGen.DownloadSuccessPayload) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta as Types.DownloadMeta
  switch (intent) {
    case Types.DownloadIntent.CameraRoll:
      try {
        await saveAttachmentDialog(localPath)
        return FsGen.createDismissDownload({key})
      } catch (e) {
        return makeRetriableErrorHandler(action)(e)
      }
    case Types.DownloadIntent.Share:
      // @ts-ignore codemod-issue probably a real issue
      try {
        await showShareActionSheetFromURL({mimeType, url: localPath})
        return FsGen.createDismissDownload({key})
      } catch (e) {
        return makeRetriableErrorHandler(action)(e)
      }
    case Types.DownloadIntent.None:
      return
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
      return undefined
  }
}

export default function* nativeSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainAction2(FsGen.downloadSuccess, downloadSuccess)
}
