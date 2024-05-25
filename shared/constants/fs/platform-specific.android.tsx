import * as C from '..'
import * as Constants from '@/constants/fs'
import * as T from '../types'
import logger from '@/logger'
import nativeInit from './common.native'
import {androidAddCompleteDownload, fsCacheDir, fsDownloadDir} from 'react-native-kb'

const finishedRegularDownloadIDs = new Set<string>()

export default function initPlatformSpecific() {
  nativeInit()

  C.useFSState.setState(s => {
    s.dispatch.dynamic.afterKbfsDaemonRpcStatusChanged = C.wrapErrors(() => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSConfigureDownloadRpcPromise({
          // Android's cache dir is (when I tried) [app]/cache but Go side uses
          // [app]/.cache by default, which can't be used for sharing to other apps.
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.finishedRegularDownloadMobile = C.wrapErrors(
      (downloadID: string, mimeType: string) => {
        const f = async () => {
          // This is fired from a hook and can happen more than once per downloadID.
          // So just deduplicate them here. This is small enough and won't happen
          // constantly, so don't worry about clearing them.
          if (finishedRegularDownloadIDs.has(downloadID)) {
            return
          }
          finishedRegularDownloadIDs.add(downloadID)

          const {downloads} = C.useFSState.getState()

          const downloadState = downloads.state.get(downloadID) || Constants.emptyDownloadState
          const downloadInfo = downloads.info.get(downloadID) || Constants.emptyDownloadInfo
          if (
            downloadState === Constants.emptyDownloadState ||
            downloadInfo === Constants.emptyDownloadInfo
          ) {
            logger.warn('missing download', downloadID)
            return
          }
          if (downloadState.error) {
            return
          }
          try {
            await androidAddCompleteDownload({
              description: `Keybase downloaded ${downloadInfo.filename}`,
              mime: mimeType,
              path: downloadState.localPath,
              showNotification: true,
              title: downloadInfo.filename,
            })
          } catch {
            logger.warn('Failed to addCompleteDownload')
          }
          // No need to dismiss here as the download wrapper does it for Android.
        }
        C.ignorePromise(f())
      }
    )
  })
}
