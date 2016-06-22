// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import type {Props} from './render'
import flags from '../util/feature-flags'
import {getProfile, updateTrackers} from '../actions/tracker'

// TEMP
const usernames = ['chromakode', 'max', 'jzila', 'mikem', 'strib', 'zanderz', 'gabrielh', 'chris',
  'songgao', 'patrick', 'awendland', 'marcopolo', 'akalin', 'cjb', 'oconnor663', 'cbostrander',
  'alness', 'chrisnojima', 'jinyang', 'cecileb']
const username = usernames[Math.floor(Math.random() * usernames.length)]
// TEMP

class Profile extends Component<void, Props, void> {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Profile'},
      subRoutes: {},
    }
  }

  componentDidMount () {
    this.props.refresh()
  }

  render () {
    return (
      <Render
        showComingSoon={!flags.tabProfileEnabled}
        {...this.props}
        proofs={this.props.proofs || []}
      />
    )
  }
}

export default connect(
  state => ({
    username: state.config.username,
    trackers: state.tracker.trackers,
  }),
  dispatch => ({
    refresh: username => {
      dispatch(getProfile(username))
      dispatch(updateTrackers(username))
    },
  }),
  (stateProps, dispatchProps, ownProps) => {
    // const username = ownProps.username || stateProps.username

    return {
      ...ownProps,
      ...stateProps.trackers[username],
      ...dispatchProps,
      refresh: () => dispatchProps.refresh(username),
    }
  }
)(Profile)
