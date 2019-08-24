import {Component} from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  style?: StylesCrossPlatform
  vertical?: boolean
}

declare class Divider extends Component<Props> {}
export default Divider
