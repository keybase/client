import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  color: 'green' | 'blue' | 'red'
  on: boolean
  style?: Styles.StylesCrossPlatform
}

declare const SwitchToggle: (p: Props) => React.ReactNode
export default SwitchToggle
