import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import RNFetchBlob from 'rn-fetch-blob'
import {TypedState} from '../../util/container'
import {PermissionsAndroid} from 'react-native'
import nativeSaga from './common.native'

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

const finishedRegularDownload = async (state: TypedState, action: FsGen.FinishedRegularDownloadPayload) => {
  const {downloadID, mimeType} = action.payload
  const downloadState = state.fs.downloads.state.get(downloadID) || Constants.emptyDownloadState
  const downloadInfo = state.fs.downloads.info.get(downloadID) || Constants.emptyDownloadInfo
  if (downloadState === Constants.emptyDownloadState || downloadInfo === Constants.emptyDownloadInfo) {
    logger.warn('missing download', downloadID)
    return null
  }
  if (downloadState.error) {
    return null
  }
  // @ts-ignore codemod-issue
  await RNFetchBlob.android.addCompleteDownload({
    description: `Keybase downloaded ${downloadInfo.filename}`,
    mime: mimeType,
    path: downloadState.localPath,
    showNotification: true,
    title: downloadInfo.filename,
  })
  // No need to dismiss here as the download wrapper does it for Android.
  return null
}

const configureDownload = (state: TypedState) =>
  state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected &&
  RPCTypes.SimpleFSSimpleFSConfigureDownloadRpcPromise({
    // Android's cache dir is (when I tried) [app]/cache but Go side uses
    // [app]/.cache by default, which can't be used for sharing to other apps.
    cacheDirOverride: RNFetchBlob.fs.dirs.CacheDir,
    downloadDirOverride: RNFetchBlob.fs.dirs.DownloadDir,
  })

export default function* platformSpecificSaga() {
  yield Saga.spawn(nativeSaga)
  yield* Saga.chainAction2(FsGen.finishedRegularDownload, finishedRegularDownload)
  yield* Saga.chainAction2(FsGen.kbfsDaemonRpcStatusChanged, configureDownload)
}
