// @flow
import * as Saga from '../../util/saga'
import * as FsGen from '../fs-gen'
import {navigateAppend} from '../../actions/route-tree'

export const share = (action: FsGen.SharePayload) =>
  Saga.put(
    navigateAppend([
      {
        props: {path: action.payload.path, isShare: true},
        selected: 'pathItemAction',
      },
    ])
  )

export function* save(action: FsGen.SavePayload): Saga.SagaGenerator<any, any> {
  const {path} = action.payload
  Saga.put(FsGen.createDownload({path, intent: 'camera-roll'}))
  Saga.put(
    navigateAppend([
      {
        props: {path, isShare: true},
        selected: 'transferPopup',
      },
    ])
  )
}
