import * as React from 'react'
import {bind, unbind} from '@/util/mousetrap'

// mousetrap is very simple. a bind will overwrite the binding. unbind unbinds it globally
// we need to keep a stack to manage the state

const keyToCBStack = new Map<string, Array<(cmd: string) => void>>()

/** hook for hotkeys **/
export function useHotKey(keys: Array<string> | string, cb: (key: string) => void) {
  React.useEffect(() => {
    // add key and callback to bookkeeping
    const keysArr = typeof keys === 'string' ? [keys] : keys
    keysArr.forEach(key => {
      let cbs = keyToCBStack.get(key)
      if (!cbs) {
        cbs = []
        keyToCBStack.set(key, cbs)
      }
      cbs.push(cb)
    })
    // actually bind
    bind(
      keys,
      (e: {stopPropagation: () => void}, key: string) => {
        e.stopPropagation()
        key && cb(key)
      },
      'keydown'
    )
    return () => {
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
            bind(
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
          unbind(key)
          keyToCBStack.delete(key)
        }
      })
    }
  }, [keys, cb])
}

/** Simple component to control a global key binding **/
export const HotKey = (p: {hotKeys: Array<string> | string; onHotKey: (key: string) => void}) => {
  useHotKey(p.hotKeys, p.onHotKey)
  return null
}
