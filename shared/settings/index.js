// @flow
import DeleteConfirm from './delete-confirm/container'
import InviteGenerated from './invite-generated'
import Passphrase from './passphrase/container'
import PlanDetails from './plan-details/container'
import React, {Component} from 'react'
import RemoveDevice from '../devices/device-revoke'
import Render from './render'
import Routable from '../util/routable'
import UserEmail from './email/container'
import devMenu from '../dev/dev-menu'
import flags from '../util/feature-flags'
import {connect} from 'react-redux'
import {routeAppend} from '../actions/router'

class Settings extends Component {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Settings'},
      subRoutes: {
        devMenu,
        deleteConfirm: DeleteConfirm,
        removeDevice: RemoveDevice,
        changeEmail: UserEmail,
        changePassphrase: Passphrase,
        changePlan: PlanDetails,
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
