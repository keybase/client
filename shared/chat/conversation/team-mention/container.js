// @flow
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {namedConnect} from '../../../util/container'
import TeamMention from '.'

type OwnProps = {|
  allowFontScaling?: boolean,
  channel: string,
  name: string,
  style?: Styles.StylesCrossPlatform,
|}

const mapStateToProps = (state, {allowFontScaling, name, channel, style}) => {
  const mentionInfo = state.chat2.teamMentionMap.get(Constants.getTeamMentionName(name, channel))
  return {
    _convID: mentionInfo?.convID,
    allowFontScaling,
    channel,
    description: mentionInfo?.description || '',
    inTeam: mentionInfo?.inTeam ?? false,
    isOpen: mentionInfo?.open || false,
    name,
    numMembers: mentionInfo?.numMembers || 0,
    publicAdmins: mentionInfo?.publicAdmins ?? [],
    resolved: !!mentionInfo,
    style,
  }
}

const mapDispatchToProps = dispatch => ({
  _onChat: conversationIDKey =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'teamMention'})),
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  onViewTeam: (teamname: string) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
  },
})

const mergeProps = (stateProps, dispatchProps) => {
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

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TeamMention'
)(TeamMention)
