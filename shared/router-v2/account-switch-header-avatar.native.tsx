import * as C from '@/constants'
import * as Haptics from 'expo-haptics'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {getMostRecentlyUsedAccount, rememberAccountSwitchTab} from './account-switch'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as React from 'react'
import {Pressable} from 'react-native'

const openAccountSwitcher = () => {
  C.Router2.navigateAppend({name: 'accountSwitcher', params: {}})
}

const AccountSwitchHeaderAvatar = () => {
  const styles = useStyles()
  const username = useCurrentUserState(s => s.username)
  const {configuredAccounts, switchToAccount, userSwitching} = useConfigState(
    C.useShallow(s => ({
      configuredAccounts: s.configuredAccounts,
      switchToAccount: s.dispatch.switchToAccount,
      userSwitching: s.userSwitching,
    }))
  )
  const recentAccount = getMostRecentlyUsedAccount(configuredAccounts, username)
  const handledLongPressRef = React.useRef(false)

  const switchToRecentAccount = () => {
    if (!recentAccount) return
    const tab = C.Router2.getTab()
    if (!switchToAccount(recentAccount.username)) return

    handledLongPressRef.current = true
    C.ignorePromise(Haptics.selectionAsync())
    rememberAccountSwitchTab(username, recentAccount.username, tab)
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
      <Kb.Avatar size={32} username={username} />
    </Pressable>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  container: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
}))

export default AccountSwitchHeaderAvatar
