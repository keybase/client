import * as EngineGen from '@/actions/engine-gen-gen'
import {useAvatarState} from '@/common-adapters/avatar/store'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyTeamAvatarUpdated: {
      const {name} = action.payload.params
      useAvatarState.getState().dispatch.updated(name)
      break
    }
    default:
  }
}

