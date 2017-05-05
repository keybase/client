// @flow
import * as trackerActions from '../actions/tracker'
import React, {Component} from 'react'
import Render from './render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {isLoading} from '../constants/tracker'
import {startConversation} from '../actions/chat'
import {onClickAvatar, onClickFollowers, onClickFollowing} from '../actions/profile'

import type {ErrorProps} from './error'
import type {Proof, SimpleProofState, UserInfo} from '../constants/tracker'
import type {RenderPropsUnshaped} from './render'
import type {TypedState} from '../constants/reducer'

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

export function trackerPropsToRenderProps (tprops: TrackerProps): RenderPropsUnshaped {
  return {...tprops}
}

class Tracker extends Component<void, TrackerProps, void> {
  componentWillMount () {
    this.props.startTimer()
  }

  componentWillUnmount () {
    this.props.stopTimer()
  }

  render () {
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
      errorRetry: ownProps.errorRetry || (() => { actions.getProfile(ownProps.username, true) }),
      onChat: (username, myUsername) => { username && myUsername && dispatch(startConversation([username, myUsername])) },
      onClickAvatar: (username) => { dispatch(onClickAvatar(username, true)) },
      onClickFollowers: (username) => { dispatch(onClickFollowers(username, true)) },
      onClickFollowing: (username) => { dispatch(onClickFollowing(username, true)) },
      onClose: () => { actions.onClose(ownProps.username) },
      onFollow: () => { actions.onFollow(ownProps.username) },
      onIgnore: () => { actions.onIgnore(ownProps.username) },
      onRefollow: () => { actions.onRefollow(ownProps.username) },
      onUnfollow: () => { actions.onUnfollow(ownProps.username) },
      startTimer: () => { actions.startTimer() },
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

export function selector (username: string): (store: Object) => ?Object {
  return store => {
    if (store.tracker.trackers[username]) {
      return {
        config: {
          loggedIn: store.config.loggedIn,
          username: store.config.username,
        },
        tracker: {
          trackers: {
            [username]: store.tracker.trackers[username],
          },
        },
      }
    }

    return null
  }
}
