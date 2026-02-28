import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

let loaded = false

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {badgeState} = action.payload.params
        const {newDevices, revokedDevices} = badgeState
        const hasValue = (newDevices?.length ?? 0) + (revokedDevices?.length ?? 0) > 0
        if (loaded || hasValue) {
          loaded = true
          storeRegistry.getState('devices').dispatch.onEngineIncomingImpl(action)
        }
      }
      break
    default:
  }
}
