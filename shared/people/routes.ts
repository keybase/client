import type * as C from '@/constants'
import peopleRoot from './page'
import accountSwitcher from '@/router-v2/account-switcher/page'
import peopleTeamBuilder from '../team-building/page'

export const newRoutes = {peopleRoot}

export const newModalRoutes = {
  accountSwitcher,
  peopleTeamBuilder,
}

export type RootParamListPeople = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
