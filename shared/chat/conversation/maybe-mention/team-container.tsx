import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Container from '../../../util/container'
import type {StylesTextCrossPlatform} from '../../../common-adapters/text'
import TeamMention from './team'

type OwnProps = {
  allowFontScaling?: boolean
  channel: string
  name: string
  style?: StylesTextCrossPlatform
}

const noAdmins: Array<string> = []

export default Container.connect(
  (state, {allowFontScaling, name, channel, style}: OwnProps) => {
    const maybeMentionInfo = state.chat2.maybeMentionMap.get(Constants.getTeamMentionName(name, channel))
    const mentionInfo =
      maybeMentionInfo && maybeMentionInfo.status === RPCChatTypes.UIMaybeMentionStatus.team
        ? maybeMentionInfo.team
        : null
    return {
      _convID: mentionInfo ? mentionInfo.convID : undefined,
      allowFontScaling: !!allowFontScaling,
      channel,
      description: (mentionInfo && mentionInfo.description) || '',
      inTeam: !!mentionInfo && mentionInfo.inTeam,
      isOpen: !!mentionInfo && mentionInfo.open,
      name,
      numMembers: (mentionInfo && mentionInfo.numMembers) || 0,
      publicAdmins: (mentionInfo && mentionInfo.publicAdmins) || noAdmins,
      resolved: !!mentionInfo,
      style,
    }
  },
  dispatch => ({
    _onChat: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createPreviewConversation({conversationIDKey, reason: 'teamMention'})),
    _onViewTeam: (teamname: string) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(TeamsGen.createShowTeamByName({teamname}))
    },
    onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const convID = stateProps._convID ? Types.stringToConversationIDKey(stateProps._convID) : undefined
    return {
      allowFontScaling: stateProps.allowFontScaling,
      channel: stateProps.channel,
      description: stateProps.description,
      inTeam: stateProps.inTeam,
      isOpen: stateProps.isOpen,
      name: stateProps.name,
      numMembers: stateProps.numMembers,
      onChat: convID ? () => dispatchProps._onChat(convID) : undefined,
      onJoinTeam: dispatchProps.onJoinTeam,
      onViewTeam: () => dispatchProps._onViewTeam(stateProps.name),
      publicAdmins: stateProps.publicAdmins,
      resolved: stateProps.resolved,
      style: stateProps.style,
    }
  }
)(TeamMention)
