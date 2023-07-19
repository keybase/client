import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import {launchImageLibraryAsync} from '../../util/expo-image-picker.native'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'

const finishedDownloadWithIntent = async (_: unknown, action: FsGen.FinishedDownloadWithIntentPayload) => {
  const {downloadID, downloadIntent, mimeType} = action.payload
  const downloadState =
    Constants.useState.getState().downloads.state.get(downloadID) || Constants.emptyDownloadState
  if (downloadState === Constants.emptyDownloadState) {
    logger.warn('missing download', downloadID)
    return
  }
  if (downloadState.error) {
    Constants.useState.getState().dispatch.redbar(downloadState.error)
    return FsGen.createDismissDownload({downloadID})
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
    Constants.errorToActionOrThrow(err)
    return
  }
}

export default function initNative() {
  Container.listenAction(FsGen.pickAndUpload, async (_, action) => {
    try {
      const result = await launchImageLibraryAsync(action.payload.type, true, true)
      if (result.canceled) return
      result.assets.map(r =>
        Constants.useState
          .getState()
          .dispatch.upload(action.payload.parentPath, Styles.unnormalizePath(r.uri))
      )
    } catch (e) {
      Constants.errorToActionOrThrow(e)
    }
  })
  Container.listenAction(FsGen.finishedDownloadWithIntent, finishedDownloadWithIntent)
}
