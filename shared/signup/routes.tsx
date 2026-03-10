import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {InfoIcon} from './common'
import {useSignupState} from '@/stores/signup'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {usePushState} from '@/stores/push'

const EmailSkipButton = () => {
  const showPushPrompt = usePushState(s => C.isMobile && !s.hasPermissions && s.showPushPrompt)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const setJustSignedUpEmail = useSignupState(s => s.dispatch.setJustSignedUpEmail)
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => {
        setJustSignedUpEmail(C.noEmail)
        showPushPrompt ? navigateAppend('settingsPushPrompt', true) : clearModals()
      }}
    >
      Skip
    </Kb.Text>
  )
}

const PhoneSkipButton = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const clearPhoneNumberAdd = useSettingsPhoneState(s => s.dispatch.clearPhoneNumberAdd)
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => {
        clearPhoneNumberAdd()
        navigateAppend('signupEnterEmail', true)
      }}
    >
      Skip
    </Kb.Text>
  )
}

export const newRoutes = {
  signupEnterDevicename: {screen: React.lazy(async () => import('./device-name'))},
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
    },
    screen: React.lazy(async () => import('./username')),
  },
  signupSendFeedbackLoggedOut: {screen: React.lazy(async () => import('./feedback'))},
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
  signupVerifyPhoneNumber: {screen: React.lazy(async () => import('./phone-number/verify'))},
}
