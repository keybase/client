import * as React from 'react'
import * as Container from '../util/container'
import Feedback from '../settings/feedback/container'
import {ProxySettingsPopup} from '../settings/proxy'
import {KnowPassword, EnterPassword} from './reset/password'
import Waiting from './reset/waiting'
import Confirm from './reset/confirm'

type OwnProps = {}
type Props = {
  isLoggedIn: boolean
  showLoading: boolean
  showRelogin: boolean
}

const _RootLogin = (p: Props) => {
  // routing should switch us away so lets not draw anything to speed things up
  if (p.isLoggedIn) return null
  if (p.showLoading) {
    const Loading = require('./loading/container').default
    return <Loading />
  }
  if (p.showRelogin) {
    const Relogin = require('./relogin/container').default
    return <Relogin />
  }

  const JoinOrLogin = require('./join-or-login/container').default
  return <JoinOrLogin />
}

_RootLogin.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

const RootLogin = Container.connect(
  state => {
    const isLoggedIn = state.config.loggedIn
    const showLoading = state.config.daemonHandshakeState !== 'done' || state.config.userSwitching
    const showRelogin = !showLoading && state.config.configuredAccounts.length > 0
    return {isLoggedIn, showLoading, showRelogin}
  },
  () => ({}),
  (s, d, _: OwnProps) => ({...s, ...d})
)(_RootLogin)

export const newRoutes = {
  feedback: {getScreen: (): typeof Feedback => require('../signup/feedback/container').default},
  login: {getScreen: () => RootLogin},
  resetConfirm: {getScreen: (): typeof Confirm => require('./reset/confirm').default},
  resetEnterPassword: {getScreen: (): typeof EnterPassword => require('./reset/password').EnterPassword},
  resetKnowPassword: {getScreen: (): typeof KnowPassword => require('./reset/password').KnowPassword},
  resetWaiting: {getScreen: (): typeof Waiting => require('./reset/waiting').default},
  ...require('../provision/routes').newRoutes,
  ...require('./recover-password/routes').newRoutes,
  ...require('./signup/routes').newRoutes,
}
export const newModalRoutes = {
  proxySettingsModal: {
    getScreen: (): typeof ProxySettingsPopup => require('../settings/proxy/container').default,
  },
  ...require('./recover-password/routes').newModalRoutes,
}
