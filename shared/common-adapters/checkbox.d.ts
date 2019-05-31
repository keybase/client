import {Component, ReactNode} from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  key?: string
  label?: string
  labelComponent?: ReactNode
  onCheck: (newCheckedValue: boolean) => void | null
  checked: boolean
  style?: StylesCrossPlatform
  disabled?: boolean
}

declare class Checkbox extends Component<Props> {}
export default Checkbox
