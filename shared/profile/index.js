// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import type {Props} from './render'
import flags from '../util/feature-flags'

class Profile extends Component<void, Props, void> {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Profile'},
      subRoutes: {},
    }
  }

  render () {
    return (
      <Render
        showComingSoon={!flags.tabProfileEnabled}
        {...this.props}
      />
    )
  }
}

export default connect(
  state => ({}),
  dispatch => ({}))(Profile)
