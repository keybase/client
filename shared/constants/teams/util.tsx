import * as EngineGen from '@/actions/engine-gen-gen'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.chat1ChatUiChatShowManageChannels:
    case EngineGen.keybase1NotifyTeamTeamMetadataUpdate:
    case EngineGen.chat1NotifyChatChatWelcomeMessageLoaded:
    case EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial:
    case EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone:
    case EngineGen.keybase1NotifyTeamTeamRoleMapChanged:
    case EngineGen.keybase1NotifyTeamTeamChangedByID:
    case EngineGen.keybase1NotifyTeamTeamDeleted:
    case EngineGen.keybase1NotifyTeamTeamExit:
    case EngineGen.keybase1NotifyBadgesBadgeState:
    case EngineGen.keybase1GregorUIPushState:
      {
        const {useState_} = require('./index')
        useState_.getState().dispatch.onEngineIncoming(action)
      }
      break
    default:
  }
}
