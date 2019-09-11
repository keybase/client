import Row from '.'
import * as Constants from '../../constants/git'
import * as FsTypes from '../../constants/types/fs'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as GitGen from '../../actions/git-gen'
import * as FsConstants from '../../constants/fs'
import * as Container from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import openURL from '../../util/open-url'

type OwnProps = {
  id: string
  expanded: boolean
  onShowDelete: (id: string) => void
  onToggleExpand: (id: string) => void
}

const ConnectedRow = Container.namedConnect(
  (state, {id, expanded}: OwnProps) => {
    const git = state.git.idToInfo.get(id) || Constants.makeGitInfo()
    return {
      expanded,
      git,
      isNew: state.git.isNew.has(id),
      lastEditUserFollowing: state.config.following.has(git.lastEditUser),
      you: state.config.username,
    }
  },

  dispatch => ({
    _onBrowseGitRepo: (path: FsTypes.Path) => dispatch(FsConstants.makeActionForOpenPathInFilesTab(path)),
    _onOpenChannelSelection: (repoID: string, teamname: string | undefined, selected: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {repoID, selected, teamname}, selected: 'gitSelectChannel'}],
        })
      ),
    _setDisableChat: (disabled: boolean, repoID: string, teamname: string) =>
      dispatch(
        GitGen.createSetTeamRepoSettings({
          chatDisabled: disabled,
          repoID,
          teamname,
        })
      ),
    copyToClipboard: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    openUserTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  }),

  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {git} = stateProps
    const chatDisabled = git.chatDisabled
    const _onOpenChannelSelection = () =>
      dispatchProps._onOpenChannelSelection(git.repoID, git.teamname, git.channelName || 'general')
    return {
      _onOpenChannelSelection,
      canDelete: git.canDelete,
      canEdit: git.canDelete && !!git.teamname,
      channelName: git.channelName,
      chatDisabled,
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
            git.url.replace(
              /keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/,
              '/keybase/$1/.kbfs_autogit/$3'
            )
          )
        ),
      onChannelClick: (e: React.BaseSyntheticEvent) => {
        if (!chatDisabled) {
          e.preventDefault()
          _onOpenChannelSelection()
        }
      },
      onClickDevice: () => {
        git.lastEditUser && openURL(`https://keybase.io/${git.lastEditUser}/devices`)
      },
      onCopy: () => dispatchProps.copyToClipboard(git.url),
      onShowDelete: () => ownProps.onShowDelete(git.id),
      onToggleChatEnabled: () =>
        git.teamname && dispatchProps._setDisableChat(!git.chatDisabled, git.repoID, git.teamname),
      onToggleExpand: () => ownProps.onToggleExpand(git.id),
      openUserTracker: dispatchProps.openUserTracker,
      teamname: git.teamname,
      url: git.url,
      you: stateProps.you,
    }
  },
  'GitRow'
)(Row)

export default ConnectedRow
