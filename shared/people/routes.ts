import peopleRoot from './page'
import accountSwitcher from '../router-v2/account-switcher/page'
import peopleTeamBuilder from '../team-building/page'
import type * as Container from '../util/container'

export const newRoutes = {peopleRoot}

export const newModalRoutes = {
  accountSwitcher,
  peopleTeamBuilder,
}

export type RootParamListPeople = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
