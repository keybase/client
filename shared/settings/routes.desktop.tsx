import * as Constants from '../constants/settings'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import * as Shim from '../router-v2/shim'

const settingsSubRoutes = {
  [Constants.fsTab]: {getScreen: () => require('./files/container').default},
  [Constants.advancedTab]: {getScreen: () => require('./advanced/container').default},
  [Constants.chatTab]: {getScreen: () => require('./chat/container').default},
  [Constants.deleteMeTab]: {getScreen: () => require('./delete/container').default},
  [Constants.invitationsTab]: {getScreen: () => require('./invites/container').default},
  [Constants.accountTab]: {getScreen: () => require('./account/container').default},
  [Constants.feedbackTab]: {getScreen: () => require('./feedback/container').default},
  [Constants.notificationsTab]: {getScreen: () => require('./notifications/container').default},
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
        <Settings routeSelected={descriptor.state.routeName}>
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
const SettingsSubNavigator = createNavigator(
  SettingsSubNav,
  StackRouter(Shim.shim(settingsSubRoutes), {initialRouteName: Constants.accountTab}),
  {}
)

SettingsSubNavigator.navigationOptions = {
  title: 'Settings',
}

export const newRoutes = {
  settingsRoot: {getScreen: () => SettingsSubNavigator, upgraded: true},
}
export const newModalRoutes = {
  [Constants.logOutTab]: {getScreen: () => require('./logout/container').default},
  addEmail: {getScreen: () => require('./account/add-modals').Email},
  addPhone: {getScreen: () => require('./account/add-modals').Phone},
  changePassword: {getScreen: () => require('./password/container').default},
  disableCertPinningModal: {getScreen: () => require('./disable-cert-pinning-modal/container').default},
}
