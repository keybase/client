import PeopleRoot from './container'
import TeamBuilder from '../team-building/container'
import InviteFriendsModal from './invite-friends/modal'
import InviteFromContacts from './invite-friends/invite-contacts'
import AccountSwitcher from '../router-v2/account-switcher/container'

export const newRoutes = {
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default},
}

export const newModalRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  inviteFriendsContacts: {
    getScreen: (): typeof InviteFromContacts => require('./invite-friends/invite-contacts').default,
  },
  inviteFriendsModal: {
    getScreen: (): typeof InviteFriendsModal => require('./invite-friends/modal').default,
  },
  peopleTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
