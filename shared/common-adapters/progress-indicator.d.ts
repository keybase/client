import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  style?: Styles.StylesCrossPlatform | undefined
  white?: boolean | undefined
  type?: 'Small' | 'Large' | 'Huge' | undefined // Huge is desktop-only
}

declare const ProgressIndicator: (p: Props) => React.ReactNode
export default ProgressIndicator
