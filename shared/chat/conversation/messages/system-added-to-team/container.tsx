import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import {TeamID} from '../../../../constants/types/teams'
import SystemAddedToTeam from '.'
import {teamsTab} from '../../../../constants/tabs'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {teamID, teamname, teamType} = Constants.getMeta(state, ownProps.message.conversationIDKey)
  return {
    addee: ownProps.message.addee,
    adder: ownProps.message.adder,
    bulkAdds: ownProps.message.bulkAdds,
    isAdmin: TeamConstants.isAdmin(TeamConstants.getRole(state, teamID)),
    isTeam: teamType === 'big' || teamType === 'small',
    role: ownProps.message.role,
    teamID,
    teamname,
    timestamp: ownProps.message.timestamp,
    you: state.config.username,
  }
}

const mapDispatchToProps = dispatch => ({
  _onManageNotifications: conversationIDKey =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'}],
      })
    ),
  _onViewTeam: (teamID: TeamID, conversationIDKey) => {
    if (teamID) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]}))
    } else {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'}],
        })
      )
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  addee: stateProps.addee,
  adder: stateProps.adder,
  bulkAdds: stateProps.bulkAdds,
  isAdmin: stateProps.isAdmin,
  isTeam: stateProps.isTeam,
  onManageNotifications: () => dispatchProps._onManageNotifications(ownProps.message.conversationIDKey),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID, ownProps.message.conversationIDKey),
  role: stateProps.role,
  teamname: stateProps.teamname,
  timestamp: stateProps.timestamp,
  you: stateProps.you,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SystemAddedToTeam)
