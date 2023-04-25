import type InviteCode from './invite-code/container'
import type RequestInvite from './request-invite/container'
import type RequestInviteSuccess from './request-invite-success/container'
import type SignupError from './error'

export const newRoutes = {
  signupError: {
    getOptions: () => require('./error/container').options,
    getScreen: (): typeof SignupError => require('./error/container').default,
  },
  signupInviteCode: {getScreen: (): typeof InviteCode => require('./invite-code/container').default},
  signupRequestInvite: {getScreen: (): typeof RequestInvite => require('./request-invite/container').default},
  signupRequestInviteSuccess: {
    getScreen: (): typeof RequestInviteSuccess => require('./request-invite-success/container').default,
  },
}
