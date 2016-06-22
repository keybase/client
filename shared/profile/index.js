// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import type {Props} from './render'
import flags from '../util/feature-flags'
import {getProfile, updateTrackers} from '../actions/tracker'
import {routeAppend, navigateUp} from '../actions/router'

class Profile extends Component<void, Props, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Profile',
        props: {
          username: currentPath.get('username'),
          profileRoot: uri.count() && uri.last().get('path') === 'root',
        },
      },
      subRoutes: {},
    }
  }

  componentDidMount () {
    this.props.refresh(this.props.username)
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextProps.username !== this.props.username) {
      this.props.refresh(nextProps.username)
    }
    return true
  }

  render () {
    return (
      <Render
        showComingSoon={!flags.tabProfileEnabled}
        {...this.props}
        proofs={this.props.proofs || []}
        onBack={!this.props.profileRoot ? this.props.onBack : undefined}
      />
    )
  }
}

export default connect(
  state => ({
    myUsername: state.config.username,
    trackers: state.tracker.trackers,
  }),
  dispatch => ({
    refresh: username => {
      dispatch(getProfile(username))
      dispatch(updateTrackers(username))
    },
    onPushProfile: username => {
      dispatch(routeAppend({path: 'profile', username}))
    },
    onBack: () => dispatch(navigateUp()),
  }),
  (stateProps, dispatchProps, ownProps) => {
    const username = ownProps.username || stateProps.myUsername

    return {
      ...ownProps,
      ...stateProps.trackers[username],
      ...dispatchProps,
      username,
      refresh: username => dispatchProps.refresh(username),
    }
  }
)(Profile)
