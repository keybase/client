import * as React from 'react'
import * as C from '@/constants'
import {getRootLoginMode} from './flow'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'

const Loading = React.lazy(async () => import('./loading'))
const Relogin = React.lazy(async () => import('./relogin/container'))
const JoinOrLogin = React.lazy(async () => import('./join-or-login'))

const renderMode = (mode: ReturnType<typeof getRootLoginMode>) => {
  switch (mode) {
    case 'loading':
      return <Loading />
    case 'relogin':
      return <Relogin />
    case 'intro':
      return <JoinOrLogin />
    case 'hidden':
      return null
  }
}

const RootLogin = () => {
  const {configuredAccountsLength, isLoggedIn, userSwitching} = useConfigState(
    C.useShallow(s => ({
      configuredAccountsLength: s.configuredAccounts.length,
      isLoggedIn: s.loggedIn,
      userSwitching: s.userSwitching,
    }))
  )
  const handshakeState = useDaemonState(s => s.handshakeState)
  const mode = getRootLoginMode({
    configuredAccountsLength,
    handshakeState,
    isLoggedIn,
    userSwitching,
  })

  // routing should switch us away so lets not draw anything to speed things up
  if (mode === 'hidden') return null

  return <React.Suspense>{renderMode(mode)}</React.Suspense>
}

export default RootLogin
