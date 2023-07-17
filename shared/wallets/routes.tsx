import type * as Types from '../constants/types/wallets'
import walletsRoot from './page'
import reallyRemoveAccount from './really-remove-account/page'
import removeAccount from './remove-account/page'
export const newRoutes = {
  walletsRoot,
}

export const newModalRoutes = {
  reallyRemoveAccount,
  removeAccount,
}

export type RootParamListWallets = {
  removeAccount: {accountID: Types.AccountID}
  reallyRemoveAccount: {accountID: Types.AccountID}
}
