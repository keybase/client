/* @flow */

import React, {Component} from '../base-react'
import {connect} from '../base-redux'
// $FlowIssue .desktop issue
import Render from './render'

import * as trackerActions from '../actions/tracker'
import {bindActionCreators} from 'redux'

import type {RenderProps} from './render'
import type {UserInfo} from './bio.render'
import type {Proof} from './proofs.render'
import type {SimpleProofState} from '../constants/tracker'

import type {TrackSummary} from '../constants/types/flow-types'

type TrackerProps = {
  loggedIn: boolean,
  trackerState: SimpleProofState,
  trackerMessage: ?string,
  username: ?string,
  shouldFollow: ?boolean,
  reason: string,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  onCloseFromHeader: () => void,
  onCloseFromActionBar: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  onFollowHelp: () => void,
  onFollowChecked: () => void,
  registerIdentifyUi: () => void,
  registerTrackerChangeListener: () => void,
  closed: boolean,
  lastTrack: ?TrackSummary,
  startTimer: () => void,
  stopTimer: () => void
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
        onClose: () => this.props.onCloseFromHeader(this.props.username)
      },
      actionProps: {
        loggedIn: this.props.loggedIn,
        state: this.props.trackerState,
        username: this.props.username,
        renderChangedTitle,
        failedProofsNotFollowingText,
        shouldFollow: this.props.shouldFollow,
        onClose: () => this.props.onCloseFromActionBar(this.props.username),
        onRefollow: () => this.props.onRefollow(this.props.username),
        onUnfollow: () => this.props.onUnfollow(this.props.username),
        onFollowHelp: () => this.props.onFollowHelp(this.props.username),
        onFollowChecked: checked => this.props.onFollowChecked(checked, this.props.username),
        currentlyFollowing: !!this.props.lastTrack
      },
      proofsProps: {
        username: this.props.username,
        proofs: this.props.proofs
      }
    }

    return <Render {...renderProps}/>
  }

  static parseRoute (currentPath) {
    if (currentPath.get('state')) {
      return {
        componentAtTop: {
          title: 'Tracker',
          props: {
            ...mockData,
            trackerState: currentPath.get('state')
          }
        }
      }
    }

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

const mockData = {
  username: 'max',
  trackerState: 'checking',
  reason: 'You accessed /private/cecile',
  userInfo: {
    fullname: 'Alice Bonhomme-Biaias',
    followersCount: 81,
    followingCount: 567,
    followsYou: true,
    location: 'New York, NY',
    avatar: 'https://s3.amazonaws.com/keybase_processed_uploads/2571dc6108772dbe0816deef41b25705_200_200_square_200.jpeg'
  },
  shouldFollow: true,
  proofs: [
    {"name":"marcopolo","type":"github","id":"56363c0307325cb4eedb072be7f8a5d3b29d13f5ef33650a7e910f772ff1d3710f", state: 'normal', humanUrl: "github.com/marcopolo", color: 'green', meta: 'new'}, //eslint-disable-line
    {"name":"open_sourcery","type":"twitter","id":"76363c0307325cb4eedb072be7f8a5d3b29d13f5ef33650a7e910f772ff1d3710f", state: 'checking', humanUrl: "twitter.com/open_sourcery", color: 'gray'}, //eslint-disable-line
  ]
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
  onCloseFromHeader: React.PropTypes.any,
  onCloseFromActionBar: React.PropTypes.any,
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
  state => ({...state.tracker, loggedIn: state.config.status.loggedIn}),
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
