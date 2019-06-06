import Row from '.'
import * as Constants from '../../constants/git'
import * as FsTypes from '../../constants/types/fs'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as GitGen from '../../actions/git-gen'
import * as FsConstants from '../../constants/fs'
import {namedConnect, compose, withHandlers, isMobile} from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import {gitTab, settingsTab} from '../../constants/tabs'
import {gitTab as settingsGitTab} from '../../constants/settings'
import openURL from '../../util/open-url'

type OwnProps = {
  id: string
  expanded: boolean
  onShowDelete: (arg0: string) => void
  onToggleExpand: (arg0: string) => void
}

const mapStateToProps = (state, {id, expanded}: OwnProps) => {
  const git = state.git.getIn(['idToInfo', id], Constants.makeGitInfo())
  return {
    expanded,
    git,
    isNew: !!state.git.getIn(['isNew', id], false),
    lastEditUserFollowing: state.config.following.has(git.lastEditUser),
    you: state.config.username,
  }
}

const mapDispatchToProps = dispatch => ({
  _onBrowseGitRepo: (path: FsTypes.Path) => dispatch(FsConstants.makeActionForOpenPathInFilesTab(path)),
  _onOpenChannelSelection: (repoID: string, teamname: string | null, selected: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        parentPath: isMobile ? [settingsTab, settingsGitTab] : [gitTab],
        path: [{props: {repoID, selected, teamname}, selected: 'gitSelectChannel'}],
      })
    ),
  _setDisableChat: (disabled: boolean, repoID: string, teamname: string | null) =>
    dispatch(
      GitGen.createSetTeamRepoSettings({
        channelName: null,
        chatDisabled: disabled,
        repoID,
        teamname: teamname || '',
      })
    ),
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  openUserTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const git = stateProps.git

  return {
    _onOpenChannelSelection: () =>
      dispatchProps._onOpenChannelSelection(git.repoID, git.teamname, git.channelName || 'general'),
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
    onBrowseGitRepo: () =>
      dispatchProps._onBrowseGitRepo(
        FsTypes.stringToPath(
          git.url.replace(/keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/, '/keybase/$1/.kbfs_autogit/$3')
        )
      ),
    onClickDevice: () => {
      git.lastEditUser && openURL(`https://keybase.io/${git.lastEditUser}/devices`)
    },
    onCopy: () => dispatchProps.copyToClipboard(git.url),
    onShowDelete: () => ownProps.onShowDelete(git.id),
    onToggleChatEnabled: () => dispatchProps._setDisableChat(!git.chatDisabled, git.repoID, git.teamname),
    onToggleExpand: () => ownProps.onToggleExpand(git.id),
    openUserTracker: dispatchProps.openUserTracker,
    teamname: git.teamname,
    url: git.url,
    you: stateProps.you,
  }
}

const ConnectedRow = compose(
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'GitRow'),
  withHandlers({
    onChannelClick: ({chatDisabled, _onOpenChannelSelection}: ReturnType<typeof mergeProps>) => e => {
      if (chatDisabled) {
        return
      }
      e.preventDefault()
      _onOpenChannelSelection()
    },
  })
)(Row)

export default ConnectedRow
