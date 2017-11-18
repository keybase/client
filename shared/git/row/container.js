// @flow
import React from 'react'
import Row from '.'
import * as Constants from '../../constants/git'
import {connect, type TypedState} from '../../util/container'
import {getProfile} from '../../actions/tracker'
import {copyToClipboard} from '../../util/clipboard'
import {usernameSelector} from '../../constants/selectors'
import openURL from '../../util/open-url'

const mapStateToProps = (state: TypedState, {id, expanded}) => {
  const git = state.entities.getIn(['git', 'idToInfo', id], Constants.makeGitInfo()).toObject()
  return {
    ...git,
    expanded,
    isNew: state.entities.getIn(['git', 'isNew', id], false),
    lastEditUserFollowing: !!state.config.following[git.lastEditUser],
    you: usernameSelector(state),
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  openUserTracker: (username: string) => dispatch(getProfile(username, false, true)),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  onClickDevice: () => {
    stateProps.lastEditUser && openURL(`https://keybase.io/${stateProps.lastEditUser}/devices`)
  },
  onCopy: () => copyToClipboard(stateProps.url),
  onShowDelete: () => ownProps.onShowDelete(stateProps.id),
  openUserTracker: dispatchProps.openUserTracker,
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
