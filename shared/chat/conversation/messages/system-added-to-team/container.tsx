import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import {TeamID} from '../../../../constants/types/teams'
import SystemAddedToTeam from '.'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
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
  },
  dispatch => ({
    _onManageNotifications: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'}],
        })
      ),
    _onViewTeam: (teamID: TeamID, conversationIDKey: Types.ConversationIDKey) => {
      if (teamID) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]}))
      } else {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'},
            ],
          })
        )
      }
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
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
)(SystemAddedToTeam)
