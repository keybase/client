import * as React from 'react'
import {bind, unbind} from '../util/mousetrap'
// hook for hotkeys

export function useHotKey(keys: Array<string> | string, cb: (key: string) => void) {
  React.useEffect(() => {
    bind(
      keys,
      (e: React.BaseSyntheticEvent, key: string) => {
        e.stopPropagation()
        key && cb(key)
      },
      'keydown'
    )
    return () => {
      unbind(keys)
    }
  }, [keys, cb])
}

export const HotKey = (p: {hotKeys: Array<string> | string; onHotKey: (key: string) => void}) => {
  useHotKey(p.hotKeys, p.onHotKey)
  return null
}
