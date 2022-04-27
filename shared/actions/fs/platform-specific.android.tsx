import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import * as Constants from '../../constants/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {TypedState} from '../../util/container'
import {PermissionsAndroid} from 'react-native'
import nativeSaga from './common.native'
import {NativeModules} from '../../util/native-modules.native'

export const ensureDownloadPermissionPromise = async () => {
  const permissionStatus = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      buttonNegative: 'Cancel',
      buttonNeutral: 'Ask me later',
      buttonPositive: 'OK',
      message: 'Keybase needs access to your storage so we can download a file to it',
      title: 'Keybase Storage Permission',
    }
  )

  if (permissionStatus !== 'granted') {
    throw new Error('Unable to acquire storage permissions')
  }
}

const finishedRegularDownloadIDs = new Set<string>()

const finishedRegularDownload = async (state: TypedState, action: FsGen.FinishedRegularDownloadPayload) => {
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
    await NativeModules.Utils.androidAddCompleteDownload?.({
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
    cacheDirOverride: NativeModules.KeybaseEngine.fsCacheDir,
    downloadDirOverride: NativeModules.KeybaseEngine.fsDownloadDir,
  })

export default function* platformSpecificSaga() {
  yield Saga.spawn(nativeSaga)
  yield* Saga.chainAction2(FsGen.finishedRegularDownload, finishedRegularDownload)
  yield* Saga.chainAction2(FsGen.kbfsDaemonRpcStatusChanged, configureDownload)
}
