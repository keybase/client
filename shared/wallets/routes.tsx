import * as React from 'react'
import * as C from '@/constants'

export const newRoutes = {
  walletsRoot: C.makeScreen(
    React.lazy(async () => import('.')),
    {getOptions: {title: 'Wallet'}}
  ),
}

export const newModalRoutes = {
  reallyRemoveAccount: C.makeScreen(React.lazy(async () => import('./really-remove-account'))),
  removeAccount: C.makeScreen(React.lazy(async () => import('./remove-account'))),
}

export type RootParamListWallets = {
  removeAccount: {accountID: string}
  reallyRemoveAccount: {accountID: string}
}
