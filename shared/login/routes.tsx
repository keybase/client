import * as React from 'react'
import * as Container from '../util/container'
import Feedback from '../settings/feedback/container'

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

const RootLogin = Container.connect(
  state => {
    const showLoading = state.config.daemonHandshakeState !== 'done'
    const showRelogin = !showLoading && state.config.configuredAccounts.size > 0
    return {showLoading, showRelogin}
  },
  () => ({}),
  (s, d, _: OwnProps) => ({...s, ...d})
)(_RootLogin)

// @ts-ignore
RootLogin.navigationOptions = {
  header: null,
}

export const newRoutes = {
  feedback: {
    getScreen: (): typeof Feedback => require('../settings/feedback/container').default,
    upgraded: true,
  },
  login: {getScreen: () => RootLogin, upgraded: true},
  ...require('../provision/routes').newRoutes,
  ...require('./signup/routes').newRoutes,
}
export const newModalRoutes = {}
