import * as C from '@/constants'
import * as Haptics from 'expo-haptics'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {getMostRecentlyUsedAccount, rememberAccountSwitchTab} from './account-switch'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as React from 'react'
import {Pressable} from 'react-native'
import logger from '@/logger'

const openAccountSwitcher = () => {
  C.Router2.navigateAppend({name: 'accountSwitcher', params: {}})
}

const AccountSwitchHeaderAvatar = () => {
  const username = useCurrentUserState(s => s.username)
  const {configuredAccounts, httpSrvReady, login, setUserSwitching, userSwitching} = useConfigState(
    C.useShallow(s => ({
      configuredAccounts: s.configuredAccounts,
      httpSrvReady: !!s.httpSrv.address,
      login: s.dispatch.login,
      setUserSwitching: s.dispatch.setUserSwitching,
      userSwitching: s.userSwitching,
    }))
  )
  const recentAccount = getMostRecentlyUsedAccount(configuredAccounts, username)
  const handledLongPressRef = React.useRef(false)

  React.useEffect(() => {
    logger.info('[AccountSwitcherHeader] mounted')
    return () => {
      logger.info('[AccountSwitcherHeader] unmounted')
    }
  }, [])

  React.useEffect(() => {
    logger.info(
      `[AccountSwitcherHeader] state tab=${C.Router2.getTab() ?? 'none'} username=${username || 'none'} http=${httpSrvReady ? 'ready' : 'missing'} accounts=${configuredAccounts.length} recent=${recentAccount?.username ?? 'none'}`
    )
  }, [configuredAccounts.length, httpSrvReady, recentAccount?.username, username])

  const switchToRecentAccount = () => {
    if (userSwitching || !recentAccount) return

    handledLongPressRef.current = true
    C.ignorePromise(Haptics.selectionAsync())
    rememberAccountSwitchTab(username, recentAccount.username, C.Router2.getTab())
    setUserSwitching(true)
    login(recentAccount.username, '')
  }

  const onPressIn = () => {
    handledLongPressRef.current = false
  }

  const onPress = () => {
    if (handledLongPressRef.current) {
      handledLongPressRef.current = false
      return
    }
    openAccountSwitcher()
  }

  const onAvatarError = () => {
    logger.warn(
      `[AccountSwitcherHeader] avatar error username=${username || 'none'} http=${httpSrvReady ? 'ready' : 'missing'}`
    )
  }

  const onAvatarLoad = () => {
    logger.info(`[AccountSwitcherHeader] avatar loaded username=${username || 'none'}`)
  }

  return (
    <Pressable
      accessibilityHint={
        recentAccount ? `Long press to switch to ${recentAccount.username}` : undefined
      }
      accessibilityLabel={`${username} account menu`}
      accessibilityRole="button"
      onLongPress={recentAccount && !userSwitching ? switchToRecentAccount : undefined}
      onPress={onPress}
      onPressIn={onPressIn}
      style={Kb.Styles.castStyleNative(styles.container)}
      testID={TestIDs.PEOPLE_HEADER_AVATAR}
    >
      <Kb.Avatar size={32} username={username} onError={onAvatarError} onLoad={onAvatarLoad} />
    </Pressable>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
}))

export default AccountSwitchHeaderAvatar
