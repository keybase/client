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
  removeAccount: {accountID: string}
  reallyRemoveAccount: {accountID: string}
}
