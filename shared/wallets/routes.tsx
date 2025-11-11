import * as React from 'react'
import type * as C from '@/constants'

const WalletsRoot = React.lazy(async () => import('.'))
const walletsRoot = {
  getOptions: {title: 'Wallet'},
  screen: WalletsRoot,
}

const ReallyRemove = React.lazy(async () => import('./really-remove-account'))
const reallyRemoveAccount = {
  screen: function ReallyRemoveAccount(p: C.ViewPropsToPageProps<typeof ReallyRemove>) {
    return <ReallyRemove {...p.route.params} />
  },
}

const Remove = React.lazy(async () => import('./remove-account'))
const removeAccount = {
  screen: function RemoveAccount(p: C.ViewPropsToPageProps<typeof Remove>) {
    return <Remove {...p.route.params} />
  },
}

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
