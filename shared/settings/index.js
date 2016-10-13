// @flow
import React, {Component} from 'react'
import Render from './render'
import DeleteConfirm from './delete-confirm/container'
import RemoveDevice from '../devices/device-revoke'
import InviteGenerated from './invite-generated'
import devMenu from '../dev/dev-menu'
import flags from '../util/feature-flags'
import {connect} from 'react-redux'
import {routeAppend} from '../actions/router'
import Routable from '../util/routable'

class Settings extends Component {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Settings'},
      subRoutes: {
        devMenu,
        deleteConfirm: DeleteConfirm,
        removeDevice: RemoveDevice,
        inviteSent: Routable((uri) => ({
          componentAtTop: {
            title: '',
            props: uri.get('props') || {},
          },
        }), InviteGenerated),
      },
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
