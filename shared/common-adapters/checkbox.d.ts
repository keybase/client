import type * as React from 'react'
import type * as Styles from '@/styles'
import type {TextType} from './text.shared'

export type Props = {
  key?: string | undefined
  label?: string | React.ReactNode | undefined
  checkboxColor?: Styles.Color | undefined
  checkboxStyle?: Styles.StylesCrossPlatform | undefined
  labelComponent?: React.ReactNode | undefined
  labelSubtitle?: string | undefined
  labelType?: TextType | undefined
  onCheck?: ((newCheckedValue: boolean) => void) | undefined
  checked: boolean
  style?: Styles.StylesCrossPlatform | undefined
  disabled?: boolean | undefined
}

declare const Checkbox: (p: Props) => React.ReactNode
export default Checkbox
