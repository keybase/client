import * as React from 'react'
import {bind, unbind} from '../util/mousetrap'

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
      (e: React.BaseSyntheticEvent, key: string) => {
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
        const idx = cbs.indexOf(cb) ?? -1
        if (idx !== -1) {
          cbs.splice(idx, 1)
          // mousetrap will remove existing bindings. if there is an older one turn it back on
          const last = cbs[cbs.length - 1]
          if (last) {
            bind(
              key,
              (e: React.BaseSyntheticEvent, k: string) => {
                e.stopPropagation()
                k && last(k)
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
