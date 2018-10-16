// @flow
import React, {PureComponent} from 'react'
import ff from '../util/feature-flags'
import Text from './text'
import * as Styles from '../styles'
import * as Types from '../constants/types/chat2'
import Channel from './channel-container'
import Mention from './mention-container'
import Box from './box'
import Emoji from './emoji'
import {markdownStyles, EmojiIfExists} from './markdown-react'
import {
  parseMarkdown,
  channelNameToConvID,
  createMentionRegex,
  createChannelRegex,
  SimpleMarkdownComponent,
} from './markdown.shared'
import SimpleMarkdown from 'simple-markdown'

import type {Props, MarkdownMeta} from './markdown'

function previewCreateComponent(type, key, children, options) {
  switch (type) {
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={12} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={12} key={key} />
    default:
      return (
        <Text type="BodySmall" key={key} style={markdownStyles.neutralPreviewStyle}>
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
      return <Mention username={username} key={key} style={markdownStyles.wrapStyle} />
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
        <Channel
          name={name}
          convID={Types.stringToConversationIDKey(convID)}
          key={key}
          style={markdownStyles.linkStyle}
        />
      )
    case 'inline-code':
      return (
        <Text type="Body" key={key} style={markdownStyles.codeSnippetStyle}>
          {children}
        </Text>
      )
    case 'code-block':
      return (
        <Text type="Body" key={key} style={markdownStyles.codeSnippetBlockStyle}>
          {children}
        </Text>
      )
    case 'link':
      return (
        <Text
          className="hover-underline"
          type="BodyPrimaryLink"
          key={key}
          style={markdownStyles.linkStyle}
          onClickURL={options.href}
        >
          {children}
        </Text>
      )
    case 'text-block':
      return (
        <Text type="Body" key={key} style={markdownStyles.textBlockStyle}>
          {children && children.length ? children : '\u200b'}
        </Text>
      )
    case 'phone':
      return (
        <Text type="Body" key={key} style={markdownStyles.wrapStyle}>
          {children}
        </Text>
      )
    case 'bold':
      return (
        <Text type="BodySemibold" key={key} style={markdownStyles.boldStyle}>
          {children}
        </Text>
      )
    case 'italic':
      return (
        <Text type="Body" key={key} style={markdownStyles.italicStyle}>
          {children}
        </Text>
      )
    case 'strike':
      return (
        <Text type="Body" key={key} style={markdownStyles.strikeStyle}>
          {children}
        </Text>
      )
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'quote-block':
      return (
        <Box key={key} style={markdownStyles.quoteStyle}>
          {children}
        </Box>
      )
  }
}

class OriginalMarkdown extends PureComponent<Props> {
  render() {
    const content = parseMarkdown(
      this.props.children,
      this.props.preview ? previewCreateComponent : messageCreateComponent,
      this.props.meta
    )
    return (
      <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, this.props.style])}>
        {content}
      </Text>
    )
  }
}

class Markdown extends PureComponent<Props> {
  render() {
    const simple = this.props.simple === undefined ? ff.useSimpleMarkdown : this.props.simple
    if (simple) {
      return <SimpleMarkdownComponent {...this.props} />
    } else {
      return <OriginalMarkdown {...this.props} />
    }
  }
}

const styles = Styles.styleSheetCreate({
  rootWrapper: Styles.platformStyles({
    isElectron: {
      whiteSpace: 'pre',
    },
  }),
})

export default Markdown
