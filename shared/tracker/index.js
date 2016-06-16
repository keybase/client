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

import type {TrackSummary} from '../constants/types/flow-types'

export type TrackerProps = {
  changed: boolean,
  currentlyFollowing: boolean,
  loggedIn: boolean,
  trackerState: SimpleProofState,
  username: string,
  shouldFollow: ?boolean,
  reason: string,
  waiting: boolean,
  userInfo: ?UserInfo,
  nonUser: ?boolean,
  parentProps: ?Object,
  proofs: Array<Proof>,
  onClose: () => void,
  onRefollow: () => void,
  onIgnore: () => void,
  onUnfollow: () => void,
  onFollow: () => void,
  closed: boolean,
  lastTrack: ?TrackSummary,
  startTimer: () => void,
  stopTimer: () => void,
  currentlyFollowing: boolean,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  name?: string,
  serviceName?: string,
  inviteLink?: ?string,
  isPrivate?: boolean
}

// TODO remove this
export function trackerPropsToRenderProps (props: TrackerProps): RenderPropsUnshaped {
  return {
    changed: props.changed,
    currentlyFollowing: props.currentlyFollowing,
    inviteLink: props.inviteLink,
    isPrivate: props.isPrivate,
    lastAction: props.lastAction,
    loggedIn: props.loggedIn,
    name: props.name,
    nonUser: props.nonUser,
    onClose: props.onClose,
    onFollow: props.onFollow,
    onIgnore: props.onIgnore,
    onRefollow: props.onRefollow,
    onUnfollow: props.onUnfollow,
    parentProps: props.parentProps,
    proofs: props.proofs,
    reason: props.reason,
    serviceName: props.serviceName,
    shouldFollow: props.shouldFollow,
    state: props.trackerState,
    trackerState: props.trackerState,
    userInfo: props.userInfo,
    username: props.username,
    waiting: props.waiting,
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
    loggedIn: state.config && state.config.status && state.config.status.loggedIn,
    ...state.tracker.trackers[ownProps.username],
    ...ownProps,
  }),
  dispatch => {
    return bindActionCreators(trackerActions, dispatch)
  },
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
    onClose: () => dispatchProps.onClose(ownProps.username),
    onFollow: () => dispatchProps.onFollow(ownProps.username),
    onIgnore: () => dispatchProps.onIgnore(ownProps.username),
    onRefollow: () => dispatchProps.onRefollow(ownProps.username),
    onUnfollow: () => dispatchProps.onUnfollow(ownProps.username),
  })
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
        config: store.config,
      }
    }

    return null
  }
}
