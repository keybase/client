import type * as Container from '../util/container'
import feedback from './feedback.page'
import signupEnterDevicename from './device-name.page'
import signupEnterUsername from './username.page'
import signupEnterEmail from './email/page'
import signupEnterPhoneNumber from './phone-number/page'
import signupVerifyPhoneNumber from './phone-number/verify.page'

export const newRoutes = {
  signupEnterDevicename,
  signupEnterUsername,
  signupSendFeedbackLoggedOut: feedback,
}

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = {
  signupEnterEmail,
  signupEnterPhoneNumber,
  signupSendFeedbackLoggedIn: feedback,
  signupVerifyPhoneNumber,
}

export type RootParamListSignup = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
