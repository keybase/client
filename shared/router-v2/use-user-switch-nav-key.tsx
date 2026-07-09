import * as React from 'react'
import {useCurrentUserState} from '@/stores/current-user'

// Remount the navigator when switching between two logged-in users.
// A switch arrives as 'a' → '' → 'b' because the mid-switch setLoggedIn(false)
// resets all stores, so only ever compare against the last non-empty username.
// Ignore '' → username (initial login) so in-flight unbox requests aren't interrupted.
export const useUserSwitchNavKey = () => {
  const username = useCurrentUserState(s => s.username)
  const [navKey, setNavKey] = React.useState('')
  const prevUsernameRef = React.useRef(username)
  React.useEffect(() => {
    if (!username) return
    const prev = prevUsernameRef.current
    prevUsernameRef.current = username
    if (prev && prev !== username) {
      setNavKey(username)
    }
  }, [username])
  return navKey
}
