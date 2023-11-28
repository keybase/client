import type * as C from '@/constants'
import gitRoot from './page'
import gitDeleteRepo from './delete-repo.page'
import gitNewRepo from './new-repo.page'
import gitSelectChannel from './select-channel.page'

export const newRoutes = {gitRoot}
export const newModalRoutes = {
  gitDeleteRepo,
  gitNewRepo,
  gitSelectChannel,
}

export type RootParamListGit = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
