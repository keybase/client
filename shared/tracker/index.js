/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

import * as trackerActions from '../actions/tracker'
import {bindActionCreators} from 'redux'

import type {RenderPropsUnshaped} from './render'
import type {UserInfo} from '../common-adapters/user-bio'
import type {Proof} from '../common-adapters/user-proofs'
import type {SimpleProofState} from '../constants/tracker'

export type TrackerProps = {
  currentlyFollowing: boolean,
  loggedIn: boolean,
  trackerState: SimpleProofState,
  username: string,
  reason: string,
  waiting: boolean,
  userInfo: ?UserInfo,
  nonUser: ?boolean,
  parentProps?: Object,
  proofs: Array<Proof>,
  onClose: () => void,
  onRefollow: () => void,
  onIgnore: () => void,
  onUnfollow: () => void,
  onFollow: () => void,
  closed: boolean,
  startTimer: () => void,
  stopTimer: () => void,
  currentlyFollowing: boolean,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  name?: string,
  serviceName?: string,
  inviteLink?: ?string,
  isPrivate?: boolean
}

export function trackerPropsToRenderProps ({currentlyFollowing, inviteLink, isPrivate, lastAction,
    loggedIn, name, nonUser, onClose, onFollow, onIgnore, onRefollow, onUnfollow, parentProps,
    proofs, reason, serviceName, trackerState, userInfo, username, waiting}:
TrackerProps): RenderPropsUnshaped {
  return {
    currentlyFollowing, inviteLink, isPrivate, lastAction,
    loggedIn, name, nonUser, onClose, onFollow, onIgnore, onRefollow, onUnfollow, parentProps,
    proofs, reason, serviceName, trackerState, userInfo, username, waiting,
  }
}

class Tracker extends Component {
  props: TrackerProps;

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

export default connect(
  (state, ownProps) => ({
    ...state.tracker,
    nonUser: state.tracker.trackers[ownProps.username] && state.tracker.trackers[ownProps.username].type === 'nonUser',
    loggedIn: state.config && state.config.loggedIn,
    ...state.tracker.trackers[ownProps.username],
    ...ownProps,
  }),
  (dispatch, ownProps) => {
    const actions = bindActionCreators(trackerActions, dispatch)
    return {
      ...actions,
      onClose: () => actions.onClose(ownProps.username),
      onFollow: () => actions.onFollow(ownProps.username),
      onIgnore: () => actions.onIgnore(ownProps.username),
      onRefollow: () => actions.onRefollow(ownProps.username),
      onUnfollow: () => actions.onUnfollow(ownProps.username),
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
