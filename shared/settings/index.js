// @flow
import React, {Component} from 'react'
import Render from './render'
import devMenu from '../dev/dev-menu'
import flags from '../util/feature-flags'
import {connect} from 'react-redux'
import {routeAppend} from '../actions/router'

class Settings extends Component {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Settings'},
      subRoutes: {devMenu},
    }
  }

  render () {
    return <Render {...this.props} />
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({
    showComingSoon: !flags.tabSettingsEnabled,
  }),
  dispatch => ({
    onDevMenu: () => dispatch(routeAppend(['devMenu'])),
  })
)(Settings)
