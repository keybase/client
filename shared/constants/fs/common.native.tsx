import logger from '@/logger'
import {ignorePromise} from '../utils'
import {wrapErrors} from '@/util/debug'
import * as T from '../types'
import * as Styles from '@/styles'
import * as FS from '@/stores/fs'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'
import {useFSState} from '.'

export default function initNative() {
  useFSState.setState(s => {
    s.dispatch.dynamic.pickAndUploadMobile = wrapErrors(
      (type: T.FS.MobilePickType, parentPath: T.FS.Path) => {
        const f = async () => {
          try {
            const result = await launchImageLibraryAsync(type, true, true)
            if (result.canceled) return
            result.assets.map(r =>
              useFSState.getState().dispatch.upload(parentPath, Styles.unnormalizePath(r.uri))
            )
          } catch (e) {
            FS.errorToActionOrThrow(e)
          }
        }
        ignorePromise(f())
      }
    )

    s.dispatch.dynamic.finishedDownloadWithIntentMobile = wrapErrors(
      (downloadID: string, downloadIntent: T.FS.DownloadIntent, mimeType: string) => {
        const f = async () => {
          const {downloads, dispatch} = useFSState.getState()
          const downloadState = downloads.state.get(downloadID) || FS.emptyDownloadState
          if (downloadState === FS.emptyDownloadState) {
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
              case T.FS.DownloadIntent.CameraRoll:
                await saveAttachmentToCameraRoll(localPath, mimeType)
                dismissDownload(downloadID)
                return
              case T.FS.DownloadIntent.Share:
                await showShareActionSheet({filePath: localPath, mimeType})
                dismissDownload(downloadID)
                return
              case T.FS.DownloadIntent.None:
                return
              default:
                return
            }
          } catch (err) {
            FS.errorToActionOrThrow(err)
          }
        }
        ignorePromise(f())
      }
    )
  })
}
