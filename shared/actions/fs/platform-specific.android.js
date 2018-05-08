// @flow
import RNFetchBlob from 'react-native-fetch-blob'
import {copy, unlink} from '../../util/file'
import {PermissionsAndroid} from 'react-native'

import {subSaga} from './platform-specific'

function copyToDownloadDir(path: string, mime: string): Promise<*> {
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

export {copyToDownloadDir, subSaga}
