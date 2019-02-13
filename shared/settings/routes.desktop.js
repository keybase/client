// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import * as Constants from '../constants/settings'
import * as I from 'immutable'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import * as Shim from '../router-v2/shim.desktop'

const routeTree = () => {
  const Settings = require('./').default
  const LandingContainer = require('./landing/container').default
  // const UpdatePayment = require('./payment/container').default
  const AdvancedContainer = require('./advanced/container').default
  const FilesContainer = require('./files/container').default
  const DBNukeConfirm = require('./db-nuke-confirm/container').default
  const InvitationsContainer = require('./invites/container').default
  const NotificationsContainer = require('./notifications/container').default
  const ChatContainer = require('./chat/container').default
  const DeleteContainer = require('./delete/container').default
  const DeleteConfirm = require('./delete-confirm/container').default
  const RemoveDevice = require('../devices/device-revoke/container').default
  const InviteGenerated = require('./invite-generated/container').default
  const Passphrase = require('./passphrase/container').default
  const UserEmail = require('./email/container').default
  const SecurityPrefs = require('../fs/common/security-prefs-container.desktop').default
  return makeRouteDefNode({
    children: {
      [Constants.landingTab]: {
        children: {
          changeEmail: {
            component: UserEmail,
          },
          changePassphrase: {
            component: Passphrase,
          },
          // changePlan: {
          // component: PlanDetails,
          // },
        },
        component: LandingContainer,
      },
      // [Constants.updatePaymentTab]: {
      // component: UpdatePayment,
      // },
      [Constants.invitationsTab]: {
        children: {
          inviteSent: {
            component: InviteGenerated,
          },
        },
        component: InvitationsContainer,
      },
      [Constants.notificationsTab]: {
        component: NotificationsContainer,
      },
      [Constants.deleteMeTab]: {
        children: {
          deleteConfirm: {
            component: DeleteConfirm,
            tags: makeLeafTags({modal: true}),
          },
          removeDevice: {
            component: RemoveDevice,
            tags: makeLeafTags({modal: true}),
          },
        },
        component: DeleteContainer,
      },
      [Constants.advancedTab]: {
        children: {
          dbNukeConfirm: {
            component: DBNukeConfirm,
            tags: makeLeafTags({modal: true}),
          },
        },
        component: AdvancedContainer,
      },
      [Constants.fsTab]: {
        children: {
          securityPrefs: {
            component: SecurityPrefs,
          },
        },
        component: FilesContainer,
      },
      [Constants.chatTab]: {
        component: ChatContainer,
      },
    },
    containerComponent: Settings,
    defaultSelected: Constants.landingTab,
  })
}

export default routeTree

const settingsRoutes = {
  [Constants.fsTab]: {getScreen: () => require('./files/container').default},
  [Constants.advancedTab]: {getScreen: () => require('./advanced/container').default},
  [Constants.chatTab]: {getScreen: () => require('./chat/container').default},
  [Constants.deleteMeTab]: {getScreen: () => require('./delete/container').default},
  [Constants.invitationsTab]: {getScreen: () => require('./invites/container').default},
  [Constants.landingTab]: {getScreen: () => require('./landing/container').default},
  [Constants.notificationsTab]: {getScreen: () => require('./notifications/container').default},
  changeEmail: {getScreen: () => require('./email/container').default},
  changePassphrase: {getScreen: () => require('./passphrase/container').default},
  dbNukeConfirm: {getScreen: () => require('./db-nuke-confirm/container').default},
  deleteConfirm: {getScreen: () => require('./delete-confirm/container').default},
  inviteSent: {getScreen: () => require('./invite-generated/container').default},
  removeDevice: {getScreen: () => require('../devices/device-revoke/container').default},
}

class SettingsSubNav extends React.PureComponent<any> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation

    const Settings = require('./').default
    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <Settings
          routeLeafTags={mockRouteLeafTag}
          routeSelected={descriptor.state.routeName}
          routePath={mockRoutePath}
        >
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={this.props.screenProps}
          />
        </Settings>
      </Kb.Box2>
    )
  }
}
const mockRouteLeafTag = {isModal: false}
const mockRoutePath = I.List()
const MainNavigator = createNavigator(
  SettingsSubNav,
  StackRouter(Shim.shim(settingsRoutes), {initialRouteName: Constants.landingTab}),
  {}
)

export const newRoutes = {
  'tabs:settingsTab': {getScreen: () => MainNavigator, upgraded: true},
}
export const newModalRoutes = {}
