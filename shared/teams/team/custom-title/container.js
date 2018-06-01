// @flow
import * as Constants from '../../../constants/teams'
import * as KBFSGen from '../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canChat: !yourOperations.joinTeam,
    canViewFolder: !yourOperations.joinTeam,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname}) => ({
  // TODO: Should probably use previewKnownTeamConversation.
  onChat: () => dispatch(Chat2Gen.createFindAndPreviewConversation({teamname, reason: 'teamHeader'})),
  onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  canChat: stateProps.canChat,
  canViewFolder: stateProps.canViewFolder,
  onChat: dispatchProps.onChat,
  onOpenFolder: dispatchProps.onOpenFolder,
  teamname: ownProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Title)
