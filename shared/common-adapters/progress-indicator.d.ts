import type * as React from 'react'

export type Props = {
  style?: any
  white?: boolean
  type?: 'Small' | 'Large' | 'Huge' // Huge is desktop-only
}

declare const ProgressIndicator: (p: Props) => React.ReactNode
export default ProgressIndicator
