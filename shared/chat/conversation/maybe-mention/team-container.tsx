import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../util/container'
import TeamMention from './team'

type OwnProps = {
  allowFontScaling?: boolean
  channel: string
  name: string
  style?: Styles.StylesCrossPlatform
}

const mapStateToProps = (state, {allowFontScaling, name, channel, style}) => {
  const maybeMentionInfo = state.chat2.maybeMentionMap.get(Constants.getTeamMentionName(name, channel))
  const mentionInfo =
    maybeMentionInfo &&
    maybeMentionInfo.status === RPCChatTypes.UIMaybeMentionStatus.team &&
    maybeMentionInfo.team
      ? maybeMentionInfo.team
      : null
  return {
    // Auto generated from flowToTs. Please clean me!
    _convID: mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.convID,
    allowFontScaling,
    channel,
    // Auto generated from flowToTs. Please clean me!
    description:
      (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.description) || '',
    // Auto generated from flowToTs. Please clean me!
    inTeam:
      // Auto generated from flowToTs. Please clean me!
      (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.inTeam) !== null && // Auto generated from flowToTs. Please clean me!
      (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.inTeam) !== undefined // Auto generated from flowToTs. Please clean me!
        ? mentionInfo === null || mentionInfo === undefined
          ? undefined
          : mentionInfo.inTeam
        : false,
    // Auto generated from flowToTs. Please clean me!
    isOpen: (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.open) || false,
    name,
    // Auto generated from flowToTs. Please clean me!
    numMembers: (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.numMembers) || 0,
    // Auto generated from flowToTs. Please clean me!
    publicAdmins:
      // Auto generated from flowToTs. Please clean me!
      (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.publicAdmins) !== null && // Auto generated from flowToTs. Please clean me!
      (mentionInfo === null || mentionInfo === undefined ? undefined : mentionInfo.publicAdmins) !== undefined // Auto generated from flowToTs. Please clean me!
        ? mentionInfo === null || mentionInfo === undefined
          ? undefined
          : mentionInfo.publicAdmins
        : [],
    resolved: !!mentionInfo,
    style,
  }
}

const mapDispatchToProps = dispatch => ({
  _onChat: conversationIDKey =>
    dispatch(Chat2Gen.createPreviewConversation({conversationIDKey, reason: 'teamMention'})),
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  onViewTeam: (teamname: string) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => {
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
    onViewTeam: dispatchProps.onViewTeam,
    publicAdmins: stateProps.publicAdmins,
    resolved: stateProps.resolved,
    style: stateProps.style,
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'TeamMention')(TeamMention)
