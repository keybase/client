// @flow
import React from 'react'
import Row from '.'
import * as Constants from '../../constants/git'
import {createSetTeamRepoSettings} from '../../actions/git-gen'
import {connect, type TypedState, compose, withHandlers} from '../../util/container'
import {createGetProfile} from '../../actions/tracker-gen'
import {navigateAppend} from '../../actions/route-tree'
import {gitTab, settingsTab} from '../../constants/tabs'
import {gitTab as settingsGitTab} from '../../constants/settings'
import {copyToClipboard} from '../../util/clipboard'
import {usernameSelector} from '../../constants/selectors'
import openURL from '../../util/open-url'
import {isMobile} from '../../constants/platform'
import * as ChatTypes from '../../constants/types/rpc-chat-gen'
import {getCanPerform} from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'

const mapStateToProps = (state: TypedState, {id, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', id], Constants.makeGitInfo()).toObject()
  let admin = false
  if (git.teamname) {
    const yourOperations = getCanPerform(state, git.teamname)
    admin = yourOperations.renameChannel
  }
  return {
    ...git,
    expanded,
    isNew: state.entities.getIn(['git', 'isNew', id], false),
    lastEditUserFollowing: state.config.following.has(git.lastEditUser),
    you: usernameSelector(state),
    smallTeam: ChatConstants.getTeamType(state) === ChatTypes.commonTeamType.simple,
    isAdmin: admin,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  openUserTracker: (username: string) => dispatch(createGetProfile({username, forceDisplay: true})),
  _setDisableChat: (disabled: boolean, repoID: string, teamname: string) =>
    dispatch(createSetTeamRepoSettings({chatDisabled: disabled, repoID, teamname, channelName: null})),
  _onOpenChannelSelection: (repoID: string, teamname: string, selected: string) =>
    dispatch(
      navigateAppend(
        [{selected: 'selectChannel', props: {repoID, teamname, selected}}],
        isMobile ? [settingsTab, settingsGitTab] : [gitTab]
      )
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  canEdit: stateProps.canDelete && !!stateProps.teamname,
  onClickDevice: () => {
    stateProps.lastEditUser && openURL(`https://keybase.io/${stateProps.lastEditUser}/devices`)
  },
  onCopy: () => copyToClipboard(stateProps.url),
  onShowDelete: () => ownProps.onShowDelete(stateProps.id),
  openUserTracker: dispatchProps.openUserTracker,
  onOpenChannelSelection: () =>
    dispatchProps._onOpenChannelSelection(
      stateProps.repoID,
      stateProps.teamname,
      stateProps.channelName || 'general'
    ),
  onToggleChatEnabled: () =>
    dispatchProps._setDisableChat(!stateProps.chatDisabled, stateProps.repoID, stateProps.teamname),
  onToggleExpand: () => ownProps.onToggleExpand(stateProps.id),
})

const ConnectedRow: Class<
  React.Component<{
    id: string,
    expanded: boolean,
    onShowDelete: (id: string) => void,
    onToggleExpand: (id: string) => void,
  }>
> = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withHandlers({
    onChannelClick: ({chatDisabled, onOpenChannelSelection}) => e => {
      if (chatDisabled) {
        return
      }
      e.preventDefault()
      onOpenChannelSelection()
    },
  })
)(Row)

export default ConnectedRow
