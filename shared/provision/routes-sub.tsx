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

export const newRoutes = {
  codePage: C.makeScreen(React.lazy(async () => import('./code-page/container')), {
    getOptions: {
      headerLeft: () => <CodePageHeaderLeft />,
    },
  }),
  error: {screen: React.lazy(async () => import('./error'))},
  forgotUsername: {
    screen: React.lazy(async () => import('./forgot-username')),
  },
  // gpgSign,
  paperkey: {
    screen: React.lazy(async () => import('./paper-key')),
  },
  password: {
    screen: React.lazy(async () => import('./password')),
  },
  selectOtherDevice: {screen: React.lazy(async () => import('./select-other-device-connected'))},
  setPublicName: {screen: React.lazy(async () => import('./set-public-name'))},
  username: C.makeScreen(React.lazy(async () => import('./username-or-email'))),
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.
