import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  style?: Styles.StylesCrossPlatform
  white?: boolean
  type?: 'Small' | 'Large' | 'Huge' // Huge is desktop-only
}

declare const ProgressIndicator: (p: Props) => React.ReactNode
export default ProgressIndicator
