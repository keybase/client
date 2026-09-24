import * as React from 'react'
import {useConfigState} from '@/stores/config'
import {showLoggedInScreens} from './account-switch'

// How long the logged-in screens stay up after the session says logged out. An account switch on
// desktop passes through a logged-out session for tens of milliseconds (its engine reset cancels
// the login, which ends the switch before the new account's loggedIn arrives), and showing the
// logged-out screens for that long is a visible flash. Only the UI waits: the logout itself, and
// the store reset that clears the old account's data, happen immediately.
export const loggedOutScreensDelayMs = 500

// Whether the root navigator shows the logged-in screens: showLoggedInScreens, but a change to
// false only lands once it has held for loggedOutScreensDelayMs.
export const useShowLoggedInScreensHeld = () => {
  const show = useConfigState(showLoggedInScreens)
  const [held, setHeld] = React.useState(show)
  if (show && !held) {
    setHeld(true)
  }
  React.useEffect(() => {
    if (show) return
    const id = setTimeout(() => setHeld(false), loggedOutScreensDelayMs)
    return () => clearTimeout(id)
  }, [show])
  return show || held
}

// The router computes the held value once, above the navigator, so the logged-in and logged-out
// groups never disagree.
export const LoggedInScreensContext = React.createContext(false)
export const useLoggedInScreens = () => React.useContext(LoggedInScreensContext)
