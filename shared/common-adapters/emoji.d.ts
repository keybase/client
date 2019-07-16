import {Component} from 'react'

export type Props = {
  size: number
  emojiName: string
  disableSelecting?: boolean // desktop only - helps with chrome copy/paste bug workarounds
  allowFontScaling?: boolean
}

declare function backgroundImageFn(set: string, sheetSize: number): string

export {backgroundImageFn}

export default class Emoji extends Component<Props> {}
