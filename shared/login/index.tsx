import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import useRequestAutoInvite from '@/signup/use-request-auto-invite'
import {useNavigation} from '@react-navigation/native'
import type {ParamListBase} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

const Loading = React.lazy(async () => import('./loading'))
const Relogin = React.lazy(async () => import('./relogin'))
const JoinOrLogin = React.lazy(async () => import('./join-or-login'))

// This route is a state multiplexer, so "Create account" only exists in relogin mode. A native
// header takes its actions as options rather than children, so push them up with setOptions.
// iOS gets a real UIBarButtonItem (UIKit morphs those across pushes instead of sliding them in
// with the screen); Android has no such API and takes a custom view.
const useCreateAccountHeaderAction = (show: boolean) => {
  const navigation = useNavigation() as unknown as NativeStackNavigationProp<ParamListBase>
  const requestAutoInvite = useRequestAutoInvite()
  const requestRef = React.useRef(requestAutoInvite)
  React.useEffect(() => {
    requestRef.current = requestAutoInvite
  })
  React.useEffect(() => {
    if (!isMobile) return
    const onPress = () => requestRef.current('')
    navigation.setOptions(
      isIOS
        ? {
            unstable_headerRightItems: show
              ? () => [Kb.nativeTextHeaderItem('Create account', onPress)]
              : () => [],
          }
        : {
            headerRight: show
              ? () => (
                  <Kb.Text type="BodyBigLink" style={createAccountStyle} onClick={onPress}>
                    Create account
                  </Kb.Text>
                )
              : undefined,
          }
    )
  }, [navigation, show])
}

const createAccountStyle = {paddingRight: Kb.Styles.globalMargins.small} as const

const RootLogin = () => {
  const isLoggedIn = useConfigState(s => s.loggedIn)
  const userSwitching = useConfigState(s => s.userSwitching)
  const showLoading = useDaemonState(s => s.handshakeState !== 'done' || userSwitching)
  const showRelogin = useConfigState(s => !showLoading && s.configuredAccounts.length > 0)
  useCreateAccountHeaderAction(!isLoggedIn && showRelogin)
  // routing should switch us away so lets not draw anything to speed things up
  if (isLoggedIn) return null

  const Screen = showLoading ? Loading : showRelogin ? Relogin : JoinOrLogin
  return (
    <React.Suspense>
      <Screen />
    </React.Suspense>
  )
}

export default RootLogin
