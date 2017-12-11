// @flow
import * as ChatGen from '../actions/chat-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as TrackerGen from '../actions/tracker-gen'
import Tracker from './index.desktop'
import {connect, compose, renderNothing, branch, type Dispatch} from '../util/container'

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onChat: (username: string, myUsername: string) =>
    dispatch(ChatGen.createStartConversation({users: [username, myUsername]})),
  _onClickAvatar: (username: string) =>
    dispatch(ProfileGen.createOnClickAvatar({openWebsite: true, username})),
  _onClose: (username: string) => dispatch(TrackerGen.createOnClose({username})),
  _onFollow: (username: string) => dispatch(TrackerGen.createFollow({username})),
  _onIgnore: (username: string) => dispatch(TrackerGen.createIgnore({username})),
  _onRefollow: (username: string) => dispatch(TrackerGen.createRefollow({username})),
  _onRetry: (username: string) => dispatch(TrackerGen.createGetProfile({ignoreCache: true, username})),
  _onUnfollow: (username: string) => dispatch(TrackerGen.createUnfollow({username})),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onChat: () => dispatchProps._onChat(stateProps.username, stateProps.myUsername),
  onClickAvatar: () => dispatchProps._onClickAvatar(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.username),
  onFollow: () => dispatchProps._onFollow(stateProps.username),
  onIgnore: () => dispatchProps._onIgnore(stateProps.username),
  onRefollow: () => dispatchProps._onRefollow(stateProps.username),
  onRetry: stateProps.errorMessage ? () => dispatchProps._onRetry(stateProps.username) : null,
  onUnfollow: () => dispatchProps._onUnfollow(stateProps.username),
})
export default compose(
  connect(state => state, mapDispatchToProps, mergeProps),
  branch(props => !props.username, renderNothing)
)(Tracker)
