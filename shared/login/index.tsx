import * as React from 'react'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'

const Loading = React.lazy(async () => import('./loading/container'))
const Relogin = React.lazy(async () => import('./relogin/container'))
const JoinOrLogin = React.lazy(async () => import('./join-or-login/container'))

const RootLogin = () => {
  const isLoggedIn = Container.useSelector(state => state.config.loggedIn)
  const showLoading = Container.useSelector(
    state => state.config.daemonHandshakeState !== 'done' || state.config.userSwitching
  )
  const showRelogin = ConfigConstants.useConfigState(s => !showLoading && s.configuredAccounts.length > 0)
  // routing should switch us away so lets not draw anything to speed things up
  if (isLoggedIn) return null

  if (showLoading) {
    return (
      <React.Suspense>
        <Loading />
      </React.Suspense>
    )
  }
  if (showRelogin) {
    return (
      <React.Suspense>
        <Relogin />
      </React.Suspense>
    )
  }

  return (
    <React.Suspense>
      <JoinOrLogin />
    </React.Suspense>
  )
}

export default RootLogin
