import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {InfoIcon} from './common'
import {usePushState} from '@/stores/push'
import {setSignupEmail} from '@/people/signup-email'
import {defineRouteMap} from '@/constants/types/router'

const EmailSkipButton = () => {
  const showPushPrompt = usePushState(s => C.isMobile && !s.hasPermissions && s.showPushPrompt)
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => {
        setSignupEmail(C.noEmail)
        showPushPrompt ? navigateAppend({name: 'settingsPushPrompt', params: {}}, true) : clearModals()
      }}
    >
      Skip
    </Kb.Text>
  )
}

const PhoneSkipButton = () => {
  const navigateAppend = C.Router2.navigateAppend
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => {
        navigateAppend({name: 'signupEnterEmail', params: {}}, true)
      }}
    >
      Skip
    </Kb.Text>
  )
}

export const newRoutes = defineRouteMap({
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
})

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = defineRouteMap({
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
})
