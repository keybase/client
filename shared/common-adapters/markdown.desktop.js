// @flow
import * as React from 'react'
import Text from './text'
import * as Types from '../constants/types/chat2'
import Channel from './channel-container'
import Mention from './mention-container'
import Box from './box'
import Emoji from './emoji'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../styles'
import {parseMarkdown, EmojiIfExists} from './markdown.shared'

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
  children: Array<React.Node>,
  options: {href?: string, convID?: string, bigEmoji?: boolean}
) => ?React.Node

export type MarkdownMeta = {
  mentionsAt: Types.MentionsAt,
  mentionsChannelName: Types.MentionsChannelName,
  mentionsChannel: Types.MentionsChannel,
}

export type Props = {
  children?: string,
  preview?: boolean, // if true render a simplified version
  style?: any,
  allowFontScaling?: boolean,
  meta?: MarkdownMeta,
}

const wrapStyle = platformStyles({
  isElectron: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
})

const codeSnippetStyle = platformStyles({
  isElectron: {
    ...globalStyles.fontTerminal,
    ...globalStyles.rounded,
    ...wrapStyle,
    backgroundColor: globalColors.beige,
    color: globalColors.blue,
    fontSize: 12,
    paddingLeft: globalMargins.xtiny,
    paddingRight: globalMargins.xtiny,
  },
})

const codeSnippetBlockStyle = platformStyles({
  isElectron: {
    ...codeSnippetStyle,
    ...wrapStyle,
    backgroundColor: globalColors.beige,
    color: globalColors.black_75,
    display: 'block',
    marginBottom: globalMargins.xtiny,
    marginTop: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
})

const textBlockStyle = platformStyles({
  common: {...wrapStyle},
  isElectron: {display: 'block', color: 'inherit', fontWeight: 'inherit'},
})
const linkStyle = platformStyles({
  common: {...wrapStyle},
  isElectron: {fontWeight: 'inherit'},
})
const neutralPreviewStyle = platformStyles({
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
})
const boldStyle = {...wrapStyle, color: 'inherit'}
const italicStyle = platformStyles({
  common: {...wrapStyle},
  isElectron: {color: 'inherit', fontStyle: 'italic', fontWeight: 'inherit'},
})

const strikeStyle = platformStyles({
  common: {...wrapStyle},
  isElectron: {
    color: 'inherit',
    fontWeight: 'inherit',
    textDecoration: 'line-through',
  },
})
const quoteStyle = {borderLeft: `3px solid ${globalColors.lightGrey2}`, paddingLeft: 13}

function previewCreateComponent(type, key, children, options) {
  switch (type) {
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={11} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={11} key={key} />
    default:
      return (
        <Text type="BodySmall" key={key} style={neutralPreviewStyle}>
          {children}
        </Text>
      )
  }
}

function messageCreateComponent(type, key, children, options) {
  switch (type) {
    case 'markup':
      return <Box key={key}>{children}</Box>
    case 'mention':
      const username = children[0]
      if (typeof username !== 'string') {
        throw new Error('username unexpectedly not string')
      }
      return <Mention username={username} key={key} style={wrapStyle} />
    case 'channel':
      const name = children[0]
      if (typeof name !== 'string') {
        throw new Error('name unexpectedly not string')
      }
      const convID = options.convID || ''
      if (typeof convID !== 'string') {
        throw new Error('convID unexpectedly not string')
      }
      return (
        <Channel name={name} convID={Types.stringToConversationIDKey(convID)} key={key} style={linkStyle} />
      )
    case 'inline-code':
      return (
        <Text type="Body" key={key} style={codeSnippetStyle}>
          {children}
        </Text>
      )
    case 'code-block':
      return (
        <Text type="Body" key={key} style={codeSnippetBlockStyle}>
          {children}
        </Text>
      )
    case 'link':
      return (
        <Text type="BodyPrimaryLink" key={key} style={linkStyle} onClickURL={options.href}>
          {children}
        </Text>
      )
    case 'text-block':
    case 'phone':
      return (
        <Text type="Body" key={key} style={textBlockStyle}>
          {children && children.length ? children : '\u200b'}
        </Text>
      )
    case 'bold':
      return (
        <Text type="BodySemibold" key={key} style={boldStyle}>
          {children}
        </Text>
      )
    case 'italic':
      return (
        <Text type="Body" key={key} style={italicStyle}>
          {children}
        </Text>
      )
    case 'strike':
      return (
        <Text type="Body" key={key} style={strikeStyle}>
          {children}
        </Text>
      )
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'quote-block':
      return (
        <Box key={key} style={quoteStyle}>
          {children}
        </Box>
      )
  }
}

class Markdown extends React.PureComponent<Props> {
  render() {
    const content = parseMarkdown(
      this.props.children,
      this.props.preview ? previewCreateComponent : messageCreateComponent,
      this.props.meta
    )
    return (
      <Text type="Body" style={platformStyles({isElectron: {whiteSpace: 'pre', ...this.props.style}})}>
        {content}
      </Text>
    )
  }
}

export default Markdown
