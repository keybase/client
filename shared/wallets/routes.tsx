import {isPhone} from '../constants/platform'
import type CreateNewAccount from './create-account/container'
import type LinkExisting from './link-existing/container'
import type {
  RenameAccountPopup,
  ReallyRemoveAccountPopup,
  RemoveAccountPopup,
  SetDefaultAccountPopup,
} from './wallet/settings/popups'
import type Receive from './receive-modal/container'
import type Sep7Confirm from './sep7-confirm/container'
import type KeybaseLinkError from '../deeplinks/error'
import type Trustline from './trustline/container'
import type {RoutedOnboarding} from './onboarding/container'
import type WhatIsStellarModal from './what-is-stellar-modal'
import type Settings from './wallet/settings/container'
import type TransactionDetails from './transaction-details/container'
import type TeamBuilder from '../team-building/container'
// import Partners from './partners/container'

export const sharedRoutes = {
  // TODO connect broken
  settings: {getScreen: (): typeof Settings => require('./wallet/settings/container').default},
  // TODO connect broken
  transactionDetails: {
    getScreen: (): typeof TransactionDetails => require('./transaction-details/container').default,
  },
}

export const newRoutes = {
  walletsRoot: isPhone
    ? {getScreen: () => require('./wallet/container').default}
    : {
        getScreen: () => require('./wallets-sub-nav').default,
        skipShim: true,
      },
  ...sharedRoutes, // these are valid inside AND outside the subnav
}

export const newModalRoutes = {
  ...require('./routes-send-request-form').newModalRoutes,
  createNewAccount: {
    getScreen: (): typeof CreateNewAccount => require('./create-account/container').default,
  },
  keybaseLinkError: {getScreen: (): typeof KeybaseLinkError => require('../deeplinks/error').default},
  linkExisting: {getScreen: (): typeof LinkExisting => require('./link-existing/container').default},
  // partners: {getScreen: (): typeof Partners => require('./partners/container').default},
  reallyRemoveAccount: {
    getScreen: (): typeof ReallyRemoveAccountPopup =>
      require('./wallet/settings/popups').ReallyRemoveAccountPopup,
  },
  receive: {getScreen: (): typeof Receive => require('./receive-modal/container').default},
  removeAccount: {
    getScreen: (): typeof RemoveAccountPopup => require('./wallet/settings/popups').RemoveAccountPopup,
  },
  renameAccount: {
    getScreen: (): typeof RenameAccountPopup => require('./wallet/settings/popups').RenameAccountPopup,
  },
  sep7Confirm: {getScreen: (): typeof Sep7Confirm => require('./sep7-confirm/container').default},
  setDefaultAccount: {
    getScreen: (): typeof SetDefaultAccountPopup =>
      require('./wallet/settings/popups').SetDefaultAccountPopup,
  },
  trustline: {getScreen: (): typeof Trustline => require('./trustline/container').default},
  walletOnboarding: {
    getScreen: (): typeof RoutedOnboarding => require('./onboarding/container').RoutedOnboarding,
  },
  walletTeamBuilder: {
    getScreen: (): typeof TeamBuilder => require('../team-building/container').default,
  },
  whatIsStellarModal: {
    getScreen: (): typeof WhatIsStellarModal => require('./what-is-stellar-modal').default,
  },
}
