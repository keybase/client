// @flow
import Row from '.'
import * as Constants from '../../constants/git'
import {createSetTeamRepoSettings} from '../../actions/git-gen'
import {connect, type TypedState, compose, withHandlers} from '../../util/container'
import {createGetProfile} from '../../actions/tracker-gen'
import {navigateAppend} from '../../actions/route-tree'
import {gitTab, settingsTab} from '../../constants/tabs'
import {gitTab as settingsGitTab} from '../../constants/settings'
import {copyToClipboard} from '../../util/clipboard'
import openURL from '../../util/open-url'
import {isMobile} from '../../constants/platform'

type OwnProps = {
  id: string,
  expanded: boolean,
  onShowDelete: string => void,
  onToggleExpand: string => void,
}

const mapStateToProps = (state: TypedState, {id, expanded}: OwnProps) => {
  const git = state.entities.getIn(['git', 'idToInfo', id], Constants.makeGitInfo())
  return {
    git,
    expanded,
    isNew: !!state.entities.getIn(['git', 'isNew', id], false),
    lastEditUserFollowing: state.config.following.has(git.lastEditUser),
    you: state.config.username,
  }
}

const mapDispatchToProps = dispatch => ({
  openUserTracker: (username: string) => dispatch(createGetProfile({username, forceDisplay: true})),
  _setDisableChat: (disabled: boolean, repoID: string, teamname: ?string) =>
    dispatch(
      createSetTeamRepoSettings({chatDisabled: disabled, repoID, teamname: teamname || '', channelName: null})
    ),
  _onOpenChannelSelection: (repoID: string, teamname: ?string, selected: string) =>
    dispatch(
      navigateAppend(
        [{selected: 'selectChannel', props: {repoID, teamname, selected}}],
        isMobile ? [settingsTab, settingsGitTab] : [gitTab]
      )
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
    onCopy: () => copyToClipboard(git.url),
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
