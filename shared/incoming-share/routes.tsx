import type * as C from '@/constants'
import incomingShareNew from './page'

export const newModalRoutes = {
  incomingShareNew,
}

export type RootParamListIncomingShare = C.PagesToParams<typeof newModalRoutes>
