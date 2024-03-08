import type * as React from 'react'
type Props = {
  hotKeys: Array<string> | string
  onHotKey: (key: string) => void
}
declare const HotKey: (p: Props) => React.ReactNode
declare function useHotKey(keys: Array<string> | string, cb: (key: string) => void): void
