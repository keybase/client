import * as EngineGen from '@/actions/engine-gen-gen'
import type * as UseArchiveStateType from '../archive'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifySimpleFSSimpleFSArchiveStatusChanged:
    case EngineGen.chat1NotifyChatChatArchiveComplete:
    case EngineGen.chat1NotifyChatChatArchiveProgress:
      {
        const {useArchiveState} = require('../archive') as typeof UseArchiveStateType
        useArchiveState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
