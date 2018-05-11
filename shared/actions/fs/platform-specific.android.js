// @flow
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import RNFetchBlob from 'react-native-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'
import {share, save} from './common'

function copyToDownloadDir(path: string, mime: string) {
  const fileName = path.substring(path.lastIndexOf('/') + 1)
  const downloadPath = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
    title: 'Keybase Storage Permission',
    message: 'Keybase needs access to your storage so we can download a file to it',
  })
    .then(permissionStatus => {
      if (permissionStatus !== 'granted') {
        throw new Error('Unable to acquire storage permissions')
      }
      return copy(path, downloadPath)
    })
    .then(() => unlink(path))
    .then(() =>
      RNFetchBlob.android.addCompleteDownload({
        title: fileName,
        description: `Keybase downloaded ${fileName}`,
        mime,
        path: downloadPath,
        showNotification: true,
      })
    )
    .catch(err => {
      console.log('Error completing download')
      console.log(err)
      throw err
    })
}

function* subSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.share, share)
  yield Saga.safeTakeEvery(FsGen.save, save)
}

export {copyToDownloadDir, subSaga}
