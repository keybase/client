import * as React from 'react'
import type * as C from '@/constants'

export const newModalRoutes = {
  incomingShareNew: {screen: React.lazy(async () => import('.'))},
}

export type RootParamListIncomingShare = C.PagesToParams<typeof newModalRoutes>
