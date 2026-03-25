import * as React from 'react'
import * as Kb from '@/common-adapters'
import {InfoIcon} from './common'
import {useNavigateToSignupEmail, useSkipSignupEmail} from './navigation'

const EmailSkipButton = () => {
  const onSkip = useSkipSignupEmail()

  return (
    <Kb.Text type="BodyBigLink" onClick={onSkip}>
      Skip
    </Kb.Text>
  )
}

const PhoneSkipButton = () => {
  const onSkip = useNavigateToSignupEmail()

  return (
    <Kb.Text type="BodyBigLink" onClick={onSkip}>
      Skip
    </Kb.Text>
  )
}

export const newRoutes = {
  signupEnterDevicename: {
    getOptions: {title: 'Name this device'},
    screen: React.lazy(async () => import('./device-name')),
  },
  signupEnterUsername: {
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
      title: 'Create account',
    },
    screen: React.lazy(async () => import('./username')),
  },
  signupSendFeedbackLoggedOut: {
    getOptions: {title: 'Send feedback'},
    screen: React.lazy(async () => import('./feedback')),
  },
}

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = {
  signupEnterEmail: {
    getOptions: {headerLeft: () => null, headerRight: () => <EmailSkipButton />, title: 'Your email address'},
    screen: React.lazy(async () => import('./email')),
  },
  signupEnterPhoneNumber: {
    getOptions: {headerLeft: () => null, headerRight: () => <PhoneSkipButton />, title: 'Your phone number'},
    screen: React.lazy(async () => import('./phone-number')),
  },
  signupSendFeedbackLoggedIn: {
    getOptions: {title: 'Send feedback'},
    screen: React.lazy(async () => import('./feedback')),
  },
  signupVerifyPhoneNumber: {
    getOptions: {title: 'Verify phone number'},
    screen: React.lazy(async () => import('./phone-number/verify')),
  },
}
