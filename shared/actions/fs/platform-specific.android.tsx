import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Constants from '../../constants/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Container from '../../util/container'
import nativeInit from './common.native'
import {androidAddCompleteDownload, fsCacheDir, fsDownloadDir} from 'react-native-kb'

const finishedRegularDownloadIDs = new Set<string>()

const finishedRegularDownload = async (
  state: Container.TypedState,
  action: FsGen.FinishedRegularDownloadPayload
) => {
  const {downloadID, mimeType} = action.payload

  // This is fired from a hook and can happen more than once per downloadID.
  // So just deduplicate them here. This is small enough and won't happen
  // constantly, so don't worry about clearing them.
  if (finishedRegularDownloadIDs.has(downloadID)) {
    return null
  }
  finishedRegularDownloadIDs.add(downloadID)

  const downloadState = state.fs.downloads.state.get(downloadID) || Constants.emptyDownloadState
  const downloadInfo = state.fs.downloads.info.get(downloadID) || Constants.emptyDownloadInfo
  if (downloadState === Constants.emptyDownloadState || downloadInfo === Constants.emptyDownloadInfo) {
    logger.warn('missing download', downloadID)
    return null
  }
  if (downloadState.error) {
    return null
  }
  try {
    await androidAddCompleteDownload({
      description: `Keybase downloaded ${downloadInfo.filename}`,
      mime: mimeType,
      path: downloadState.localPath,
      showNotification: true,
      title: downloadInfo.filename,
    })
  } catch (_) {
    logger.warn('Failed to addCompleteDownload')
  }
  // No need to dismiss here as the download wrapper does it for Android.
  return null
}

const configureDownload = async () =>
  RPCTypes.SimpleFSSimpleFSConfigureDownloadRpcPromise({
    // Android's cache dir is (when I tried) [app]/cache but Go side uses
    // [app]/.cache by default, which can't be used for sharing to other apps.
    cacheDirOverride: fsCacheDir,
    downloadDirOverride: fsDownloadDir,
  })

export default function initPlatformSpecific() {
  nativeInit()
  Container.listenAction(FsGen.finishedRegularDownload, finishedRegularDownload)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, configureDownload)
}
