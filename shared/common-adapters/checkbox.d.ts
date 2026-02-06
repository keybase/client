import type * as React from 'react'
import type * as Styles from '@/styles'
import type {TextType} from './text.shared'

export type Props = {
  key?: string
  label?: string
  checkboxColor?: Styles.Color
  checkboxStyle?: Styles.StylesCrossPlatform
  labelComponent?: React.ReactNode
  labelSubtitle?: string
  labelType?: TextType
  onCheck?: (newCheckedValue: boolean) => void
  checked: boolean
  style?: Styles.StylesCrossPlatform
  disabled?: boolean
}

declare const Checkbox: (p: Props) => React.ReactNode
export default Checkbox
