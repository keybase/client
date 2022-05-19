import {Component} from 'react'
import type * as Styles from '../styles'

export type Props = {
  size: number
  src: string
  alias?: string
  style?: Styles.StylesCrossPlatform
}

export default class CustomEmoji extends Component<Props> {}
