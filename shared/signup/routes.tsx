import type SignupEnterDevicename from './device-name/container'
import type SignupEnterEmail from './email/container'
import type SignupEnterUsername from './username/container'
import type SignupEnterPhoneNumber from './phone-number/container'
import type SignupVerifyPhoneNumber from './phone-number/verify-container'
import type SignupSendFeedback from './feedback/container'

export const newRoutes = {
  signupEnterDevicename: {
    getScreen: (): typeof SignupEnterDevicename => require('./device-name/container').default,
  },
  signupEnterUsername: {getScreen: (): typeof SignupEnterUsername => require('./username/container').default},
  signupSendFeedbackLoggedOut: {
    getScreen: (): typeof SignupSendFeedback => require('./feedback/container').default,
  },
}

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = {
  signupEnterEmail: {
    getScreen: (): typeof SignupEnterEmail => require('./email/container').default,
  },
  signupEnterPhoneNumber: {
    getScreen: (): typeof SignupEnterPhoneNumber => require('./phone-number/container').default,
  },
  signupSendFeedbackLoggedIn: {
    getScreen: (): typeof SignupSendFeedback => require('./feedback/container').default,
  },
  signupVerifyPhoneNumber: {
    getScreen: (): typeof SignupVerifyPhoneNumber => require('./phone-number/verify-container').default,
  },
}

export type RootParamListSignup = {
  signupEnterDevicename: undefined
  signupEnterEmail: undefined
  signupEnterPhoneNumber: undefined
  signupEnterUsername: undefined
  signupSendFeedbackLoggedIn: undefined
  signupSendFeedbackLoggedOut: undefined
  signupVerifyPhoneNumber: undefined
  signupError: undefined
  signupInviteCode: undefined
  signupRequestInvite: undefined
  signupRequestInviteSuccess: undefined
}
