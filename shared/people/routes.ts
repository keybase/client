import type PeopleRoot from './container'
import type TeamBuilder from '../team-building/container'
import type AccountSwitcher from '../router-v2/account-switcher/container'
import type * as TeamBuildingTypes from '../constants/types/team-building'

export const newRoutes = {
  peopleRoot: {
    getOptions: () => require('./container').options,
    getScreen: (): typeof PeopleRoot => require('./container').default,
  },
}

export const newModalRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  peopleTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}

type TeamBuilderProps = Partial<{
  namespace: TeamBuildingTypes.AllowedNamespace
  teamID: string
  filterServices: Array<TeamBuildingTypes.ServiceIdWithContact>
  goButtonLabel: TeamBuildingTypes.GoButtonLabel
  title: string
}>

export type RootParamListPeople = {
  peopleTeamBuilder: TeamBuilderProps
}
