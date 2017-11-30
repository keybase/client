// @flow
import {connect, compose, renderNothing, branch, type Dispatch} from '../util/container'
import * as TrackerGen from '../actions/tracker-gen'
import * as ChatGen from '../actions/chat-gen'
import Tracker from './index.desktop'

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onChat: (username: string, myUsername: string) =>
    dispatch(ChatGen.createStartConversation({users: [username, myUsername]})),
  _onClickAvatar: (username: string) => {}, // dispatch(ProfileGen.createOnClickAvatar({username, openWebsite: true})),
  _onClickFollowers: (username: string) => {}, // dispatch(ProfileGen.createOnClickFollowers({username, openWebsite: true})),
  _onClickFollowing: (username: string) => {}, // dispatch(ProfileGen.createOnClickFollowing({username, openWebsite: true})),
  _onClose: (username: string) => dispatch(TrackerGen.createOnClose({username})),
  _onFollow: () => {}, // dispatch(Creators.onFollow(ownProps.username)),
  _onIgnore: () => {}, // dispatch(Creators.onIgnore(ownProps.username)),
  _onRefollow: () => {}, // dispatch(Creators.onRefollow(ownProps.username)),
  _onRetry: (username: string) => {}, // dispatch(Creators.getProfile(ownProps.username, true)),
  _onUnfollow: () => {}, // dispatch(Creators.onUnfollow(ownProps.username)),
  _startTimer: () => {}, // dispatch(Creators.startTimer()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onChat: () => dispatchProps._onChat(stateProps.username, stateProps.myUsername),
  onClickAvatar: () => {}, // dispatchProps._onClickAvatar(stateProps.username),
  onClickFollowers: () => {}, // dispatchProps._onClickFollowers(stateProps.username),
  onClickFollowing: () => {}, // dispatchProps._onClickFollowing(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.username),
  onFollow: () => {}, // dispatchProps._onFollow(stateProps.username),
  onIgnore: () => {}, // dispatchProps._onIgnore(stateProps.username),
  onRefollow: () => {}, // dispatchProps._onRefollow(stateProps.username),
  onRetry: stateProps.errorMessage ? () => dispatchProps._onRetry(stateProps.username) : null,
  onUnfollow: () => {}, // dispatchProps._onUnfollow(stateProps.username),
})
export default compose(
  connect(state => state, mapDispatchToProps, mergeProps),
  branch(props => !props.username, renderNothing)
)(Tracker)
