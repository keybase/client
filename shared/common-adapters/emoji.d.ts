import {Component} from 'react'

export type Props = {
  size?: number,
  emojiName: string,
  disableSelecting?: boolean,
  allowFontScaling?: boolean
};

declare function backgroundImageFn(set: string, sheetSize: string): string

export {backgroundImageFn}

export default class Emoji extends Component<Props> {}
