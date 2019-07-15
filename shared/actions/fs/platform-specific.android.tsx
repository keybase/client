import logger from '../../logger'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as FileSystem from 'expo-file-system'
import RNFetchBlob from 'rn-fetch-blob'
import {PermissionsAndroid, NativeModules} from 'react-native'
import nativeSaga from './common.native'
import {types} from '@babel/core'

async function copyToDownloadDir(_path: string, mimeType: string) {
  const path = `file://${_path}`
  const fileName = path.substring(path.lastIndexOf('/') + 1)

  let downloadDir: string
  let downloadPath: string
  try {
    downloadDir = await NativeModules.Utils.getDownloadPath()
    downloadPath = `file://${downloadDir}/${fileName}`
  } catch (e) {
    logger.warn(`Error loading download path ${e}`)
  }

  let stage = 'permission' // additional debug message for KBFS-4080
  try {
    const permissionStatus = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        message: 'Keybase needs access to your storage so we can download a file to it',
        title: 'Keybase Storage Permission',
      }
    )

    if (permissionStatus !== 'granted') {
      throw new Error('Unable to acquire storage permissions')
    }

    stage = 'copy'
    await FileSystem.copyAsync({from: path, to: downloadPath})

    stage = 'unlink'
    await FileSystem.deleteAsync(path)

    stage = 'addCompleteDownload'
    await NativeModules.Utils.addCompleteDownload({
      description: `Keybase downloaded ${fileName}`,
      mime: mimeType,
      path: downloadPath,
      showNotification: true,
      title: fileName,
    })
  } catch (err) {
    logger.error('Error completing download', {
      downloadDir,
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

export default function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(nativeSaga)
  yield* Saga.chainAction<FsGen.DownloadSuccessPayload>(FsGen.downloadSuccess, downloadSuccessAndroid)
}
