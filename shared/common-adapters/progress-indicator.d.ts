import {Component} from 'react'

export type Props = {
  style?: any
  white?: boolean
  type?: 'Small' | 'Large' | 'Huge' // Huge is desktop-only
}

declare class ProgressIndicator extends Component<Props> {}
export default ProgressIndicator
