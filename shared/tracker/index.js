/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

import * as trackerActions from '../actions/tracker'
import {bindActionCreators} from 'redux'
import {metaNone} from '../constants/tracker'

import type {RenderPropsUnshaped} from './render'
import type {UserInfo} from '../common-adapters/user-bio'
import type {Proof} from '../common-adapters/user-proofs'
import type {SimpleProofState} from '../constants/tracker'

import type {TrackSummary} from '../constants/types/flow-types'

export type TrackerProps = {
  loggedIn: boolean,
  trackerState: SimpleProofState,
  trackerMessage: ?string,
  username: string,
  shouldFollow: ?boolean,
  reason: string,
  waiting: boolean,
  userInfo: ?UserInfo,
  nonUser: ?boolean,
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

export function trackerPropsToRenderProps (props: TrackerProps): RenderPropsUnshaped {
  const renderChangedTitle = props.trackerMessage
  const failedProofsNotFollowingText = `Some of ${props.username}'s proofs couldn't be verified. Track the working proofs?`
  const currentlyFollowing = !!props.lastTrack

  const changed = !(props.proofs || []).every(function (proof, index, ar) {
    return (!proof.meta || proof.meta === metaNone)
  })

  const reason = currentlyFollowing && renderChangedTitle ? renderChangedTitle : props.reason

  return {
    parentProps: props.parentProps || {},
    bioProps: {
      username: props.username,
      userInfo: props.userInfo,
      trackerState: props.trackerState,
      currentlyFollowing,
    },
    headerProps: {
      reason: reason,
      onClose: () => props.onClose(props.username),
      trackerState: props.trackerState,
      currentlyFollowing,
      changed,
      lastAction: props.lastAction,
      loggedIn: props.loggedIn,
    },
    actionProps: {
      loggedIn: props.loggedIn,
      state: props.trackerState,
      username: props.username,
      waiting: props.waiting,
      renderChangedTitle,
      failedProofsNotFollowingText,
      shouldFollow: props.shouldFollow,
      onClose: () => props.onClose(props.username),
      onRefollow: () => props.onRefollow(props.username),
      onIgnore: () => props.onIgnore(props.username),
      onUnfollow: () => props.onUnfollow(props.username),
      onFollow: () => props.onFollow(props.username),
      currentlyFollowing,
      lastAction: props.lastAction,
    },
    proofsProps: {
      username: props.username,
      proofs: props.proofs,
      currentlyFollowing,
    },
    nonUser: props.nonUser,
    name: props.name,
    serviceName: props.serviceName,
    reason: props.reason,
    inviteLink: props.inviteLink,
    isPrivate: props.isPrivate,
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
  })(Tracker)

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
