import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2/'
import * as Types from '../../../../constants/types/chat2'
import {getRole, isAdmin} from '../../../../constants/teams'
import SystemAddedToTeam from '.'
import {teamsTab} from '../../../../constants/tabs'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

const mapStateToProps = (state, ownProps) => {
  const teamname = Constants.getMeta(state, ownProps.message.conversationIDKey).teamname
  return {
    addee: ownProps.message.addee,
    adder: ownProps.message.adder,
    isAdmin: isAdmin(getRole(state, teamname)),
    teamname,
    timestamp: ownProps.message.timestamp,
    you: state.config.username || '',
  }
}

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
    ),
  _onManageNotifications: conversationIDKey =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'}],
      })
    ),
  _onViewTeam: (teamname: string) => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamname}, selected: 'team'}]}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  addee: stateProps.addee,
  adder: stateProps.adder,
  isAdmin: stateProps.isAdmin,
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
  onManageNotifications: () => dispatchProps._onManageNotifications(ownProps.message.conversationIDKey),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
  teamname: stateProps.teamname,
  timestamp: stateProps.timestamp,
  you: stateProps.you,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SystemAddedToTeam)
