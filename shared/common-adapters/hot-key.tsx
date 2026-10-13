import * as React from 'react'
import * as C from '@/constants'
import {OverlayEntryContext} from './overlay/context'
import {registerHotKeys} from './overlay/controller'

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

  // registering again on focus re-pushes us to the top of the stack so the
  // focused screen wins the key over screens that merely stayed mounted
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (isMobile || keysArr.length === 0) return
      return registerHotKeys(keysArr, stableCB, entry)
    }, [entry, keysArr, stableCB])
  )

  React.useEffect(() => {
    if (isMobile || keysArr.length === 0) return
    return registerHotKeys(keysArr, stableCB, entry)
  }, [entry, keysArr, stableCB])
}
