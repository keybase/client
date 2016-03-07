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

import flags from '../util/feature-flags'

type TrackerProps = {
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
  onMaybeTrack: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  onRefollow2: () => void,
  onUnfollow2: () => void,
  onFollow: () => void,
  onFollowHelp: () => void,
  onFollowChecked: () => void,
  registerIdentifyUi: () => void,
  registerTrackerChangeListener: () => void,
  closed: boolean,
  lastTrack: ?TrackSummary,
  startTimer: () => void,
  stopTimer: () => void,
  currentlyFollowing: boolean,
  lastAction: 'followed' | 'refollowed' | 'unfollowed' | 'error'
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
        lastAction: this.props.lastAction
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
        onMaybeTrack: () => this.props.onMaybeTrack(this.props.username),
        onRefollow: () => flags.tracker2 ? this.props.onRefollow2(this.props.username) : this.props.onRefollow(this.props.username),
        onUnfollow: () => flags.tracker2 ? this.props.onUnfollow2(this.props.username) : this.props.onUnfollow(this.props.username),
        onFollow: () => this.props.onFollow(this.props.username),
        onFollowHelp: () => this.props.onFollowHelp(this.props.username),
        onFollowChecked: checked => this.props.onFollowChecked(checked, this.props.username),
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
  state => ({...state.tracker, loggedIn: state.config && state.config.status && state.config.status.loggedIn}),
  dispatch => {
    return bindActionCreators(trackerActions, dispatch)
  },
  (stateProps, dispatchProps, ownProps) => {
    return {
      proofs: [],
      loggedIn: stateProps.loggedIn,
      ...stateProps.trackers[ownProps.username],
      ...dispatchProps,
      ...ownProps
    }
  }
)(Tracker)

export function selector (username: string): (store: Object) => Object {
  return store => {
    return {
      tracker: {
        trackers: {
          [username]: store.tracker.trackers[username]
        }
      },
      config: store.config
    }
  }
}

export function remoteComponentProps (username: string, store: Object, managerProps: Object): Object {
  return {
    windowsOpts: flags.tracker2 ? {height: 470, width: 320} : {height: 339, width: 520},
    title: `tracker - ${username}`,
    hidden: store.hidden,
    component: 'tracker',
    username,
    selectorParams: username,
    key: username,
    onRemoteClose: () => managerProps.trackerOnClose(username),
    startTimer: managerProps.trackerStartTimer,
    stopTimer: managerProps.trackerStopTimer
  }
}
