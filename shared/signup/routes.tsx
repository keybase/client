import type SignupEnterDevicename from './device-name'
import type SignupEnterEmail from './email/container'
import type SignupEnterUsername from './username'
import type SignupEnterPhoneNumber from './phone-number/container'
import type SignupVerifyPhoneNumber from './phone-number/verify-container'
import type SignupSendFeedback from './feedback'

export const newRoutes = {
  signupEnterDevicename: {
    getOptions: () => require('./device-name').options,
    getScreen: (): typeof SignupEnterDevicename => require('./device-name').default,
  },
  signupEnterUsername: {
    getOptions: () => require('./username').options,
    getScreen: (): typeof SignupEnterUsername => require('./username').default,
  },
  signupSendFeedbackLoggedOut: {
    getOptions: () => require('./feedback').options,
    getScreen: (): typeof SignupSendFeedback => require('./feedback').default,
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
    getOptions: () => require('./feedback').options,
    getScreen: (): typeof SignupSendFeedback => require('./feedback').default,
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
