// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import {routeAppend} from '../actions/router'
import about from './about'
import logSend from '../dev/log-send'
import account from './account'
import billing from './about'
import appPrefs from './about'
import invites from './about'
import notifs from './about'
import deleteMe from './about'
import devMenu from '../dev/dev-menu'
import flags from '../util/feature-flags'

class Settings extends Component {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Settings'},
      subRoutes: {about, account, billing, appPrefs, invites, notifs, deleteMe, devMenu, logSend},
    }
  }

  render () {
    return (
      <Render
        showComingSoon={!flags.tabSettingsEnabled}
        onAccount={this.props.onAccount}
        onBilling={this.props.onBilling}
        onPrefs={this.props.onPrefs}
        onInvites={this.props.onInvites}
        onNotifications={this.props.onNotifications}
        onDeleteMe={this.props.onDeleteMe}
        onLogSend={this.props.onLogSend}
        onAbout={this.props.onAbout}
        onDev={this.props.onDev} />
    )
  }
}

export default connect(
  state => ({}),
  dispatch => {
    return {
      onAccount: () => dispatch(routeAppend(['account'])),
      onBilling: () => dispatch(routeAppend(['billing'])),
      onPrefs: () => dispatch(routeAppend(['app-prefs'])),
      onInvites: () => dispatch(routeAppend(['invites'])),
      onNotifications: () => dispatch(routeAppend(['notifs'])),
      onDeleteMe: () => dispatch(routeAppend(['delete-me'])),
      onLogSend: () => dispatch(routeAppend(['logSend'])),
      onAbout: () => dispatch(routeAppend(['about'])),
      onDev: () => dispatch(routeAppend(['devMenu'])),
    }
  })(Settings)
