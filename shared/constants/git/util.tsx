import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

let loadedStore = false
export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {badgeState} = action.payload.params
        const badges = new Set(badgeState.newGitRepoGlobalUniqueIDs)
        // don't bother loading the store if no badges
        if (loadedStore || badges.size) {
          loadedStore = true
          storeRegistry.getState('git').dispatch.onEngineIncomingImpl(action)
        }
      }
      break
    default:
  }
}
