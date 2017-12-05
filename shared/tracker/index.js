// @flow
import * as Creators from '../actions/tracker'
import * as ProfileGen from '../actions/profile-gen'
import React, {Component} from 'react'
import Render, {type RenderPropsUnshaped} from './render'
import {connect, compose, withState, type TypedState} from '../util/container'
import {isLoading} from '../constants/tracker'
import {type Proof, type SimpleProofState, type UserInfo} from '../constants/types/tracker'
import {navigateTo} from '../actions/route-tree'
import {teamsTab} from '../constants/tabs'

import {createStartConversation} from '../actions/chat-gen'
import {type ErrorProps} from './error'

export type TrackerProps = {
  actionBarReady: boolean,
  closed: boolean,
  currentlyFollowing: boolean,
  inviteLink?: ?string,
  isPrivate?: boolean,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  loading: boolean,
  loggedIn: boolean,
  myUsername: string,
  name?: string,
  nonUser: ?boolean,
  onChat: () => void,
  onClose: () => void,
  onFollow: () => void,
  onIgnore: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  parentProps?: Object,
  proofs: Array<Proof>,
  reason: string,
  serviceName?: string,
  startTimer: () => void,
  stopTimer: () => void,
  trackerState: SimpleProofState,
  userInfo: ?UserInfo,
  username: string,
  waiting: boolean,
  onClickAvatar: () => void,
  onClickFollowers: () => void,
  onClickFollowing: () => void,
  error: ?ErrorProps,
}

export function trackerPropsToRenderProps(tprops: TrackerProps): RenderPropsUnshaped {
  return {...tprops}
}

class Tracker extends Component<TrackerProps> {
  componentWillMount() {
    this.props.startTimer()
  }

  componentWillUnmount() {
    this.props.stopTimer()
  }

  render() {
    if (this.props.closed) {
      return <div />
    }

    const renderProps = trackerPropsToRenderProps(this.props)
    return <Render {...renderProps} />
  }
}

type OwnProps = {
  username: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  console.warn('in tracker mapStateToProps, state is', state)
  const trackerState =
    state.tracker.userTrackers[ownProps.username] || state.tracker.nonUserTrackers[ownProps.username]
  return {
    ...state.tracker, // why is this happening?
    actionBarReady: !trackerState.serverActive && !trackerState.error,
    errorMessage: trackerState.error,
    loading: isLoading(trackerState),
    loggedIn: state.config && state.config.loggedIn,
    myUsername: state.config && state.config.username,
    nonUser: trackerState && trackerState.type === 'nonUser',
    teamJoinError: state.chat && state.chat.teamJoinError,
    teamJoinSuccess: state.chat && state.chat.teamJoinSuccess,
    ...trackerState,
    ...ownProps,
  }
}

const mapDispatchToProps = (dispatch: any, ownProps: OwnProps) => ({
  errorRetry: ownProps.errorRetry
    ? ownProps.errorRetry
    : () => dispatch(Creators.getProfile(ownProps.username, true)),
  onChat: (username: string, myUsername: string) =>
    username && myUsername && dispatch(createStartConversation({users: [username, myUsername]})),
  onClickAvatar: (username: string) =>
    dispatch(ProfileGen.createOnClickAvatar({username, openWebsite: true})),
  onClickFollowers: (username: string) =>
    dispatch(ProfileGen.createOnClickFollowers({username, openWebsite: true})),
  onClickFollowing: (username: string) =>
    dispatch(ProfileGen.createOnClickFollowing({username, openWebsite: true})),
  onClose: () => dispatch(Creators.onClose(ownProps.username)),
  onFollow: () => dispatch(Creators.onFollow(ownProps.username)),
  onIgnore: () => dispatch(Creators.onIgnore(ownProps.username)),
  onRefollow: () => dispatch(Creators.onRefollow(ownProps.username)),
  onUnfollow: () => dispatch(Creators.onUnfollow(ownProps.username)),
  startTimer: () => dispatch(Creators.startTimer()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {myUsername, username} = stateProps
  return {
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
    error: stateProps.errorMessage
      ? {
          errorMessage: stateProps.errorMessage,
          onRetry: dispatchProps.errorRetry,
        }
      : null,
    onChat: () => dispatchProps.onChat(username, myUsername),
    onClickAvatar: () => dispatchProps.onClickAvatar(username),
    onClickFollowers: () => dispatchProps.onClickFollowers(username),
    onClickFollowing: () => dispatchProps.onClickFollowing(username),
  }
}

export default compose(
  withState('showTeam', 'onSetShowTeam', ''),
  withState('showTeamNode', 'onSetShowTeamNode', null),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
)(Tracker)
