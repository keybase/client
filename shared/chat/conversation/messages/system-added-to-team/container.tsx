import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
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

const Connected = Container.connect(
  (state, ownProps: OwnProps) => {
    const {teamID, teamname, teamType} = Constants.getMeta(state, ownProps.message.conversationIDKey)
    const authorIsAdmin = TeamConstants.userIsRoleInTeam(state, teamID, ownProps.message.author, 'admin')
    const authorIsOwner = TeamConstants.userIsRoleInTeam(state, teamID, ownProps.message.author, 'owner')
    return {
      addee: ownProps.message.addee,
      adder: ownProps.message.adder,
      bulkAdds: ownProps.message.bulkAdds,
      isAdmin: authorIsAdmin || authorIsOwner,
      isTeam: teamType === 'big' || teamType === 'small',
      role: ownProps.message.role,
      teamID,
      teamname,
      timestamp: ownProps.message.timestamp,
      you: state.config.username,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    _onManageNotifications: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(
        Chat2Gen.createShowInfoPanel({
          conversationIDKey,
          show: true,
          tab: 'settings',
        })
      ),
    _onViewBot: (username: string) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                botUsername: username,
                conversationIDKey: ownProps.message.conversationIDKey,
                namespace: 'chat2',
              },
              selected: 'chatInstallBot',
            },
          ],
        })
      )
    },
    _onViewTeam: (teamID: TeamID, conversationIDKey: Types.ConversationIDKey) => {
      if (teamID) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]}))
      } else {
        dispatch(
          Chat2Gen.createShowInfoPanel({
            conversationIDKey,
            show: true,
            tab: 'settings',
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
    onViewBot: () => dispatchProps._onViewBot(stateProps.addee),
    onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID, ownProps.message.conversationIDKey),
    role: stateProps.role,
    teamname: stateProps.teamname,
    timestamp: stateProps.timestamp,
    you: stateProps.you,
  })
)(SystemAddedToTeam)
export default Connected
