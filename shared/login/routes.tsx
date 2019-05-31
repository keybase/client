import * as React from 'react'
import {connect, RouteProps} from '../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  const showLoading = state.config.daemonHandshakeState !== 'done'
  const showRelogin = !showLoading && state.config.configuredAccounts.size > 0
  return {showLoading, showRelogin}
}

const _RootLogin = ({showLoading, showRelogin, navigateAppend}) => {
  const JoinOrLogin = require('./join-or-login/container').default
  const Loading = require('./loading/container').default
  const Relogin = require('./relogin/container').default
  if (showLoading) {
    return <Loading navigateAppend={navigateAppend} />
  }
  if (showRelogin) {
    return <Relogin navigateAppend={navigateAppend} />
  }
  return <JoinOrLogin navigateAppend={navigateAppend} />
}

const RootLogin = connect(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(_RootLogin)

// @ts-ignore
RootLogin.navigationOptions = {
  header: null,
}

export const newRoutes = {
  feedback: {getScreen: () => require('../settings/feedback/container').default},
  login: {getScreen: () => RootLogin},
  ...require('../provision/routes').newRoutes,
  ...require('./signup/routes').newRoutes,
}
export const newModalRoutes = {}
