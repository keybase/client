import PeopleRoot from './container'
import TeamBuilder from '../team-building/container'
import InviteFriendsModal from './invite-friends/modal'

export const newRoutes = {
  peopleRoot: {getScreen: (): typeof PeopleRoot => require('./container').default},
}

export const newModalRoutes = {
  inviteFriendsModal: {
    getScreen: (): typeof InviteFriendsModal => require('./invite-friends/modal').default,
  },
  peopleTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
