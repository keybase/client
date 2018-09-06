// @flow
import * as Constants from '../../../constants/teams'
import * as KBFSGen from '../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect, type TypedState} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

const mapStateToProps = (state: TypedState, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canChat: !yourOperations.joinTeam,
    canViewFolder: !yourOperations.joinTeam,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({teamname, reason: 'teamHeader'})),
  onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  canChat: stateProps.canChat,
  canViewFolder: stateProps.canViewFolder,
  loading: stateProps.loading,
  onChat: dispatchProps.onChat,
  onOpenFolder: dispatchProps.onOpenFolder,
  teamname: ownProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Title)
