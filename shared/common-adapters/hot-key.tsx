import * as React from 'react'
import * as C from '@/constants'
import {OverlayEntryContext} from './overlay/context'
import {registerHotKeys} from './overlay/controller'
import {NavigationContext} from '@react-navigation/core'

// Desktop-only keyboard shortcuts. On mobile, useHotKey is a no-op. A hot key fires only while the
// modal it is registered in (or the app, outside every modal) has the keys, the newest one first.
export function useHotKey(keys: Array<string> | string, cb: (key: string) => void) {
  // callers pass inline arrays/closures, so derive stable identities for both:
  // otherwise every render unregisters and re-registers, which also re-orders the
  // LIFO stack and lets a re-rendering background screen steal the key
  const keysKey = typeof keys === 'string' ? keys : keys.join(',')
  const keysArr = React.useMemo(() => keysKey.split(',').filter(k => k.length > 0), [keysKey])

  const cbRef = React.useRef(cb)
  React.useEffect(() => {
    cbRef.current = cb
  })
  const [stableCB] = React.useState(() => (key: string) => cbRef.current(key))
  const entry = React.use(OverlayEntryContext)

  // In a screen the keys go with its focus: registering on focus puts it on top of the stack, and a
  // screen covered or left (which stays mounted) gives them up at once. Outside every screen (a
  // portal with no navigation) they last as long as the component.
  const navigation = React.use(NavigationContext)
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (isMobile || keysArr.length === 0) return
      return registerHotKeys(keysArr, stableCB, entry)
    }, [entry, keysArr, stableCB])
  )

  React.useEffect(() => {
    if (isMobile || keysArr.length === 0 || navigation) return
    return registerHotKeys(keysArr, stableCB, entry)
  }, [entry, keysArr, stableCB, navigation])
}
