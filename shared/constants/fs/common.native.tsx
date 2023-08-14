import * as C from '..'
import * as Constants from '../fs'
import logger from '../../logger'
import * as Types from '../types/fs'
import * as Z from '../../util/zustand'
import * as Styles from '../../styles'
import {launchImageLibraryAsync} from '../../util/expo-image-picker.native'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'

export default function initNative() {
  C.useFSState.setState(s => {
    s.dispatch.dynamic.pickAndUploadMobile = (type, parentPath) => {
      const f = async () => {
        try {
          const result = await launchImageLibraryAsync(type, true, true)
          if (result.canceled) return
          result.assets.map(r =>
            C.useFSState.getState().dispatch.upload(parentPath, Styles.unnormalizePath(r.uri))
          )
        } catch (e) {
          Constants.errorToActionOrThrow(e)
        }
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.finishedDownloadWithIntentMobile = (downloadID, downloadIntent, mimeType) => {
      const f = async () => {
        const {downloads, dispatch} = C.useFSState.getState()
        const downloadState = downloads.state.get(downloadID) || Constants.emptyDownloadState
        if (downloadState === Constants.emptyDownloadState) {
          logger.warn('missing download', downloadID)
          return
        }
        const dismissDownload = dispatch.dismissDownload
        if (downloadState.error) {
          dispatch.redbar(downloadState.error)
          dismissDownload(downloadID)
          return
        }
        const {localPath} = downloadState
        try {
          switch (downloadIntent) {
            case Types.DownloadIntent.CameraRoll:
              await saveAttachmentToCameraRoll(localPath, mimeType)
              dismissDownload(downloadID)
              return
            case Types.DownloadIntent.Share:
              await showShareActionSheet({filePath: localPath, mimeType})
              dismissDownload(downloadID)
              return
            case Types.DownloadIntent.None:
              return
            default:
              return
          }
        } catch (err) {
          Constants.errorToActionOrThrow(err)
        }
      }
      Z.ignorePromise(f())
    }
  })
}
