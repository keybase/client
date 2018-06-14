// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {showImagePicker} from 'react-native-image-picker'
import {isIOS} from '../../constants/platform'

const getDownloadPopupAction = (path: Types.Path, routePath?: I.List<string>) =>
  Saga.put(
    routePath
      ? putActionIfOnPath(routePath, navigateAppend([{props: {path}, selected: 'downloadPopup'}]))
      : navigateAppend([{props: {path}, selected: 'downloadPopup'}])
  )

export const shareNative = ({payload: {path, routePath}}: FsGen.ShareNativePayload) =>
  Saga.sequentially([
    Saga.put(FsGen.createDownload({intent: 'share', path})),
    getDownloadPopupAction(path, routePath),
  ])

export const saveMedia = ({payload: {path, routePath}}: FsGen.SaveMediaPayload) =>
  Saga.sequentially([
    Saga.put(FsGen.createDownload({intent: 'camera-roll', path})),
    getDownloadPopupAction(path, routePath),
  ])

export const pickAndUpload = ({payload: {type}}: FsGen.PickAndUploadPayload) =>
  new Promise((resolve, reject) =>
    showImagePicker(
      {mediaType: 'photo'}, // TODO: support other types
      response =>
        !response.didCancel &&
        (response.error
          ? reject(response.error)
          : resolve(isIOS ? response.uri.replace('file://', '') : response.path))
    )
  )

export const pickAndUploadSuccess = (localPath: string, action: FsGen.PickAndUploadPayload) =>
  localPath && Saga.put(FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
