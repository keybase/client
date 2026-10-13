import type * as React from 'react'

type Props = {
  onKeyDown?: unknown
  onKeyPress?: unknown
  children: React.ReactNode
}

// Key handling goes through the desktop overlay stack; mobile has none.
export const KeyEventHandler = (props: Props) => props.children as React.ReactElement
