import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import RNFetchBlob from 'rn-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'
import nativeSaga from './common.native'

const copyToDownloadDir = async (path: string, mimeType: string) => {
  const fileName = path.substring(path.lastIndexOf('/') + 1)
  const downloadPath = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`
  let stage = 'permission' // additional debug message for KBFS-4080
  try {
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
    stage = 'copy'
    await copy(path, downloadPath)
    stage = 'unlink'
    await unlink(path)
    stage = 'addCompleteDownload'
    // @ts-ignore codemod-issue
    return RNFetchBlob.android.addCompleteDownload({
      description: `Keybase downloaded ${fileName}`,
      mime: mimeType,
      path: downloadPath,
      showNotification: true,
      title: fileName,
    })
  } catch (err) {
    logger.error('Error completing download', {
      cacheDir: RNFetchBlob.fs.dirs.CacheDir,
      downloadDir: RNFetchBlob.fs.dirs.DownloadDir,
      hasNumberSuffix: !!path.match(/\(\d\)/),
      stage,
    })
    throw err
  }
}

const downloadSuccessAndroid = (state, action: FsGen.DownloadSuccessPayload) => {
  const {key, mimeType} = action.payload
  const download = state.fs.downloads.get(key)
  if (!download) {
    logger.warn('missing download key', key)
    return
  }
  const {intent, localPath} = download.meta
  if (intent !== Types.DownloadIntent.None) {
    return
  }
  return copyToDownloadDir(localPath, mimeType)
}

export default function* platformSpecificSaga() {
  yield Saga.spawn(nativeSaga)
  yield* Saga.chainAction2(FsGen.downloadSuccess, downloadSuccessAndroid)
}
