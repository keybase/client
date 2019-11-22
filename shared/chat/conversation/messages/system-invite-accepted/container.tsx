import SystemInviteAccepted from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import {TeamID} from '../../../../constants/types/teams'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemInviteAccepted
}

export default connect(
  (state, ownProps: OwnProps) => {
    const {teamID, teamname} = Constants.getMeta(state, ownProps.message.conversationIDKey)
    return {
      teamID,
      teamname,
      you: state.config.username,
    }
  },
  dispatch => ({
    _onViewTeam: (teamID: TeamID) => {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    message: ownProps.message,
    onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID),
    role: ownProps.message.role,
    teamname: stateProps.teamname,
    you: stateProps.you,
  })
)(SystemInviteAccepted)
