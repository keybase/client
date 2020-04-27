import * as Chat2Gen from '../../../../actions/chat2-gen'
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
    return {
      isAdmin: TeamConstants.isAdmin(TeamConstants.getRole(state, teamID)),
      team: teamname,
      teamID,
      you: state.config.username,
    }
  },
  dispatch => ({
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
    creator: ownProps.message.creator,
    isAdmin: stateProps.isAdmin || stateProps.you === ownProps.message.creator,
    onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID, ownProps.message.conversationIDKey),
    team: stateProps.team,
    teamID: stateProps.teamID,
    you: stateProps.you,
  })
)(SystemCreateTeam)
