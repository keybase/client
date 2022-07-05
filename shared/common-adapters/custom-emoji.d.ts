import {Component} from 'react'

export type Props = {
  size: number
  src: string
  alias?: string
  addTopMargin?: boolean
}

export default class CustomEmoji extends Component<Props> {}
