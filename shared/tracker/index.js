// @flow
import * as trackerActions from '../actions/tracker'
import React, {Component} from 'react'
import Render, {type RenderPropsUnshaped} from './render'
import {bindActionCreators} from 'redux'
import {connect, type TypedState} from '../util/container'
import {isLoading, type Proof, type SimpleProofState, type UserInfo} from '../constants/tracker'
import {onClickAvatar, onClickFollowers, onClickFollowing} from '../actions/profile'
import {startConversation} from '../actions/chat'
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

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    const trackerState = state.tracker.trackers[ownProps.username]
    return {
      ...state.tracker,
      actionBarReady: !trackerState.serverActive && !trackerState.error,
      errorMessage: trackerState.error,
      loading: isLoading(trackerState),
      loggedIn: state.config && state.config.loggedIn,
      myUsername: state.config && state.config.username,
      nonUser: trackerState && trackerState.type === 'nonUser',
      ...trackerState,
      ...ownProps,
    }
  },
  (dispatch: any, ownProps: OwnProps) => {
    const actions = bindActionCreators(trackerActions, dispatch)
    return {
      errorRetry: ownProps.errorRetry ||
        (() => {
          actions.getProfile(ownProps.username, true)
        }),
      onChat: (username, myUsername) => {
        username && myUsername && dispatch(startConversation([username, myUsername]))
      },
      onClickAvatar: username => {
        dispatch(onClickAvatar(username, true))
      },
      onClickFollowers: username => {
        dispatch(onClickFollowers(username, true))
      },
      onClickFollowing: username => {
        dispatch(onClickFollowing(username, true))
      },
      onClose: () => {
        actions.onClose(ownProps.username)
      },
      onFollow: () => {
        actions.onFollow(ownProps.username)
      },
      onIgnore: () => {
        actions.onIgnore(ownProps.username)
      },
      onRefollow: () => {
        actions.onRefollow(ownProps.username)
      },
      onUnfollow: () => {
        actions.onUnfollow(ownProps.username)
      },
      startTimer: () => {
        actions.startTimer()
      },
    }
  },
  (stateProps, dispatchProps, ownProps) => {
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
)(Tracker)
