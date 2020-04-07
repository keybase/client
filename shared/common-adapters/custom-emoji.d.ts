import {Component} from 'react'

type emojiSize = 'Small' | 'Medium' | 'MediumLarge' | 'Big'
export type Props = {
  size: emojiSize
  src: string
  alias?: string
}

declare const emojiSizes: {[key in emojiSize]: number}

export default class CustomEmoji extends Component<Props> {}
