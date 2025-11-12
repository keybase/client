import * as React from 'react'
import type * as C from '@/constants'

const IncomingShareNew = React.lazy(async () => import('.'))
const incomingShareNew = {screen: IncomingShareNew}
export const newModalRoutes = {incomingShareNew}

export type RootParamListIncomingShare = C.PagesToParams<typeof newModalRoutes>
