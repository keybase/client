import PeopleRoot from './container'
import AccountSwitcher from '../router-v2/account-switcher/container'
import TeamBuilder from '../team-building/container'

export const newRoutes = {
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default},
}

export const newModalRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  peopleTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
