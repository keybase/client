import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'
import {InfoIcon} from './common'

export const newRoutes = {
  signupEnterDevicename: C.makeScreen(React.lazy(async () => import('./device-name'))),
  signupEnterUsername: C.makeScreen(React.lazy(async () => import('./username')), {
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
  }),
  signupSendFeedbackLoggedOut: C.makeScreen(React.lazy(async () => import('./feedback'))),
}

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = {
  signupEnterEmail: C.makeScreen(React.lazy(async () => import('./email/container'))),
  signupEnterPhoneNumber: C.makeScreen(React.lazy(async () => import('./phone-number/container'))),
  signupSendFeedbackLoggedIn: C.makeScreen(React.lazy(async () => import('./feedback'))),
  signupVerifyPhoneNumber: C.makeScreen(React.lazy(async () => import('./phone-number/verify-container'))),
}

export type RootParamListSignup = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
