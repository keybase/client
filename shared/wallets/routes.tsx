import {isMobile} from '../constants/platform'
import AirdropQualify from './airdrop/qualify/container'
import CreateNewAccount from './create-account/container'
import LinkExisting from './link-existing/container'
import {
  RenameAccountPopup,
  ReallyRemoveAccountPopup,
  RemoveAccountPopup,
  SetDefaultAccountPopup,
} from './wallet/settings/popups'
import Receive from './receive-modal/container'
import Sep7Confirm from './sep7-confirm/container'
import KeybaseLinkError from '../deeplinks/error'
import Trustline from './trustline/container'
import {RoutedOnboarding} from './onboarding/container'
import WhatIsStellarModal from './what-is-stellar-modal'
import Airdrop from './airdrop/container'
import Settings from './wallet/settings/container'
import TransactionDetails from './transaction-details/container'
import TeamBuilder from '../team-building/container'

export const sharedRoutes = {
  airdrop: {getScreen: (): typeof Airdrop => require('./airdrop/container').default},
  // TODO connect broken
  settings: {getScreen: (): typeof Settings => require('./wallet/settings/container').default},
  // TODO connect broken
  transactionDetails: {
    getScreen: (): typeof TransactionDetails => require('./transaction-details/container').default,
  },
}

export const newRoutes = {
  walletsRoot: isMobile
    ? {getScreen: () => require('./wallet/container').default}
    : // MUST use screen and not getScreen for subnavs!
      {
        get screen() {
          return require('./wallets-sub-nav').default
        },
      },
  ...sharedRoutes, // these are valid inside AND outside the subnav
}

export const newModalRoutes = {
  ...require('./routes-send-request-form').newModalRoutes,
  airdropQualify: {getScreen: (): typeof AirdropQualify => require('./airdrop/qualify/container').default},
  createNewAccount: {getScreen: (): typeof CreateNewAccount => require('./create-account/container').default},
  keybaseLinkError: {getScreen: (): typeof KeybaseLinkError => require('../deeplinks/error').default},
  linkExisting: {getScreen: (): typeof LinkExisting => require('./link-existing/container').default},
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
  walletTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
  whatIsStellarModal: {
    getScreen: (): typeof WhatIsStellarModal => require('./what-is-stellar-modal').default,
  },
}
