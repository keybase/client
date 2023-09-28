import type * as Types from '../constants/types/wallets'
/*
import type {TeamBuilderProps} from '../team-building/container'
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
import type * as Types from '../constants/types/wallets'

export const sharedRoutes = {
  // TODO connect broken
  settings: {getScreen: (): typeof Settings => require('./wallet/settings/container').default},
  // TODO connect broken
  transactionDetails: {
    getOptions: {
      header: undefined,
      title: 'Transaction details',
    },
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

// TODO fix up the missing prefix on these routes
export type RootParamListWallets = {
  whatIsStellarModal: undefined
  walletTeamBuilder: TeamBuilderProps
  keybaseLinkError: {
    errorSource: 'app' | 'sep6' | 'sep7'
  }
  setDefaultAccount: {accountID: Types.AccountID}
  walletOnboarding: {
    nextScreen: Types.NextScreenAfterAcceptance
  }
  transactionDetails: {
    accountID: Types.AccountID
    paymentID: Types.PaymentID
  }
  sendReceiveForm: {isAdvanced: boolean}
  pickAssetForm: {
    // ignored if username is set or isSender===true
    accountID: string
    // ignored if isSender===true; if empty, we assume this is for a non-keybaseUser account and just say "this account"
    username: string
    isSender: boolean
  }
  removeAccount: {accountID: Types.AccountID}
  createNewAccount: {
    fromSendForm?: boolean
    showOnCreation?: boolean
  }
  trustline: {accountID: Types.AccountID}
  receive: {accountID: Types.AccountID}
  linkExisting: {
    fromSendForm?: boolean
    showOnCreation?: boolean
  }
  reallyRemoveAccount: {accountID: Types.AccountID}
  renameAccount: {accountID: Types.AccountID}
  settings: undefined
  qrScan: undefined
  confirmForm: undefined
  chooseAssetForm: undefined
  sep7Confirm: undefined
}
*/

const Keep = {getOptions: () => ({title: 'Wallet'}), getScreen: () => require('./keep').default}

export const sharedRoutes = {
  settings: Keep,
  transactionDetails: Keep,
}

export const newRoutes = {
  walletsRoot: Keep,
  ...sharedRoutes, // these are valid inside AND outside the subnav
  ///
  //// were modal
  ...require('./routes-send-request-form').newModalRoutes,
  createNewAccount: Keep,
  keybaseLinkError: Keep,
  linkExisting: Keep,
  receive: Keep,
  renameAccount: Keep,
  sep7Confirm: Keep,
  setDefaultAccount: Keep,
  trustline: Keep,
  walletOnboarding: Keep,
  walletTeamBuilder: Keep,
  whatIsStellarModal: Keep,
}

export const newModalRoutes = {
  reallyRemoveAccount: {
    getScreen: () => require('./wallet/settings/popups').ReallyRemoveAccountPopup,
  },
  removeAccount: {
    getScreen: () => require('./wallet/settings/popups').RemoveAccountPopup,
  },
}

export type RootParamListWallets = {
  removeAccount: {accountID: Types.AccountID}
  reallyRemoveAccount: {accountID: Types.AccountID}
  whatIsStellarModal: undefined
  walletTeamBuilder: undefined
  keybaseLinkError: undefined
  setDefaultAccount: undefined
  walletOnboarding: undefined
  transactionDetails: undefined
  sendReceiveForm: undefined
  pickAssetForm: undefined
  createNewAccount: undefined
  trustline: undefined
  receive: undefined
  linkExisting: undefined
  renameAccount: undefined
  settings: undefined
  qrScan: undefined
  confirmForm: undefined
  chooseAssetForm: undefined
  sep7Confirm: undefined
}
