import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import * as FS from '@/stores/fs'
import logger from '@/logger'
import nativeInit from './common.native'
import {useFSState} from '@/stores/fs'
import {androidAddCompleteDownload, fsCacheDir, fsDownloadDir} from 'react-native-kb'

const finishedRegularDownloadIDs = new Set<string>()

export default function initPlatformSpecific() {
  nativeInit()

  useFSState.setState(s => {
    s.dispatch.dynamic.afterKbfsDaemonRpcStatusChanged = wrapErrors(() => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSConfigureDownloadRpcPromise({
          // Android's cache dir is (when I tried) [app]/cache but Go side uses
          // [app]/.cache by default, which can't be used for sharing to other apps.
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
      }
      ignorePromise(f())
    })
    // needs to be called, TODO could make this better
    s.dispatch.dynamic.afterKbfsDaemonRpcStatusChanged()

    s.dispatch.dynamic.finishedRegularDownloadMobile = wrapErrors((downloadID: string, mimeType: string) => {
      const f = async () => {
        // This is fired from a hook and can happen more than once per downloadID.
        // So just deduplicate them here. This is small enough and won't happen
        // constantly, so don't worry about clearing them.
        if (finishedRegularDownloadIDs.has(downloadID)) {
          return
        }
        finishedRegularDownloadIDs.add(downloadID)

        const {downloads} = useFSState.getState()

        const downloadState = downloads.state.get(downloadID) || FS.emptyDownloadState
        const downloadInfo = downloads.info.get(downloadID) || FS.emptyDownloadInfo
        if (downloadState === FS.emptyDownloadState || downloadInfo === FS.emptyDownloadInfo) {
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
      ignorePromise(f())
    })
  })
}
