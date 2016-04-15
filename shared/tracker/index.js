/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

import * as trackerActions from '../actions/tracker'
import {bindActionCreators} from 'redux'
import {metaNone} from '../constants/tracker'

import type {RenderProps} from './render'
import type {UserInfo} from './bio.render'
import type {Proof} from './proofs.render'
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
  userInfo: UserInfo,
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
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error')
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

    const renderChangedTitle = this.props.trackerMessage
    const failedProofsNotFollowingText = `Some of ${this.props.username}'s proofs couldn't be verified. Track the working proofs?`
    const currentlyFollowing = !!this.props.lastTrack

    const changed = !this.props.proofs.every(function (proof, index, ar) {
      return (!proof.meta || proof.meta === metaNone)
    })

    const reason = currentlyFollowing && renderChangedTitle ? renderChangedTitle : this.props.reason

    const renderProps: RenderProps = {
      bioProps: {
        username: this.props.username,
        userInfo: this.props.userInfo,
        currentlyFollowing
      },
      headerProps: {
        reason: reason,
        onClose: () => this.props.onClose(this.props.username),
        trackerState: this.props.trackerState,
        currentlyFollowing,
        changed,
        lastAction: this.props.lastAction,
        loggedIn: this.props.loggedIn
      },
      actionProps: {
        loggedIn: this.props.loggedIn,
        state: this.props.trackerState,
        username: this.props.username,
        waiting: this.props.waiting,
        renderChangedTitle,
        failedProofsNotFollowingText,
        shouldFollow: this.props.shouldFollow,
        onClose: () => this.props.onClose(this.props.username),
        onRefollow: () => this.props.onRefollow(this.props.username),
        onIgnore: () => this.props.onIgnore(this.props.username),
        onUnfollow: () => this.props.onUnfollow(this.props.username),
        onFollow: () => this.props.onFollow(this.props.username),
        currentlyFollowing,
        lastAction: this.props.lastAction
      },
      proofsProps: {
        username: this.props.username,
        proofs: this.props.proofs,
        currentlyFollowing
      }
    }

    return <Render {...renderProps}/>
  }

  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Tracker',
        props: {
          username: currentPath.get('username')
        }
      }
    }
  }
}

export default connect(
  (state, ownProps) => ({
    ...state.tracker,
    loggedIn: state.config && state.config.status && state.config.status.loggedIn,
    ...state.tracker.trackers[ownProps.username],
    ...ownProps
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
            [username]: store.tracker.trackers[username]
          }
        },
        config: store.config
      }
    }

    return null
  }
}
