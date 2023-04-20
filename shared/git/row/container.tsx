import Row from '.'
import * as Constants from '../../constants/git'
import * as FsTypes from '../../constants/types/fs'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as GitGen from '../../actions/git-gen'
import * as TeamConstants from '../../constants/teams'
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

const ConnectedRow = (ownProps: OwnProps) => {
  const {id, expanded} = ownProps
  const git = Container.useSelector(state => state.git.idToInfo.get(id) || Constants.makeGitInfo())
  const teamID = Container.useSelector(state =>
    git.teamname ? TeamConstants.getTeamID(state, git.teamname) : undefined
  )
  const isNew = Container.useSelector(state => state.git.isNew.has(id))
  const lastEditUserFollowing = Container.useSelector(state => state.config.following.has(git.lastEditUser))
  const you = Container.useSelector(state => state.config.username)

  const dispatch = Container.useDispatch()
  const _onBrowseGitRepo = (path: FsTypes.Path) => {
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(path))
  }

  const _onOpenChannelSelection = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {repoID: git.repoID, selected: git.channelName || 'general', teamID},
            selected: 'gitSelectChannel',
          },
        ],
      })
    )
  }
  const _setDisableChat = (disabled: boolean, repoID: string, teamname: string) => {
    dispatch(
      GitGen.createSetTeamRepoSettings({
        chatDisabled: disabled,
        repoID,
        teamname,
      })
    )
  }
  const copyToClipboard = (text: string) => {
    dispatch(ConfigGen.createCopyToClipboard({text}))
  }
  const openUserTracker = (username: string) => {
    dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
  }

  const chatDisabled = git.chatDisabled

  const props = {
    _onOpenChannelSelection,
    canDelete: git.canDelete,
    canEdit: git.canDelete && !!git.teamname,
    channelName: git.channelName,
    chatDisabled,
    devicename: git.devicename,
    expanded,
    isNew,
    lastEditTime: git.lastEditTime,
    lastEditUser: git.lastEditUser,
    lastEditUserFollowing,
    name: git.name,
    onBrowseGitRepo: () =>
      _onBrowseGitRepo(
        FsTypes.stringToPath(
          git.url.replace(/keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/, '/keybase/$1/.kbfs_autogit/$3')
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
    onCopy: () => copyToClipboard(git.url),
    onShowDelete: () => ownProps.onShowDelete(git.id),
    onToggleChatEnabled: () => git.teamname && _setDisableChat(!git.chatDisabled, git.repoID, git.teamname),
    onToggleExpand: () => ownProps.onToggleExpand(git.id),
    openUserTracker,
    teamname: git.teamname,
    url: git.url,
    you,
  }
  return <Row {...props} />
}

export default ConnectedRow
