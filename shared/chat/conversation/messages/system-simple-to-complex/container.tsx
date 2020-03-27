import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import {TeamID} from '../../../../constants/types/teams'
import SystemSimpleToComplex from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemSimpleToComplex
}

export default connect(
  (state, ownProps: OwnProps) => {
    const {teamID} = Constants.getMeta(state, ownProps.message.conversationIDKey)
    return {
      teamID,
      you: state.config.username,
    }
  },
  dispatch => ({
    _onManageChannels: (teamID: TeamID) => dispatch(TeamsGen.createManageChatChannels({teamID})),
    _onViewTeam: (teamID: TeamID) => {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
  }),
  (stateProps, dispatchProps, ownProps) => ({
    message: ownProps.message,
    onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamID),
    onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID),
    you: stateProps.you,
  })
)(SystemSimpleToComplex)
