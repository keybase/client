import InviteFromContacts from './invite-friends/invite-contacts.native'
import AccountSwitcher from '../router-v2/account-switcher/container'
import {newRoutes as sharedNewRoutes, newModalRoutes as sharedNewModalRoutes} from './routes.shared'

export const newModalRoutes = {
  accountSwitcher: {
    getScreen: (): typeof AccountSwitcher => require('../router-v2/account-switcher/container').default,
  },
  inviteFriendsContacts: {
    getScreen: (): typeof InviteFromContacts => require('./invite-friends/invite-contacts.native').default,
  },
  ...sharedNewModalRoutes,
}
export const newRoutes = sharedNewRoutes
