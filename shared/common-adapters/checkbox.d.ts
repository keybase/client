import type * as React from 'react'
import type {Color, StylesCrossPlatform} from '@/styles'

export type Props = {
  boxBackgroundColor?: Color // desktop only
  key?: string
  label?: string
  labelComponent?: React.ReactNode
  labelSubtitle?: string
  onCheck?: (newCheckedValue: boolean) => void
  checked: boolean
  style?: StylesCrossPlatform
  disabled?: boolean
}

declare const Checkbox: (p: Props) => React.ReactNode
export default Checkbox
