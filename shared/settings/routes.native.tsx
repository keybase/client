import * as Constants from '../constants/settings'
import * as Kb from '../common-adapters'
import * as React from 'react'
import {NavigationViewProps, /*createNavigator,*/ StackRouter, SceneView} from '@react-navigation/core'
import * as Shim from '../router-v2/shim'
import * as Container from '../util/container'
import type AboutTab from './about'
import type AdvancedTab from './advanced'
import type ChatTab from './chat/container'
import type DevicesTab from '../devices/container'
import type DisplayTab from './display/container'
import type FsTab from './files/container'
import type GitTab from '../git/container'
import type WalletsTab from '../wallets/wallet/container'
import type FeedbackTab from './feedback/container'
import type InvitationsTab from './invites/container'
import type AccountTab from './account/container'
import type NotificationsTab from './notifications/container'
import type PasswordTab from './password/container'
import type ScreenprotectorTab from './screenprotector.native'
import type DbNukeConfirm from './db-nuke-confirm/container'
import type DeleteConfirm from './delete-confirm/index'
import type CheckPassphraseMobile from './delete-confirm/check-passphrase.native'
import type InviteSent from './invite-generated/container'
import type RemoveDevice from '../devices/device-revoke/container'
import type WebLink from './web-links.native'
import type LogOutTab from './logout/container'
import type DisableCertPinningModal from './disable-cert-pinning-modal/container'
import type {DeleteModal} from './account/confirm-delete'
import type {Email, Phone, VerifyPhone} from './account/add-modals'
import type ManageContactsTab from './manage-contacts.native'
import type PushPrompt from './notifications/push-prompt.native'
import type ContactsJoinedModal from './contacts-joined/index.native'
import type WhatsNewTab from '../whats-new/container'
import type SettingsRoot from '.'

const subRoutes = {
  [Constants.devicesTab]: {getScreen: (): typeof DevicesTab => require('../devices/container').default},
  [Constants.gitTab]: {getScreen: (): typeof GitTab => require('../git/container').default},
  [Constants.aboutTab]: {getScreen: (): typeof AboutTab => require('./about').default},
  [Constants.advancedTab]: {
    getScreen: (): typeof AdvancedTab => require('./advanced').default,
  },
  [Constants.chatTab]: {getScreen: (): typeof ChatTab => require('./chat/container').default},
  [Constants.cryptoTab]: {getScreen: (): typeof ChatTab => require('../crypto/sub-nav').default},
  [Constants.displayTab]: {getScreen: (): typeof DisplayTab => require('./display/container').default},
  [Constants.fsTab]: {getScreen: (): typeof FsTab => require('./files/container').default},
  [Constants.walletsTab]: Container.isTablet
    ? {
        get screen() {
          return require('../wallets/wallets-sub-nav').default
        },
      }
    : {getScreen: (): typeof WalletsTab => require('../wallets/wallet/container').default},
  [Constants.feedbackTab]: {
    getScreen: (): typeof FeedbackTab => require('./feedback/container').default,
  },
  // TODO connect broken
  [Constants.invitationsTab]: {
    getScreen: (): typeof InvitationsTab => require('./invites/container').default,
  },
  [Constants.accountTab]: {getScreen: (): typeof AccountTab => require('./account/container').default},
  [Constants.notificationsTab]: {
    getScreen: (): typeof NotificationsTab => require('./notifications/container').default,
  },
  [Constants.screenprotectorTab]: {
    getScreen: (): typeof ScreenprotectorTab => require('./screenprotector.native').default,
  },
  [Constants.whatsNewTab]: {
    getScreen: (): typeof WhatsNewTab => require('../whats-new/container.tsx').default,
  },
  addEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  addPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  dbNukeConfirm: {
    getScreen: (): typeof DbNukeConfirm => require('./db-nuke-confirm/container').default,
  },
  inviteSent: {getScreen: (): typeof InviteSent => require('./invite-generated/container').default},
  [Constants.contactsTab]: {
    getScreen: (): typeof ManageContactsTab => require('./manage-contacts.native').default,
  },
  privacyPolicy: {getScreen: (): typeof WebLink => require('./web-links.native').default},
  removeDevice: {
    getScreen: (): typeof RemoveDevice => require('../devices/device-revoke/container').default,
  },
  terms: {getScreen: (): typeof WebLink => require('./web-links.native').default},
}

export const newModalRoutes = {
  [Constants.logOutTab]: {getScreen: (): typeof LogOutTab => require('./logout/container').default},
  [Constants.passwordTab]: {
    getScreen: (): typeof PasswordTab => require('./password/container').default,
  },
  checkPassphraseBeforeDeleteAccount: {
    getScreen: (): typeof CheckPassphraseMobile =>
      require('./delete-confirm/check-passphrase.native').default,
  },
  deleteConfirm: {
    getScreen: (): typeof DeleteConfirm => require('./delete-confirm/index').default,
  },
  disableCertPinningModal: {
    getScreen: (): typeof DisableCertPinningModal =>
      require('./disable-cert-pinning-modal/container').default,
  },
  settingsAddEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  settingsAddPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  settingsContactsJoined: {
    getScreen: (): typeof ContactsJoinedModal => require('./contacts-joined').default,
  },
  settingsDeleteAddress: {
    getScreen: (): typeof DeleteModal => require('./account/confirm-delete').DeleteModal,
  },
  settingsPushPrompt: {
    getScreen: (): typeof PushPrompt => require('./notifications/push-prompt.native').default,
  },
  settingsVerifyPhone: {
    getScreen: (): typeof VerifyPhone => require('./account/add-modals').VerifyPhone,
  },
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
// const SettingsSubNavigator = createNavigator(
// SettingsSubNav,
// StackRouter(Shim.shim(subRoutes), {initialRouteName: Constants.accountTab}),
// {}
// )

// SettingsSubNavigator.navigationOptions = {
// header: undefined,
// title: 'More',
// }

const phoneNewRoutes = {
  ...subRoutes,
  settingsRoot: {getScreen: (): typeof SettingsRoot => require('.').default},
}
const tabletNewRoutes = {
  ...subRoutes,
  // TODO
  // settingsRoot: {screen: SettingsSubNavigator},
}

export const newRoutes = Container.isPhone ? phoneNewRoutes : tabletNewRoutes
