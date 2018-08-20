// @flow
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {showImagePicker} from 'react-native-image-picker'
import {isIOS} from '../../constants/platform'

export const shareNative = ({payload: {path, routePath}}: FsGen.ShareNativePayload) =>
  Saga.put(FsGen.createDownload({intent: 'share', path}))

export const saveMedia = ({payload: {path, routePath}}: FsGen.SaveMediaPayload) =>
  Saga.put(FsGen.createDownload({intent: 'camera-roll', path}))

export const pickAndUpload = ({payload: {type}}: FsGen.PickAndUploadPayload): Promise<string> =>
  new Promise((resolve, reject) =>
    showImagePicker(
      {
        mediaType: isIOS ? 'mixed' : 'photo', // 'mixed' is not supported on Android. TODO: find something better.
        quality: 1,
        videoQuality: 'high',
      },
      response =>
        !response.didCancel &&
        (response.error
          ? reject(response.error)
          : resolve(isIOS ? response.uri.replace('file://', '') : response.path))
    )
  )

export const pickAndUploadSuccess = (localPath: string, action: FsGen.PickAndUploadPayload) =>
  localPath && Saga.put(FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
