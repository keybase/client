import * as Constants from '../constants/settings'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {NavigationViewProps, createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import * as Shim from '../router-v2/shim'
import DevicesTab from '../devices/container'
import GitTab from '../git/container'
import FsTab from './files/container'
import AdvancedTab from './advanced'
import ChatTab from './chat/container'
import DisplayTab from './display/container'
import InvitationsTab from './invites/container'
import AccountTab from './account/container'
import FeedbackTab from './feedback/container'
import NotificationsTab from './notifications/container'
import DbNukeConfirm from './db-nuke-confirm/container'
import DeleteConfirm from './delete-confirm/index'
import InviteSent from './invite-generated/container'
import RemoveDevice from '../devices/device-revoke/container'
import LogOutTab from './logout/container'
import ChangePassword from './password/container'
import DisableCertPinningModal from './disable-cert-pinning-modal/container'
import {DeleteModal} from './account/confirm-delete'
import {Email, Phone, VerifyPhone} from './account/add-modals'

const settingsSubRoutes = {
  [Constants.devicesTab]: {getScreen: (): typeof DevicesTab => require('../devices/container').default},
  [Constants.gitTab]: {getScreen: (): typeof GitTab => require('../git/container').default},
  [Constants.fsTab]: {getScreen: (): typeof FsTab => require('./files/container').default},
  [Constants.advancedTab]: {getScreen: (): typeof AdvancedTab => require('./advanced').default},
  [Constants.chatTab]: {getScreen: (): typeof ChatTab => require('./chat/container').default},
  // TODO connect broken
  [Constants.invitationsTab]: {
    getScreen: (): typeof InvitationsTab => require('./invites/container').default,
  },
  [Constants.accountTab]: {getScreen: (): typeof AccountTab => require('./account/container').default},
  [Constants.displayTab]: {getScreen: (): typeof DisplayTab => require('./display/container').default},
  [Constants.feedbackTab]: {getScreen: (): typeof FeedbackTab => require('./feedback/container').default},
  [Constants.notificationsTab]: {
    getScreen: (): typeof NotificationsTab => require('./notifications/container').default,
  },
  dbNukeConfirm: {getScreen: (): typeof DbNukeConfirm => require('./db-nuke-confirm/container').default},
  inviteSent: {getScreen: (): typeof InviteSent => require('./invite-generated/container').default},
  removeDevice: {getScreen: (): typeof RemoveDevice => require('../devices/device-revoke/container').default},
}
const noScreenProps = {}
class SettingsSubNav extends React.PureComponent<NavigationViewProps<any>> {
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
            screenProps={this.props.screenProps || noScreenProps}
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
  // MUST use screen and not getScreen for subnavs!
  settingsRoot: {screen: SettingsSubNavigator},
}
export const newModalRoutes = {
  [Constants.logOutTab]: {getScreen: (): typeof LogOutTab => require('./logout/container').default},
  // TODO connect broken
  changePassword: {getScreen: (): typeof ChangePassword => require('./password/container').default},
  deleteConfirm: {getScreen: (): typeof DeleteConfirm => require('./delete-confirm/index').default},
  disableCertPinningModal: {
    getScreen: (): typeof DisableCertPinningModal =>
      require('./disable-cert-pinning-modal/container').default,
  },
  modalFeedback: {getScreen: (): typeof FeedbackTab => require('../signup/feedback/container').default},
  settingsAddEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  settingsAddPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  settingsDeleteAddress: {
    getScreen: (): typeof DeleteModal => require('./account/confirm-delete').DeleteModal,
  },
  settingsVerifyPhone: {getScreen: (): typeof VerifyPhone => require('./account/add-modals').VerifyPhone},
}
