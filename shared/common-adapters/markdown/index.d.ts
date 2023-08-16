import * as React from 'react'
import type * as T from '../../constants/types'
import {StylesTextCrossPlatform, LineClampType} from '../../common-adapters/text'

type MarkdownComponentType =
  | 'inline-code'
  | 'code-block'
  | 'link'
  | 'text'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'emoji'
  | 'native-emoji'
  | 'quote-block'

export type MarkdownCreateComponent = (
  type: MarkdownComponentType,
  key: string,
  children: Array<React.ReactNode>,
  options: {
    href?: string
    convID?: string
    bigEmoji?: boolean
  }
) => React.ReactNode

export type MarkdownMeta = {
  message: T.Chat.MessageText | T.Chat.MessageAttachment
}

export type StyleOverride = {
  paragraph?: StylesTextCrossPlatform
  fence?: StylesTextCrossPlatform
  inlineCode?: StylesTextCrossPlatform
  strong?: StylesTextCrossPlatform
  em?: StylesTextCrossPlatform
  del?: StylesTextCrossPlatform
  link?: StylesTextCrossPlatform
  mailto?: StylesTextCrossPlatform
  preview?: StylesTextCrossPlatform
  kbfsPath?: StylesTextCrossPlatform
  emoji?: StylesTextCrossPlatform
  customEmoji?: StylesTextCrossPlatform
}

export type Props = {
  children?: string
  lineClamp?: LineClampType
  selectable?: boolean // desktop - applies to outer container only
  smallStandaloneEmoji?: boolean // don't increase font size for a standalone emoji
  paragraphTextClassName?: string
  preview?: boolean // if true render a simplified version
  serviceOnly?: boolean // only render stuff from the service

  // Style only styles the top level container.
  // This is only useful in desktop because of cascading styles and there is a top level wrapper.
  // Mobile doesn't have this wrapper (on purpose), so if you want to style the container, do it
  // at a higher level.
  //
  // You can also use this to style previews which has a single top level wrapper, but it's
  // preferred to use the props.styleOverride.preview flag for this
  //
  // TODO type this up or remove it
  style?: any
  allowFontScaling?: boolean
  messageType?: T.Chat.MessageType
  // This changes the specific style for specific types of text
  // for example you may want to make paragraphs, italics, etc to be black_50
  // but want blue_30 for the inline code
  styleOverride?: StyleOverride

  virtualText?: boolean // desktop only, see text.desktop
}

export default class Markdown extends React.Component<Props> {}
