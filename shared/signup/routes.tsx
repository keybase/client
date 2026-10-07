import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {InfoIcon} from './common'
import {usePushState} from '@/stores/push'
import {setSignupEmail} from '@/people/signup-email'
import {defineRouteMap} from '@/constants/types/router'
import {clearSignupDeviceNameDraft} from './device-name-draft'
import {e164ToDisplay} from '@/util/phone-numbers'

// Backing out of the username screen also clears any device-name draft, so the next signup starts clean.
const UsernameHeaderLeft = () => (
  <Kb.HeaderLeftButton
    autoDetectCanGoBack={true}
    onPress={() => {
      clearSignupDeviceNameDraft()
      C.Router2.navigateUp()
    }}
  />
)

const onEmailSkip = () => {
  setSignupEmail(C.noEmail)
  const {hasPermissions, showPushPrompt} = usePushState.getState()
  if (isMobile && !hasPermissions && showPushPrompt) {
    C.Router2.navigateAppend({name: 'settingsPushPrompt', params: {}}, true)
  } else {
    C.Router2.clearModals()
  }
}

const onPhoneSkip = () => {
  C.Router2.navigateAppend({name: 'signupEnterEmail', params: {}}, true)
}

// Desktop keeps the help menu (feedback, documentation) beside Skip.
const SkipButton = ({onSkip}: {onSkip: () => void}) => (
  <Kb.Box2 direction="horizontal" alignItems="center" gap="small">
    {isMobile ? null : <InfoIcon />}
    <Kb.Text type="BodyBigLink" onClick={onSkip}>
      Skip
    </Kb.Text>
  </Kb.Box2>
)

export const newRoutes = defineRouteMap({
  signupEnterDevicename: {
    getOptions: {title: isMobile ? 'Name this device' : 'Name this computer'},
    screen: React.lazy(async () => import('./device-name')),
  },
  signupEnterUsername: {
    getOptions: {
      ...(isMobile ? {headerLeft: undefined} : {headerLeft: () => <UsernameHeaderLeft />}),
      headerRightActions: () => (
        <Kb.Box2 alignSelf="center"
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
    getOptions: {
      ...(isIOS
        ? {
            unstable_headerLeftItems: () => [],
            unstable_headerRightItems: () => [Kb.nativeTextHeaderItem('Skip', onEmailSkip)],
          }
        : {headerLeft: () => null, headerRight: () => <SkipButton onSkip={onEmailSkip} />}),
      title: 'Your email address',
    },
    screen: React.lazy(async () => import('./email')),
  },
  signupEnterPhoneNumber: {
    getOptions: {
      ...(isIOS
        ? {
            unstable_headerLeftItems: () => [],
            unstable_headerRightItems: () => [Kb.nativeTextHeaderItem('Skip', onPhoneSkip)],
          }
        : {headerLeft: () => null, headerRight: () => <SkipButton onSkip={onPhoneSkip} />}),
      title: 'Your phone number',
    },
    screen: React.lazy(async () => import('./phone-number')),
  },
  signupSendFeedbackLoggedIn: {
    getOptions: {
      ...(isMobile ? {} : {headerLeft: Kb.HeaderLeftButton}),
      title: 'Send feedback',
    },
    screen: React.lazy(async () => import('./feedback')),
  },
  signupVerifyPhoneNumber: {
    getOptions: ({route}: {route: {params: {phoneNumber: string}}}) => ({
      ...(isMobile ? {} : {headerLeft: Kb.HeaderLeftButton}),
      headerTitle: () => (
        <Kb.ModalHeaderTitle title="Verify phone number" subtitle={e164ToDisplay(route.params.phoneNumber)} />
      ),
      title: 'Verify phone number',
    }),
    screen: React.lazy(async () => import('./phone-number/verify')),
  },
})
