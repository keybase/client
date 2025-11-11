import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'
import {InfoIcon} from './common'

const Feedback = React.lazy(async () => import('./feedback'))
const feedback = {
  screen: Feedback,
}

const DeviceName = React.lazy(async () => import('./device-name'))
const signupEnterDevicename = {
  screen: DeviceName,
}

const Username = React.lazy(async () => import('./username'))
const signupEnterUsername = {
  getOptions: {
    headerBottomStyle: {height: undefined},
    headerLeft: undefined, // no back button
    headerRightActions: () => (
      <Kb.Box2
        direction="horizontal"
        style={Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0)}
      >
        <InfoIcon />
      </Kb.Box2>
    ),
  },
  screen: Username,
}

const Email = React.lazy(async () => import('./email/container'))
const signupEnterEmail = {
  screen: Email,
}

const PhoneNumber = React.lazy(async () => import('./phone-number/container'))
const signupEnterPhoneNumber = {
  screen: PhoneNumber,
}

const VerifyPhoneNumber = React.lazy(async () => import('./phone-number/verify-container'))
const signupVerifyPhoneNumber = {
  screen: VerifyPhoneNumber,
}

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

export type RootParamListSignup = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
