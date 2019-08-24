import * as React from 'react'
import * as Container from '../util/container'
import Feedback from '../settings/feedback/container'
import {ProxySettingsPopup} from '../settings/proxy'

type OwnProps = {}
type Props = {
  showLoading: boolean
  showRelogin: boolean
}

const _RootLogin = ({showLoading, showRelogin}: Props) => {
  const JoinOrLogin = require('./join-or-login/container').default
  const Loading = require('./loading/container').default
  const Relogin = require('./relogin/container').default
  if (showLoading) {
    return <Loading />
  }
  if (showRelogin) {
    return <Relogin />
  }
  return <JoinOrLogin />
}

_RootLogin.navigationOptions = {
  header: null,
}

const RootLogin = Container.connect(
  state => {
    const showLoading = state.config.daemonHandshakeState !== 'done'
    const showRelogin = !showLoading && state.config.configuredAccounts.size > 0
    return {showLoading, showRelogin}
  },
  () => ({}),
  (s, d, _: OwnProps) => ({...s, ...d})
)(_RootLogin)

export const newRoutes = {
  feedback: {getScreen: (): typeof Feedback => require('../settings/feedback/container').default},
  login: {getScreen: () => RootLogin},
  ...require('../provision/routes').newRoutes,
  ...require('./signup/routes').newRoutes,
}
export const newModalRoutes = {
  proxySettingsModal: {
    getScreen: (): typeof ProxySettingsPopup => require('../settings/proxy/container').default,
  },
}
