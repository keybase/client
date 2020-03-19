import PeopleRoot from './container'
import AccountSwitcher from '../router-v2/account-switcher/container'
import TeamBuilder from '../team-building/container'
import InviteFriendsModal from './invite-friends/modal'

export const newRoutes = {
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default},
}

export const newModalRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  inviteFriendsModal: {
    getScreen: (): typeof InviteFriendsModal => require('./invite-friends/modal').default,
  },
  peopleTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
