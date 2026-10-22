import * as C from '@/constants'
import * as Haptics from 'expo-haptics'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {getMostRecentlyUsedAccount, rememberAccountSwitchTab} from './account-switch'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {View} from 'react-native'
import {GestureDetector, useExclusiveGestures, useLongPressGesture, useTapGesture} from 'react-native-gesture-handler'

const openAccountSwitcher = () => {
  C.Router2.navigateAppend({name: 'accountSwitcher', params: {}})
}
const activateAction = [{name: 'activate'}]

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

  const switchToRecentAccount = () => {
    if (!recentAccount || useConfigState.getState().userSwitching) return
    // Before the switch: starting it resets every store synchronously, which would delay the feedback
    C.ignorePromise(Haptics.selectionAsync())
    const tab = C.Router2.getTab()
    if (!switchToAccount(recentAccount.username)) return
    rememberAccountSwitchTab(username, recentAccount.username, tab)
  }

  // Native recognizers rather than Pressable: the switch remounts the navigator, this avatar
  // included, while the finger is still down. A responder-system touch whose view goes away before
  // it ends is never released, and the next touch on the app is swallowed; a native recognizer is
  // cancelled with its view.
  const longPress = useLongPressGesture({
    enabled: !!recentAccount && !userSwitching,
    minDuration: 300,
    onActivate: switchToRecentAccount,
    runOnJS: true,
  })
  // Effectively no time limit: a press the long press doesn't take, however long, still opens the switcher
  const tap = useTapGesture({
    maxDuration: 3_600_000,
    onActivate: openAccountSwitcher,
    runOnJS: true,
  })
  const gesture = useExclusiveGestures(longPress, tap)

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible={true}
        accessibilityHint={recentAccount ? `Long press to switch to ${recentAccount.username}` : undefined}
        accessibilityLabel={`${username} account menu`}
        accessibilityRole="button"
        accessibilityActions={activateAction}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'activate') openAccountSwitcher()
        }}
        style={Kb.Styles.castStyleNative(styles.container)}
        testID={TestIDs.PEOPLE_HEADER_AVATAR}
      >
        <Kb.Avatar size={32} username={username} />
      </View>
    </GestureDetector>
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
