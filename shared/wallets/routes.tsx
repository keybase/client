import createNewAccount from './create-account/page'
import keybaseLinkError from '../deeplinks/page'
import linkExisting from './link-existing/page'
import reallyRemoveAccount from './wallet/settings/popups/really-remove-account/page'
import receive from './receive-modal/page'
import removeAccount from './wallet/settings/popups/remove-account/page'
import renameAccount from './wallet/settings/popups/rename-account/page'
import sep7Confirm from './sep7-confirm/page'
import setDefaultAccount from './wallet/settings/popups/set-default/page'
import settings from './wallet/settings/page'
import transactionDetails from './transaction-details/page'
import trustline from './trustline/page'
import wallet from './wallet/page'
import walletOnboarding from './onboarding/page'
import walletTeamBuilder from '../team-building/page'
import walletsSubNav from './wallets-sub-nav.page'
import whatIsStellarModal from './what-is-stellar-modal/page'
import type * as Container from '../util/container'
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

export type RootParamListWallets = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
