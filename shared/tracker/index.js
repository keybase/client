/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

import * as trackerActions from '../actions/tracker'
import ErrorLoadingProfile from '../common-adapters/error-profile.js'
import {bindActionCreators} from 'redux'
import {isLoading} from '../constants/tracker'

import type {RenderPropsUnshaped} from './render'
import type {UserInfo} from '../common-adapters/user-bio'
import type {Proof, SimpleProofState} from '../constants/tracker'

export type TrackerProps = {
  actionBarReady: boolean,
  closed: boolean,
  currentlyFollowing: boolean,
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
}

export function trackerPropsToRenderProps (tprops: TrackerProps): RenderPropsUnshaped {
  return {...tprops}
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

    if (this.props.error) {
      return <ErrorLoadingProfile error={this.props.error} />
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
    loading: isLoading(state.tracker.trackers[ownProps.username]),
    // TODO (mm) we can't use serverActive, (see DESKTOP-1593) let's investigate a better approach: DESKTOP-1594
    actionBarReady: true,
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
