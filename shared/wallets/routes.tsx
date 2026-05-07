import * as React from 'react'
import * as C from '@/constants'
import {defineRouteMap} from '@/constants/types/router'

export const newRoutes = defineRouteMap({
  walletsRoot: {
    getOptions: {title: 'Wallet'},
    screen: React.lazy(async () => import('.')),
  },
})

export const newModalRoutes = defineRouteMap({
  reallyRemoveAccount: C.makeScreen(React.lazy(async () => import('./really-remove-account'))),
  removeAccount: C.makeScreen(React.lazy(async () => import('./remove-account'))),
})
