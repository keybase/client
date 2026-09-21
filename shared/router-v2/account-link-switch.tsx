import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useNavigationIntentsState} from '@/stores/navigation-intents'

type ConfigState = ReturnType<typeof useConfigState.getState>

// Every intent carrying a targetUid, which is every tap and only a tap.
const pendingTap = () => {
  const {intent} = useNavigationIntentsState.getState()
  return intent?.targetUid ? intent : undefined
}

const tapForOtherAccount = () => {
  const intent = pendingTap()
  return intent && intent.targetUid !== useCurrentUserState.getState().uid ? intent : undefined
}

// A tapped push for another account waits in the intent store until that account is current. This
// switches to it: to a stored account once, never to one without a stored secret, and it drops the
// tap when the switch fails or the user logs out. Only enqueuePushTapRoute sets targetUid, and only
// a route the service resolved from a real notification tap reaches it, so no link another app
// opens can switch accounts.
//
// Both drops below go through dispatch.acknowledge, which also acks the tap's route with the
// service -- there is no navigation coming for it, so this is where it is given up on for good.
export const subscribeIntentAccountSwitch = () => {
  // userSwitching already gates a second login, but it is cleared by the replacement router's
  // onReady, which can run before the new uid lands; keying on the intent makes the switch
  // exactly-once without depending on that ordering.
  let switchingFor: number | undefined
  const check = () => {
    const intent = tapForOtherAccount()
    if (!intent || switchingFor === intent.id) return
    const {configuredAccounts, dispatch, userSwitching} = useConfigState.getState()
    if (userSwitching || useDaemonState.getState().handshakeState !== 'done') return
    const account = configuredAccounts.find(a => a.uid === intent.targetUid)
    if (!account) return
    if (!account.hasStoredSecret) {
      logger.info('[AccountLink] target account has no stored secret, dropping the tap')
      useNavigationIntentsState.getState().dispatch.acknowledge(intent.id)
      return
    }
    switchingFor = intent.id
    logger.info('[AccountLink] switching accounts for a tapped push')
    dispatch.setUserSwitching(true)
    dispatch.login(account.username, '')
  }
  const dropOnFailure = (s: ConfigState, old: ConfigState) => {
    const loginFailed = !!s.loginError && s.loginError !== old.loginError
    const loggedOut = s.loggedIn !== old.loggedIn && !s.loggedIn && !s.userSwitching
    if (!loginFailed && !loggedOut) return
    // Account-blind, unlike the switch above: a tap for the account being logged out of is not
    // "for another account" while the uid is still set, but it is read as one the moment the
    // teardown clears the uid, and check() would then log the user straight back in.
    const intent = pendingTap()
    if (!intent) return
    logger.info('[AccountLink] dropping a tap after a failed switch or logout')
    useNavigationIntentsState.getState().dispatch.acknowledge(intent.id)
  }
  const unsubs = [
    useNavigationIntentsState.subscribe(check),
    useConfigState.subscribe((s, old) => {
      dropOnFailure(s, old)
      check()
    }),
    useCurrentUserState.subscribe(check),
    useDaemonState.subscribe(check),
  ]
  check()
  return () => {
    for (const unsub of unsubs) unsub()
  }
}
