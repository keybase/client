import type PeopleRoot from './container'
import type TeamBuilder from '../team-building/container'
import type AccountSwitcher from '../router-v2/account-switcher/container'

export const newRoutes = {
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default},
}

export const newModalRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  peopleTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
