import * as React from 'react'
import {Color, StylesCrossPlatform} from '../styles'

export type Props = {
  boxBackgroundColor?: Color // desktop only
  key?: string
  label?: string
  labelComponent?: React.ReactNode
  onCheck: ((newCheckedValue: boolean) => void) | null
  checked: boolean
  style?: StylesCrossPlatform
  disabled?: boolean
}

declare class Checkbox extends React.Component<Props> {}
export default Checkbox
