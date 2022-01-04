import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import type CheckPassphraseMobile from './delete-confirm/check-passphrase.native'
import type ContactsJoinedModal from './contacts-joined/index.native'
import type ManageContactsTab from './manage-contacts.native'
import type PushPrompt from './notifications/push-prompt.native'
import type ScreenprotectorTab from './screenprotector.native'
import type RootPhone from './root-phone.native'
import type WalletsTab from '../wallets/wallet/container'
import type WebLink from './web-links.native'
import {sharedNewRoutes, sharedNewModalRoutes} from './routes.shared'

export const newRoutes = {
  settingsRoot: Container.isPhone
    ? {getScreen: (): typeof RootPhone => require('./root-phone.native').default}
    : {},
  ...sharedNewRoutes,
  [Constants.walletsTab]: Container.isTablet
    ? {
        get screen() {
          return require('../wallets/wallets-sub-nav').default
        },
      }
    : {getScreen: (): typeof WalletsTab => require('../wallets/wallet/container').default},
  [Constants.screenprotectorTab]: {
    getScreen: (): typeof ScreenprotectorTab => require('./screenprotector.native').default,
  },
  [Constants.contactsTab]: {
    getScreen: (): typeof ManageContactsTab => require('./manage-contacts.native').default,
  },
  terms: {getScreen: (): typeof WebLink => require('./web-links.native').default},
  privacyPolicy: {getScreen: (): typeof WebLink => require('./web-links.native').default},
}

export const newModalRoutes = {
  ...sharedNewModalRoutes,
  checkPassphraseBeforeDeleteAccount: {
    getScreen: (): typeof CheckPassphraseMobile =>
      require('./delete-confirm/check-passphrase.native').default,
  },
  settingsPushPrompt: {
    getScreen: (): typeof PushPrompt => require('./notifications/push-prompt.native').default,
  },
  settingsContactsJoined: {
    getScreen: (): typeof ContactsJoinedModal => require('./contacts-joined/index.native').default,
  },
}

// const noScreenProps = {}
// class SettingsSubNav extends React.PureComponent<NavigationViewProps<any>> {
//   render() {
//     const navigation = this.props.navigation
//     const index = navigation.state.index
//     const activeKey = navigation.state.routes[index].key
//     const descriptor = this.props.descriptors[activeKey]
//     const childNav = descriptor.navigation
//
//     const Settings = require('./').default
//     return (
//       <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
//         <Settings routeSelected={descriptor.state.routeName}>
//           <SceneView
//             navigation={childNav}
//             component={descriptor.getComponent()}
//             screenProps={this.props.screenProps || noScreenProps}
//           />
//         </Settings>
//       </Kb.Box2>
//     )
//   }
// }
// const SettingsSubNavigator = createNavigator(
// SettingsSubNav,
// StackRouter(Shim.shim(subRoutes), {initialRouteName: Constants.accountTab}),
// {}
// )

// SettingsSubNavigator.navigationOptions = {
// header: undefined,
// title: 'More',
// }

// const phoneNewRoutes = {
//   ...subRoutes,
//   settingsRoot: {getScreen: (): typeof SettingsRoot => require('.').default},
// }
// const tabletNewRoutes = {
//   ...subRoutes,
//   // TODO
//   // settingsRoot: {screen: SettingsSubNavigator},
// }
//
// export const newRoutes = Container.isPhone ? phoneNewRoutes : tabletNewRoutes
