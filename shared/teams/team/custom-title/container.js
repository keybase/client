// @flow
import * as Constants from '../../../constants/teams'
import * as FsGen from '../../../actions/fs-gen'
import * as FsTypes from '../../../constants/types/fs'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Title from '.'
import {connect} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {teamname: string}

const mapStateToProps = (state, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canChat: !yourOperations.joinTeam,
    canViewFolder: !yourOperations.joinTeam,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({teamname, reason: 'teamHeader'})),
  onOpenFolder: () =>
    dispatch(FsGen.createOpenPathInFilesTab({path: FsTypes.stringToPath(`/keybase/team/${teamname}`)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  canChat: stateProps.canChat,
  canViewFolder: stateProps.canViewFolder,
  loading: stateProps.loading,
  onChat: dispatchProps.onChat,
  onOpenFolder: dispatchProps.onOpenFolder,
  teamname: ownProps.teamname,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Title)
