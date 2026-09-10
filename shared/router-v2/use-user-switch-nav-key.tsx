import * as React from 'react'
import {navigationRef} from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'

// Remount the navigator when switching between two logged-in users.
// A switch arrives as 'a' → '' → 'b' because the mid-switch setLoggedIn(false)
// resets all stores, so only ever compare against the last non-empty username.
// Ignore '' → username (initial login) so in-flight unbox requests aren't interrupted.
//
// A remount's onReady marks navigation ready for the new account and ends the switch. A user who
// arrives without a remount gets no onReady, so this hook does both:
// - After a logout or the mid-switch reset, which clear navigation readiness, the mounted navigator
//   now serves the arriving account, so mark it ready. Otherwise every deep link and notification
//   intent stays queued.
// - End a switch that landed on the mounted navigator (e.g. logged out, then a notification tap for
//   that same account), after readiness so the intent it replays can run. Match the switch's target
//   rather than just "no remount": a stale username mid-switch must not end a switch still in flight.
export const useUserSwitchNavKey = () => {
  const username = useCurrentUserState(s => s.username)
  const [navKey, setNavKey] = React.useState('')
  const prevUsernameRef = React.useRef(username)
  const lastSeenUsernameRef = React.useRef(username)
  React.useEffect(() => {
    const cameFromBlank = !lastSeenUsernameRef.current
    lastSeenUsernameRef.current = username
    if (!username) return
    const prev = prevUsernameRef.current
    prevUsernameRef.current = username
    if (prev && prev !== username) {
      setNavKey(username)
      return
    }
    if (cameFromBlank && navigationRef.isReady()) {
      useNavigationIntentsState
        .getState()
        .dispatch.setNavigationReady(true, useCurrentUserState.getState().uid)
    }
    const {dispatch, userSwitching, userSwitchingTo} = useConfigState.getState()
    if (userSwitching && userSwitchingTo === username) {
      dispatch.setUserSwitching(false)
    }
  }, [username])
  return navKey
}
