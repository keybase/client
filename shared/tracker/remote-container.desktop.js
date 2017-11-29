// @flow
import {connect, compose, renderNothing, branch, type Dispatch} from '../util/container'
// import * as PinentryGen from '../actions/pinentry-gen'
import Tracker from './index.desktop'

// Props are handled by remote-proxy.desktop.js
// // TODO
const mapDispatchToProps = (dispatch: Dispatch) => ({
  errorRetry: () => {}, // dispatch(Creators.getProfile(ownProps.username, true)),
  onChat: (username: string, myUsername: string) => {},
  // username && myUsername && dispatch(createStartConversation({users: [username, myUsername]})),
  onClickAvatar: (username: string) => {},
  // dispatch(ProfileGen.createOnClickAvatar({username, openWebsite: true})),
  onClickFollowers: (username: string) => {},
  // dispatch(ProfileGen.createOnClickFollowers({username, openWebsite: true})),
  onClickFollowing: (username: string) => {},
  // dispatch(ProfileGen.createOnClickFollowing({username, openWebsite: true})),
  onClose: () => {}, // dispatch(Creators.onClose(ownProps.username)),
  onFollow: () => {}, // dispatch(Creators.onFollow(ownProps.username)),
  onIgnore: () => {}, // dispatch(Creators.onIgnore(ownProps.username)),
  onRefollow: () => {}, // dispatch(Creators.onRefollow(ownProps.username)),
  onUnfollow: () => {}, // dispatch(Creators.onUnfollow(ownProps.username)),
  startTimer: () => {}, // dispatch(Creators.startTimer()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onRetry: stateProps.errorMessage ? dispatchProps.errorRetry : null,
})
export default compose(
  connect(state => state, mapDispatchToProps, mergeProps),
  branch(props => !props.username, renderNothing)
)(Tracker)
