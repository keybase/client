import * as C from '@/constants'
import * as React from 'react'
import {useColorScheme} from 'react-native'
import {useCurrentUserState} from '@/stores/current-user'

// Rerender everything on user switch, and on Android also on dark mode changes.
// Only switch on transitions between two non-empty usernames — not on initial login.
export const useRootKey = () => {
  const isDarkMode = useColorScheme() === 'dark'
  const username = useCurrentUserState(s => s.username)
  const [navKey, setNavKey] = React.useState('')
  const prevUsernameRef = React.useRef(username)
  React.useEffect(() => {
    const prev = prevUsernameRef.current
    prevUsernameRef.current = username
    if (prev && username && prev !== username) {
      setNavKey(username)
    }
  }, [username])
  const darkSuffix = C.isAndroid ? (isDarkMode ? '-dark' : '-light') : ''
  return navKey ? `${navKey}${darkSuffix}` : ''
}
