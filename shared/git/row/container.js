// @flow
import Row from '.'
import * as Constants from '../../constants/git'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as GitGen from '../../actions/git-gen'
import {connect, type TypedState, compose, withHandlers, isMobile, setDisplayName} from '../../util/container'
import * as TrackerGen from '../../actions/tracker-gen'
import {gitTab, settingsTab} from '../../constants/tabs'
import {gitTab as settingsGitTab} from '../../constants/settings'
import openURL from '../../util/open-url'

type OwnProps = {
  id: string,
  expanded: boolean,
  onShowDelete: string => void,
  onToggleExpand: string => void,
}

const mapStateToProps = (state: TypedState, {id, expanded}: OwnProps) => {
  const git = state.git.getIn(['idToInfo', id], Constants.makeGitInfo())
  return {
    git,
    expanded,
    isNew: !!state.git.getIn(['isNew', id], false),
    lastEditUserFollowing: state.config.following.has(git.lastEditUser),
    you: state.config.username,
  }
}

const mapDispatchToProps = dispatch => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  openUserTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({username, forceDisplay: true})),
  _setDisableChat: (disabled: boolean, repoID: string, teamname: ?string) =>
    dispatch(
      GitGen.createSetTeamRepoSettings({
        chatDisabled: disabled,
        repoID,
        teamname: teamname || '',
        channelName: null,
      })
    ),
  _onOpenChannelSelection: (repoID: string, teamname: ?string, selected: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{selected: 'selectChannel', props: {repoID, teamname, selected}}],
        parentPath: isMobile ? [settingsTab, settingsGitTab] : [gitTab],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const git = stateProps.git

  return {
    canDelete: git.canDelete,
    canEdit: git.canDelete && !!git.teamname,
    channelName: git.channelName,
    chatDisabled: git.chatDisabled,
    devicename: git.devicename,
    expanded: stateProps.expanded,
    isNew: stateProps.isNew,
    lastEditTime: git.lastEditTime,
    lastEditUser: git.lastEditUser,
    lastEditUserFollowing: stateProps.lastEditUserFollowing,
    name: git.name,
    teamname: git.teamname,
    url: git.url,
    you: stateProps.you,
    onClickDevice: () => {
      git.lastEditUser && openURL(`https://keybase.io/${git.lastEditUser}/devices`)
    },
    onCopy: () => dispatchProps.copyToClipboard(git.url),
    onShowDelete: () => ownProps.onShowDelete(git.id),
    openUserTracker: dispatchProps.openUserTracker,
    _onOpenChannelSelection: () =>
      dispatchProps._onOpenChannelSelection(git.repoID, git.teamname, git.channelName || 'general'),
    onToggleChatEnabled: () => dispatchProps._setDisableChat(!git.chatDisabled, git.repoID, git.teamname),
    onToggleExpand: () => ownProps.onToggleExpand(git.id),
  }
}

const ConnectedRow = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('GitRow'),
  withHandlers({
    onChannelClick: ({chatDisabled, _onOpenChannelSelection}) => e => {
      if (chatDisabled) {
        return
      }
      e.preventDefault()
      _onOpenChannelSelection()
    },
  })
)(Row)

export default ConnectedRow
