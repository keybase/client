import PeopleRoot from './container'
import AccountSwitcher from '../router-v2/account-switcher/container'

export const newRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default},
}

export const newModalRoutes = {}
