// @flow
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {putActionIfOnPath, navigateAppend} from '../route-tree'

export const share = (action: FsGen.SharePayload) =>
  Saga.put(
    putActionIfOnPath(
      action.payload.routePath,
      navigateAppend([
        {
          props: {path: action.payload.path, isShare: true},
          selected: 'pathItemAction',
        },
      ])
    )
  )

export function* save(action: FsGen.SavePayload): Saga.SagaGenerator<any, any> {
  const {path, routePath} = action.payload
  Saga.put(FsGen.createDownload({path, intent: 'camera-roll'}))
  Saga.put(
    putActionIfOnPath(
      routePath,
      navigateAppend([
        {
          props: {path, isShare: true},
          selected: 'transferPopup',
        },
      ])
    )
  )
}
