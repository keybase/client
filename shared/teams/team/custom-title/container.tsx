import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamID: Types.TeamID
}

export default connect(
  (state, {teamID}: OwnProps) => {
    const {teamname} = Constants.getTeamMeta(state, teamID)
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    return {
      canChat: !yourOperations.joinTeam,
      loading: anyWaiting(state, Constants.teamWaitingKey(teamID)),
      teamname,
    }
  },
  dispatch => ({
    onChat: (teamname: string) =>
      dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    canChat: stateProps.canChat,
    loading: stateProps.loading,
    onChat: () => dispatchProps.onChat(stateProps.teamname),
    teamID: ownProps.teamID,
  })
)(Title)
