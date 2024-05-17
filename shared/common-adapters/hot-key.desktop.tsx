import * as React from 'react'
import * as C from '@/constants'
import Mousetrap from 'mousetrap'
import {registerDebugClear} from '@/util/debug'

registerDebugClear(() => {
  Mousetrap.reset()
})

// mousetrap is very simple. a bind will overwrite the binding. unbind unbinds it globally
// we need to keep a stack to manage the state. We register/unregister when we mount/unmount / change nav focus

const keyToCBStack = new Map<string, Array<(cmd: string) => void>>()

/** hook for hotkeys **/
export function useHotKey(keys: Array<string> | string, cb: (key: string) => void) {
  const keysArr = React.useMemo(() => (typeof keys === 'string' ? [keys] : keys), [keys])
  const register = React.useCallback(() => {
    // add key and callback to bookkeeping
    keysArr.forEach(key => {
      let cbs = keyToCBStack.get(key)
      if (!cbs) {
        cbs = []
        keyToCBStack.set(key, cbs)
      }
      cbs.push(cb)
    })
    // actually bind
    Mousetrap.bind(
      keysArr,
      (e: {stopPropagation: () => void}, key: string) => {
        e.stopPropagation()
        key && cb(key)
      },
      'keydown'
    )
  }, [keysArr, cb])

  const unregister = React.useCallback(() => {
    // find and remove the bookkeeping
    keysArr.forEach(key => {
      const cbs = keyToCBStack.get(key)
      if (!cbs) return
      const idx = cbs.indexOf(cb)
      if (idx !== -1) {
        cbs.splice(idx, 1)
        // mousetrap will remove existing bindings. if there is an older one turn it back on
        const last = cbs.at(-1)
        if (last) {
          Mousetrap.bind(
            key,
            (e: {stopPropagation: () => void}, key: string) => {
              e.stopPropagation()
              key && last(key)
            },
            'keydown'
          )
        }
      }
      // nothing listening for this key? now we finally unbind and cleanup
      if (cbs.length === 0) {
        Mousetrap.unbind(key, 'keydown')
        keyToCBStack.delete(key)
      }
    })
  }, [keysArr, cb])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      register()
      return () => {
        unregister()
      }
    }, [register, unregister])
  )

  React.useEffect(() => {
    register()
    return () => {
      unregister()
    }
  }, [keys, cb, register, unregister])
}

/** Simple component to control a global key binding **/
export const HotKey = React.memo(function HotKey(p: {
  hotKeys: Array<string> | string
  onHotKey: (key: string) => void
}) {
  useHotKey(p.hotKeys, p.onHotKey)
  return null
})
