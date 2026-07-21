import * as C from '@/constants'
import * as Haptics from 'expo-haptics'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {getMostRecentlyUsedAccount, rememberAccountSwitchTab} from './account-switch'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {Pressable} from 'react-native'

const openAccountSwitcher = () => {
  C.Router2.navigateAppend({name: 'accountSwitcher', params: {}})
}

const AccountSwitchHeaderAvatar = () => {
  const username = useCurrentUserState(s => s.username)
  const {configuredAccounts, login, setUserSwitching, userSwitching} = useConfigState(
    C.useShallow(s => ({
      configuredAccounts: s.configuredAccounts,
      login: s.dispatch.login,
      setUserSwitching: s.dispatch.setUserSwitching,
      userSwitching: s.userSwitching,
    }))
  )
  const recentAccount = getMostRecentlyUsedAccount(configuredAccounts, username)

  const switchToRecentAccount = () => {
    if (userSwitching || !recentAccount) return

    C.ignorePromise(Haptics.selectionAsync())
    rememberAccountSwitchTab(username, recentAccount.username, C.Router2.getTab())
    setUserSwitching(true)
    login(recentAccount.username, '')
  }

  return (
    <Pressable
      accessibilityHint={
        recentAccount ? `Long press to switch to ${recentAccount.username}` : undefined
      }
      accessibilityLabel={`${username} account menu`}
      accessibilityRole="button"
      onLongPress={recentAccount && !userSwitching ? switchToRecentAccount : undefined}
      onPress={openAccountSwitcher}
      style={Kb.Styles.castStyleNative(styles.container)}
      testID={TestIDs.PEOPLE_HEADER_AVATAR}
    >
      <Kb.Avatar size={32} username={username} />
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
