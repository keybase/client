import {namedConnect} from '../../../../util/container'
import {isTeamWithChosenChannels} from '../../../../constants/teams'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import {BigTeamHeader} from '.'
import * as ChatTypes from '../../../../constants/types/chat2'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  teamname: string
}

const mapStateToProps = (state, {teamname, conversationIDKey}: OwnProps) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  conversationIDKey,
  teamname,
})

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  onClick: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamname}, selected: 'team'}]})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  badgeSubscribe: stateProps.badgeSubscribe,
  conversationIDKey: stateProps.conversationIDKey,
  onClick: dispatchProps.onClick,
  teamname: stateProps.teamname,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'InboxBigTeamHeader')(
  BigTeamHeader
)
