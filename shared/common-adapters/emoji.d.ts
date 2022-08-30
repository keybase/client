import * as React from 'react'
import type {StylesCrossPlatform} from '../styles'

export type Props = {
  size: number
  emojiName: string
  disableSelecting?: boolean // desktop only - helps with chrome copy/paste bug workarounds
  allowFontScaling?: boolean
  style?: StylesCrossPlatform
}

export default class Emoji extends React.Component<Props> {}
