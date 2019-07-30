import SignupEnterDevicename from './device-name/container'
import SignupEnterEmail from './email/container'
import SignupEnterUsername from './username/container'
import SignupEnterPhoneNumber from './phone-number/container'
import SignupVerifyPhoneNumber from './phone-number/verify-container'
import SignupSendFeedback from './feedback/container'

export const newRoutes = {
  signupEnterDevicename: {
    getScreen: (): typeof SignupEnterDevicename => require('./device-name/container').default,
  },
  signupEnterEmail: {getScreen: (): typeof SignupEnterEmail => require('./email/container').default},
  signupEnterUsername: {getScreen: (): typeof SignupEnterUsername => require('./username/container').default},
  signupSendFeedbackLoggedOut: {
    getScreen: (): typeof SignupSendFeedback => require('./feedback/container').default,
  },
}

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = {
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
