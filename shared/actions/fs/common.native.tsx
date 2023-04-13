import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import {parseUri, launchImageLibraryAsync} from '../../util/expo-image-picker.native'
import {errorToActionOrThrow} from './shared'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'

const pickAndUploadToPromise = async (_: Container.TypedState, action: FsGen.PickAndUploadPayload) => {
  try {
    const result = await launchImageLibraryAsync(action.payload.type, true, true)
    return result.canceled || (result.assets?.length ?? 0) === 0
      ? null
      : result.assets.map(uri =>
          FsGen.createUpload({
            localPath: parseUri(uri),
            parentPath: action.payload.parentPath,
          })
        )
  } catch (e) {
    return errorToActionOrThrow(e)
  }
}

const finishedDownloadWithIntent = async (
  state: Container.TypedState,
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

export default function initNative() {
  Container.listenAction(FsGen.pickAndUpload, pickAndUploadToPromise)
  Container.listenAction(FsGen.finishedDownloadWithIntent, finishedDownloadWithIntent)
}
