import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Saga from '../../util/saga'
import {TypedState} from '../../constants/reducer'
import {parseUri, launchImageLibraryAsync} from '../../util/expo-image-picker'
import {errorToActionOrThrow} from './shared'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'

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
    return errorToActionOrThrow(e)
  }
}

const finishedDownloadWithIntent = async (
  state: TypedState,
  action: FsGen.FinishedDownloadWithIntentPayload
) => {
  const {downloadID, downloadIntent, mimeType} = action.payload
  const downloadState = state.fs.downloads.state.get(downloadID) || Constants.emptyDownloadState
  if (downloadState === Constants.emptyDownloadState) {
    logger.warn('missing download', downloadID)
    return
  }
  if (downloadState.error) {
    return [
      FsGen.createDismissDownload({downloadID}),
      FsGen.createRedbar({
        error: downloadState.error,
      }),
    ]
  }
  const {localPath} = downloadState
  try {
    switch (downloadIntent) {
      case Types.DownloadIntent.CameraRoll:
        await saveAttachmentToCameraRoll(localPath, mimeType)
        return FsGen.createDismissDownload({downloadID})
      case Types.DownloadIntent.Share:
        await showShareActionSheet({filePath: localPath, mimeType})
        return FsGen.createDismissDownload({downloadID})
      case Types.DownloadIntent.None:
        return null
      default:
        return null
    }
  } catch (err) {
    return errorToActionOrThrow(err)
  }
}

export default function* nativeSaga() {
  yield* Saga.chainAction2(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainAction2(FsGen.finishedDownloadWithIntent, finishedDownloadWithIntent)
}
