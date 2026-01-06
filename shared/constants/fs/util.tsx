import * as EngineGen from '@/actions/engine-gen-gen'
import type * as T from '../types'
import {navigateAppend} from '../router2/util'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotify:
      {
        storeRegistry.getState('fs').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}

export const makeActionForOpenPathInFilesTab = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: T.FS.Path
) => {
  navigateAppend({props: {path}, selected: 'fsRoot'})
}
