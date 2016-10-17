// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

import * as trackerActions from '../actions/tracker'
import {onClickAvatar, onClickFollowers, onClickFollowing} from '../actions/profile'
import {bindActionCreators} from 'redux'
import {isLoading} from '../constants/tracker'

import type {RenderPropsUnshaped} from './render'
import type {Proof, SimpleProofState, UserInfo} from '../constants/tracker'
import type {ErrorProps} from './error'
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
  name?: string,
  nonUser: ?boolean,
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

  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Tracker',
        props: {
          username: currentPath.get('username'),
        },
      },
    }
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
      nonUser: trackerState && trackerState.type === 'nonUser',
      loggedIn: state.config && state.config.loggedIn,
      loading: isLoading(trackerState),
      actionBarReady: !trackerState.serverActive && !trackerState.error,
      errorMessage: trackerState.error,
      ...trackerState,
      ...ownProps,
    }
  },
  (dispatch: any, ownProps: OwnProps) => {
    const actions = bindActionCreators(trackerActions, dispatch)
    return {
      onClose: () => { actions.onClose(ownProps.username) },
      onFollow: () => { actions.onFollow(ownProps.username) },
      onIgnore: () => { actions.onIgnore(ownProps.username) },
      onRefollow: () => { actions.onRefollow(ownProps.username) },
      onUnfollow: () => { actions.onUnfollow(ownProps.username) },
      startTimer: () => { actions.startTimer() },
      onClickAvatar: (username, uid) => { dispatch(onClickAvatar(username, uid, true)) },
      onClickFollowers: (username, uid) => { dispatch(onClickFollowers(username, uid, true)) },
      onClickFollowing: (username, uid) => { dispatch(onClickFollowing(username, uid, true)) },
      errorRetry: ownProps.errorRetry || (() => { actions.getProfile(ownProps.username, true) }),
    }
  },
  (stateProps, dispatchProps, ownProps) => {
    const {username, userInfo: {uid} = {}} = stateProps

    return {
      ...ownProps,
      ...stateProps,
      ...dispatchProps,
      onClickAvatar: () => dispatchProps.onClickAvatar(username, uid),
      onClickFollowers: () => dispatchProps.onClickFollowers(username, uid),
      onClickFollowing: () => dispatchProps.onClickFollowing(username, uid),
      error: stateProps.errorMessage
      ? {
        onRetry: dispatchProps.errorRetry,
        errorMessage: stateProps.errorMessage,
      }
      : null,
    }
  }
)(Tracker)

export function selector (username: string): (store: Object) => ?Object {
  return store => {
    if (store.tracker.trackers[username]) {
      return {
        tracker: {
          trackers: {
            [username]: store.tracker.trackers[username],
          },
        },
        config: {
          loggedIn: store.config.loggedIn,
        },
      }
    }

    return null
  }
}
