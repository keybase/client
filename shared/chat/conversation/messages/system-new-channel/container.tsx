import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as TeamsGen from '../../../../actions/teams-gen'
import {TeamID} from '../../../../constants/types/teams'
import SystemNewChannel from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemNewChannel
}

export default connect(
  (state, ownProps: OwnProps) => {
    const {teamID} = Constants.getMeta(state, ownProps.message.conversationIDKey)
    return {
      teamID,
    }
  },
  dispatch => ({
    _onManageChannels: (teamID: TeamID) => dispatch(TeamsGen.createManageChatChannels({teamID})),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    message: ownProps.message,
    onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamID),
  })
)(SystemNewChannel)
