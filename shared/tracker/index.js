/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

import * as trackerActions from '../actions/tracker'
import {bindActionCreators} from 'redux'

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
  username: ?string,
  shouldFollow: ?boolean,
  reason: string,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  onClose: () => void,
  onMaybeTrack: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  onFollowHelp: () => void,
  onFollowChecked: () => void,
  registerIdentifyUi: () => void,
  registerTrackerChangeListener: () => void,
  closed: boolean,
  lastTrack: ?TrackSummary,
  startTimer: () => void,
  stopTimer: () => void,
  currentlyFollowing: ?boolean
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

    const renderProps: RenderProps = {
      bioProps: {
        username: this.props.username,
        userInfo: this.props.userInfo
      },
      headerProps: {
        reason: this.props.reason,
        onClose: () => this.props.onClose(this.props.username)
      },
      actionProps: {
        loggedIn: this.props.loggedIn,
        state: this.props.trackerState,
        username: this.props.username,
        renderChangedTitle,
        failedProofsNotFollowingText,
        shouldFollow: this.props.shouldFollow,
        onClose: () => this.props.onClose(this.props.username),
        onMaybeTrack: () => this.props.onMaybeTrack(this.props.username),
        onRefollow: () => this.props.onRefollow(this.props.username),
        onUnfollow: () => this.props.onUnfollow(this.props.username),
        onFollowHelp: () => this.props.onFollowHelp(this.props.username),
        onFollowChecked: checked => this.props.onFollowChecked(checked, this.props.username),
        currentlyFollowing: flags.tracker2 ? this.props.currentlyFollowing : !!this.props.lastTrack
      },
      proofsProps: {
        username: this.props.username,
        proofs: this.props.proofs
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

Tracker.propTypes = {
  loggedIn: React.PropTypes.bool.isRequired,
  trackerState: React.PropTypes.any,
  trackerMessage: React.PropTypes.any,
  username: React.PropTypes.any,
  shouldFollow: React.PropTypes.any,
  reason: React.PropTypes.any,
  userInfo: React.PropTypes.any,
  proofs: React.PropTypes.any,
  onClose: React.PropTypes.any,
  onMaybeTrack: React.PropTypes.any,
  onRefollow: React.PropTypes.any,
  onUnfollow: React.PropTypes.any,
  onFollowHelp: React.PropTypes.any,
  onFollowChecked: React.PropTypes.any,
  registerIdentifyUi: React.PropTypes.any,
  registerTrackerChangeListener: React.PropTypes.any,
  closed: React.PropTypes.bool.isRequired,
  lastTrack: React.PropTypes.any,
  startTimer: React.PropTypes.any,
  stopTimer: React.PropTypes.any
}

export default connect(
  state => ({...state.tracker, loggedIn: state.config && state.config.status && state.config.status.loggedIn}),
  dispatch => {
    return bindActionCreators(trackerActions, dispatch)
  },
  (stateProps, dispatchProps, ownProps) => {
    return {
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
