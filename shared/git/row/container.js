// @flow
import React from 'react'
import Row from '.'
import * as Constants from '../../constants/git'
import {createSetTeamRepoSettings} from '../../actions/git-gen'
import {connect, type TypedState} from '../../util/container'
import {createGetProfile} from '../../actions/tracker-gen'
import {copyToClipboard} from '../../util/clipboard'
import {usernameSelector} from '../../constants/selectors'
import openURL from '../../util/open-url'

const mapStateToProps = (state: TypedState, {id, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', id], Constants.makeGitInfo()).toObject()
  return {
    ...git,
    expanded,
    isNew: state.entities.getIn(['git', 'isNew', id], false),
    lastEditUserFollowing: state.config.following.has(git.lastEditUser),
    you: usernameSelector(state),
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  openUserTracker: (username: string) => dispatch(createGetProfile({username, forceDisplay: true})),
  _setDisableChat: (disabled: boolean, repoID: string, teamname: string) =>
    dispatch(createSetTeamRepoSettings({chatDisabled: disabled, repoID, teamname, channelName: null})),
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
  onToggleChatEnabled: () => {
    dispatchProps._setDisableChat(!stateProps.chatDisabled, stateProps.repoID, stateProps.teamname)
  },
  onToggleExpand: () => ownProps.onToggleExpand(stateProps.id),
})

const ConnectedRow: Class<
  React.Component<{
    id: string,
    expanded: boolean,
    onShowDelete: (id: string) => void,
    onToggleExpand: (id: string) => void,
  }>
> = connect(mapStateToProps, mapDispatchToProps, mergeProps)(Row)

export default ConnectedRow
