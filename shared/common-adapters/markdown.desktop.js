// @flow
import React, {PureComponent} from 'react'
import Text from './text'
import Box from './box'
import Emoji from './emoji'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {parseMarkdown, EmojiIfExists} from './markdown.shared'

import type {Props} from './markdown'

const wrapStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const codeSnippetStyle = {
  ...globalStyles.fontTerminal,
  ...globalStyles.rounded,
  ...wrapStyle,
  backgroundColor: globalColors.beige,
  color: globalColors.blue,
  fontSize: 12,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
}

const codeSnippetBlockStyle = {
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
}

const neutralStyle = {...wrapStyle, color: undefined, fontWeight: undefined}
const linkStyle = {...wrapStyle, fontWeight: undefined}
const neutralPreviewStyle = {color: undefined, fontWeight: undefined}
const boldStyle = {...wrapStyle, color: undefined}
const italicStyle = {...wrapStyle, color: undefined, fontStyle: 'italic', fontWeight: undefined}
const strikeStyle = {...wrapStyle, color: undefined, fontWeight: undefined, textDecoration: 'line-through'}
const quoteStyle = {borderLeft: `3px solid ${globalColors.lightGrey2}`, paddingLeft: 13}

function previewCreateComponent (type, key, children, options) {
  switch (type) {
    case 'emoji':
      return <EmojiIfExists preview={true} size={13} key={key} style={neutralPreviewStyle}>{children}</EmojiIfExists>
    case 'native-emoji':
      return <Emoji size={16} key={key}>{children}</Emoji>
    default:
      return <Text type='BodySmall' key={key} style={neutralPreviewStyle}>{children}</Text>
  }
}

function messageCreateComponent (type, key, children, options) {
  switch (type) {
    case 'inline-code':
      return <Text type='Body' key={key} style={codeSnippetStyle}>{children}</Text>
    case 'code-block':
      return <Text type='Body' key={key} style={codeSnippetBlockStyle}>{children}</Text>
    case 'link':
      return <Text type='BodyPrimaryLink' key={key} style={linkStyle} onClickURL={options.href}>{children}</Text>
    case 'text':
      return <Text type='Body' key={key} style={neutralStyle}>{children}</Text>
    case 'bold':
      return <Text type='BodySemibold' key={key} style={boldStyle}>{children}</Text>
    case 'italic':
      return <Text type='Body' key={key} style={italicStyle}>{children}</Text>
    case 'strike':
      return <Text type='Body' key={key} style={strikeStyle}>{children}</Text>
    case 'emoji':
      return <EmojiIfExists size={16} key={key} style={neutralStyle}>{children}</EmojiIfExists>
    case 'native-emoji':
      return <Emoji size={16} key={key}>{children}</Emoji>
    case 'quote-block':
      return <Box key={key} style={quoteStyle}>{children}</Box>
  }
}

class Markdown extends PureComponent<void, Props, void> {
  render () {
    const content = parseMarkdown(this.props.children, this.props.preview ? previewCreateComponent : messageCreateComponent)
    return <Text type='Body' style={this.props.style}>{content}</Text>
  }
}

export default Markdown
