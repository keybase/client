// @flow
import {connect} from '../../../../util/container'
import {isTeamWithChosenChannels} from '../../../../constants/teams'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import {BigTeamHeader} from '.'
import * as ChatTypes from '../../../../constants/types/chat2'

type OwnProps = {|
  teamname: string,
  conversationIDKey: ChatTypes.ConversationIDKey,
|}

const mapStateToProps = (state, {teamname, conversationIDKey}) => ({
  badgeSubscribe: !isTeamWithChosenChannels(state, teamname),
  teamname,
  conversationIDKey,
})

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onClick: () =>
    dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab, {props: {teamname}, selected: 'team'}]})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  badgeSubscribe: stateProps.badgeSubscribe,
  onClick: dispatchProps.onClick,
  teamname: stateProps.teamname,
  conversationIDKey: stateProps.conversationIDKey,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(BigTeamHeader)
