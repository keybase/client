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
import {getCanPerform} from '../../constants/teams'
import * as I from 'immutable'
import * as TeamsGen from '../../actions/teams-gen'

const mapStateToProps = (state: TypedState, {id, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', id], Constants.makeGitInfo()).toObject()
  let admin = false
  let _convIDs = I.Set()
  if (git.teamname) {
    const yourOperations = getCanPerform(state, git.teamname)
    admin = yourOperations.renameChannel
    _convIDs = state.entities.getIn(['teams', 'teamNameToConvIDs', git.teamname], I.Set())
  }
  const _channelInfo = state.entities.getIn(['teams', 'convIDToChannelInfo'], I.Map())
  return {
    ...git,
    expanded,
    isNew: state.entities.getIn(['git', 'isNew', id], false),
    lastEditUserFollowing: state.config.following.has(git.lastEditUser),
    you: usernameSelector(state),
    isAdmin: admin,
    _convIDs,
    _channelInfo,
  }
}

const mapDispatchToProps = (dispatch: any, ownProps) => ({
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
  _onLoadChannels: (teamname: string) => dispatch(TeamsGen.createGetChannels({teamname})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const convIDs = stateProps._convIDs.toArray()
  // Without the .filter we get a bunch of intermediate arrays of [undefined, undefined, ...] leading
  // to React key prop errors
  const channelNames = convIDs.reduce((result: Array<string>, id: string) => {
    const channelname = stateProps._channelInfo.get(id, {}).channelname
    !!channelname && result.push(channelname)
    return result
  }, [])
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
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
    onToggleExpand: () => {
      if (stateProps.teamname) dispatchProps._onLoadChannels(stateProps.team)
      ownProps.onToggleExpand(stateProps.id)
    },
    smallTeam: !!stateProps.teamname && channelNames.length <= 1,
  }
}

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
