import {namedConnect} from '../../../../util/container'
import {isTeamWithChosenChannels} from '../../../../constants/teams'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import {BigTeamHeader} from '.'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  navKey: string
  teamname: string
  teamID: TeamTypes.TeamID
}

const mapStateToProps = (state, {teamname, conversationIDKey}: OwnProps) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  conversationIDKey,
  teamname,
})

const mapDispatchToProps = (dispatch, {navKey, teamID}: OwnProps) => ({
  onClick: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        fromKey: navKey,
        path: [teamsTab, {props: {teamID}, selected: 'team'}],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, {teamID}: OwnProps) => ({
  badgeSubscribe: stateProps.badgeSubscribe,
  conversationIDKey: stateProps.conversationIDKey,
  onClick: dispatchProps.onClick,
  teamID,
  teamname: stateProps.teamname,
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'InboxBigTeamHeader'
)(BigTeamHeader)
