import * as React from 'react'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'

const Loading = React.lazy(async () => import('./loading'))
const Relogin = React.lazy(async () => import('./relogin/container'))
const JoinOrLogin = React.lazy(async () => import('./join-or-login'))

const RootLogin = () => {
  const isLoggedIn = useConfigState(s => s.loggedIn)
  const userSwitching = useConfigState(s => s.userSwitching)
  const showLoading = useDaemonState(s => s.handshakeState !== 'done' || userSwitching)
  const showRelogin = useConfigState(s => !showLoading && s.configuredAccounts.length > 0)
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
