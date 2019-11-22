import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import {TeamID} from '../../../../constants/types/teams'
import * as TeamConstants from '../../../../constants/teams'
import SystemCreateTeam from '.'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  message: Types.MessageSystemCreateTeam
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const {teamID, teamname} = Constants.getMeta(state, ownProps.message.conversationIDKey)
    console.warn(teamname, teamID)
    return {
      isAdmin: TeamConstants.isAdmin(TeamConstants.getRole(state, ownProps.message.team)),
      teamID,
      you: state.config.username,
    }
  },
  dispatch => ({
    _onViewTeam: (teamID: TeamID, conversationIDKey) => {
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
    creator: ownProps.message.creator,
    isAdmin: stateProps.isAdmin,
    onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID, ownProps.message.conversationIDKey),
    team: ownProps.message.team,
    you: stateProps.you,
  })
)(SystemCreateTeam)
