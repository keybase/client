// @flow
import * as FsGen from '../fs-gen'
import type {TypedState} from '../../constants/reducer'
import {showImagePicker} from 'react-native-image-picker'
import {isIOS} from '../../constants/platform'
import {makeRetriableErrorHandler} from './shared'

export const pickAndUploadToPromise = (state: TypedState, action: FsGen.PickAndUploadPayload): Promise<any> =>
  new Promise((resolve, reject) =>
    showImagePicker(
      {
        mediaType: action.payload.type,
        quality: 1,
        videoQuality: 'high',
      },
      response =>
        response.didCancel
          ? resolve()
          : response.error
          ? reject(response.error)
          : isIOS
          ? response.uri
            ? resolve(response.uri.replace('file://', ''))
            : reject(new Error('uri field is missing from response'))
          : response.path
          ? resolve(response.path)
          : reject(new Error('path field is missing from response'))
    )
  )
    .then(localPath => localPath && FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
    .catch(makeRetriableErrorHandler(action))
