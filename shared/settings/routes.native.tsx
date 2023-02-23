import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import type CheckPassphraseMobile from './delete-confirm/check-passphrase.native'
import type ContactsJoinedModal from './contacts-joined/index.native'
import type ManageContactsTab from './manage-contacts.native'
import type PushPrompt from './notifications/push-prompt.native'
import type ScreenprotectorTab from './screenprotector.native'
import type RootPhone from './root-phone.native'
import type RootTablet from './root-desktop-tablet'
import type WalletsTab from '../wallets/wallet/container'
import type WebLink from './web-links.native'
import {sharedNewRoutes, sharedNewModalRoutes} from './routes.shared'

export const newRoutes = {
  settingsRoot: Container.isPhone
    ? {getScreen: (): typeof RootPhone => require('./root-phone.native').default}
    : {getScreen: (): typeof RootTablet => require('./root-desktop-tablet').default, skipShim: true},
  ...sharedNewRoutes,
  ...(Container.isTablet
    ? {}
    : {
        [Constants.walletsTab]: {
          getScreen: (): typeof WalletsTab => require('../wallets/wallet/container').default,
        },
      }),
  [Constants.screenprotectorTab]: {
    getScreen: (): typeof ScreenprotectorTab => require('./screenprotector.native').default,
  },
  [Constants.contactsTab]: {
    getScreen: (): typeof ManageContactsTab => require('./manage-contacts.native').default,
  },
  webLinks: {
    getOptions: ({route}) => ({
      header: undefined,
      title: Container.getRouteParamsFromRoute<'webLinks'>(route)?.title,
    }),
    getScreen: (): typeof WebLink => require('./web-links.native').default,
  },
}

export const newModalRoutes = {
  ...sharedNewModalRoutes,
  checkPassphraseBeforeDeleteAccount: {
    getScreen: (): typeof CheckPassphraseMobile =>
      require('./delete-confirm/check-passphrase.native').default,
  },
  settingsContactsJoined: {
    getScreen: (): typeof ContactsJoinedModal => require('./contacts-joined/index.native').default,
  },
  settingsPushPrompt: {
    getScreen: (): typeof PushPrompt => require('./notifications/push-prompt.native').default,
  },
}
