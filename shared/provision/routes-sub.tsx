// this is loaded up by login/routes and device/routes
import * as React from 'react'
import * as C from '@/constants'

export const newRoutes = {
  codePage: {
    screen: React.lazy(async () => import('./code-page/container')),
  },
  error: {
    getOptions: {modal2: true},
    screen: React.lazy(async () => import('./error')),
  },
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
  selectOtherDevice: {screen: React.lazy(async () => import('./select-other-device'))},
  setPublicName: {screen: React.lazy(async () => import('./set-public-name'))},
  username: C.makeScreen(React.lazy(async () => import('./username-or-email/container'))),
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.
