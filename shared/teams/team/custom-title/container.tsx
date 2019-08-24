import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamname: string
}

const mapStateToProps = (state, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canChat: !yourOperations.joinTeam,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  canChat: stateProps.canChat,
  loading: stateProps.loading,
  onChat: dispatchProps.onChat,
  teamname: ownProps.teamname,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Title)
