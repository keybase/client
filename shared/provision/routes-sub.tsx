// this is loaded up by login/routes and device/routes
import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useCurrentUserState} from '@/stores/current-user'

const CodePageHeaderLeft = () => {
  const currentDeviceAlreadyProvisioned = useCurrentUserState(s => !!s.deviceName)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  if (!Kb.Styles.isMobile) return null
  return (
    <Kb.Text type="BodyBig" onClick={navigateUp}>
      {currentDeviceAlreadyProvisioned ? 'Back' : 'Cancel'}
    </Kb.Text>
  )
}

const provisionRouteOptions = <T extends Record<string, unknown>>(options: T) => ({
  ...options,
  ...(Kb.Styles.isElectron ? {headerShown: false} : {}),
})

export const newRoutes = {
  codePage: C.makeScreen(React.lazy(async () => import('./code-page/container')), {
    getOptions: provisionRouteOptions({
      headerLeft: () => <CodePageHeaderLeft />,
      title: '',
    }),
  }),
  error: {getOptions: provisionRouteOptions({title: 'Error'}), screen: React.lazy(async () => import('./error'))},
  forgotUsername: {
    getOptions: provisionRouteOptions({title: 'Recover username'}),
    screen: React.lazy(async () => import('./forgot-username')),
  },
  // gpgSign,
  paperkey: {
    getOptions: provisionRouteOptions({title: 'Enter paper key'}),
    screen: React.lazy(async () => import('./paper-key')),
  },
  password: {
    getOptions: provisionRouteOptions({title: 'Enter password'}),
    screen: React.lazy(async () => import('./password')),
  },
  selectOtherDevice: {
    getOptions: provisionRouteOptions({title: 'Authorize this device'}),
    screen: React.lazy(async () => import('./select-other-device-connected')),
  },
  setPublicName: {
    getOptions: provisionRouteOptions({title: 'Name this device'}),
    screen: React.lazy(async () => import('./set-public-name')),
  },
  username: C.makeScreen(React.lazy(async () => import('./username-or-email')), {
    getOptions: provisionRouteOptions({title: 'Log in'}),
  }),
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.
