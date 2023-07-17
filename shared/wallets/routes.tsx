// import createNewAccount from './create-account/page'
// import keybaseLinkError from '../deeplinks/page'
// import linkExisting from './link-existing/page'
// import reallyRemoveAccount from './wallet/settings/popups/really-remove-account/page'
// import receive from './receive-modal/page'
// import removeAccount from './wallet/settings/popups/remove-account/page'
// import renameAccount from './wallet/settings/popups/rename-account/page'
// import sep7Confirm from './sep7-confirm/page'
// import setDefaultAccount from './wallet/settings/popups/set-default/page'
// import settings from './wallet/settings/page'
// import transactionDetails from './transaction-details/page'
// import trustline from './trustline/page'
// import wallet from './wallet/page'
// import walletOnboarding from './onboarding/page'
// import walletTeamBuilder from '../team-building/page'
// import walletsSubNav from './wallets-sub-nav.page'
// import whatIsStellarModal from './what-is-stellar-modal/page'
// import type * as Container from '../util/container'
import type * as Types from '../constants/types/wallets'
/*
import type {TeamBuilderProps} from '../team-building/container'
import {isPhone} from '../constants/platform'
import {newModalRoutes as sendModalRoutes} from './routes-send-request-form'

export const sharedRoutes = {
  settings,
  transactionDetails,
}

export const newRoutes = {
  walletsRoot: isPhone ? wallet : walletsSubNav,
  ...sharedRoutes, // these are valid inside AND outside the subnav
}

export const newModalRoutes = {
  ...sendModalRoutes,
  createNewAccount,
  keybaseLinkError,
  linkExisting,
  reallyRemoveAccount,
  receive,
  removeAccount,
  renameAccount,
  sep7Confirm,
  setDefaultAccount,
  trustline,
  walletOnboarding,
  walletTeamBuilder,
  whatIsStellarModal,
}

// export type RootParamListWallets = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
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
