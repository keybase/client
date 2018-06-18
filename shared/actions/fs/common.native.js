// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {putActionIfOnPath, navigateAppend} from '../route-tree'

const getTransferPopupAction = (path: Types.Path, routePath?: I.List<string>) =>
  Saga.put(
    routePath
      ? putActionIfOnPath(routePath, navigateAppend([{props: {path}, selected: 'transferPopup'}]))
      : navigateAppend([{props: {path}, selected: 'transferPopup'}])
  )

export const shareNative = ({payload: {path, routePath}}: FsGen.ShareNativePayload) =>
  Saga.sequentially([
    Saga.put(FsGen.createDownload({intent: 'share', path})),
    getTransferPopupAction(path, routePath),
  ])

export const saveMedia = ({payload: {path, routePath}}: FsGen.SaveMediaPayload) =>
  Saga.sequentially([
    Saga.put(FsGen.createDownload({path, intent: 'camera-roll'})),
    getTransferPopupAction(path, routePath),
  ])
