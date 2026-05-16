// this is loaded up by login/routes and device/routes
import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import useRequestAutoInvite from '@/signup/use-request-auto-invite'
import {useProvisionState} from '@/stores/provision'
import {useCurrentUserState} from '@/stores/current-user'

const CodePageHeaderLeft = () => {
  const currentDeviceAlreadyProvisioned = useCurrentUserState(s => !!s.deviceName)
  const navigateUp = C.Router2.navigateUp
  if (!Kb.Styles.isMobile) return null
  return (
    <Kb.Text type="BodyBig" onClick={navigateUp}>
      {currentDeviceAlreadyProvisioned ? 'Back' : 'Cancel'}
    </Kb.Text>
  )
}

const UsernameHeaderRight = () => {
  const username = useProvisionState(s => s.username)
  const requestAutoInvite = useRequestAutoInvite()
  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.headerRight}>
      <Kb.Text type="BodyBigLink" onClick={() => requestAutoInvite(username)}>
        Create account
      </Kb.Text>
    </Kb.Box2>
  )
}

export const newRoutes = {
  codePage: C.makeScreen(React.lazy(async () => import('@/provision/code-page/container')), {
    getOptions: {
      headerLeft: () => <CodePageHeaderLeft />,
      title: '',
    },
  }),
  error: {getOptions: {title: 'Error'}, screen: React.lazy(async () => import('@/provision/error'))},
  forgotUsername: {
    getOptions: {title: 'Recover username'},
    screen: React.lazy(async () => import('@/provision/forgot-username')),
  },
  // gpgSign,
  paperkey: {
    getOptions: {title: 'Enter paper key'},
    screen: React.lazy(async () => import('@/provision/paper-key')),
  },
  password: {
    getOptions: {title: 'Enter password'},
    screen: React.lazy(async () => import('@/provision/password')),
  },
  selectOtherDevice: {
    getOptions: {title: 'Authorize this device'},
    screen: React.lazy(async () => import('@/provision/select-other-device-connected')),
  },
  setPublicName: {
    getOptions: {title: 'Name this device'},
    screen: React.lazy(async () => import('@/provision/set-public-name')),
  },
  username: C.makeScreen(React.lazy(async () => import('@/provision/username-or-email')), {
    getOptions: {
      ...(!Kb.Styles.isMobile ? {headerRight: () => <UsernameHeaderRight />} : {}),
      title: 'Log in',
    },
  }),
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerRight: Kb.Styles.platformStyles({
    isElectron: {paddingRight: Kb.Styles.globalMargins.small},
  }),
}))
