// @flow
import React, {PureComponent} from 'react'
import Text from './text'
import Box from './box'
import Emoji from './emoji'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {parseMarkdown, EmojiIfExists} from './markdown.shared'
import {NativeClipboard} from './native-wrappers.native'
import openURL from '../util/open-url'
import {Alert} from 'react-native'

import type {Props} from './markdown'

const codeSnippetStyle = {
  ...globalStyles.fontTerminal,
  color: globalColors.blue,
  fontSize: 13,
  backgroundColor: globalColors.beige,
  // FIXME not yet supported for nested <Text>:
  // ...globalStyles.rounded,
  // paddingLeft: globalMargins.xtiny,
  // paddingRight: globalMargins.xtiny,
}

const codeSnippetBlockStyle = {
  ...globalStyles.rounded,
  backgroundColor: globalColors.beige,
  marginBottom: globalMargins.xtiny,
  marginTop: globalMargins.xtiny,
  paddingBottom: globalMargins.xtiny,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  paddingTop: globalMargins.xtiny,
}

const codeSnippetBlockTextStyle = {
  ...globalStyles.fontTerminal,
  color: globalColors.black_75,
}

const quoteBlockStyle = {borderLeftColor: globalColors.lightGrey2, borderLeftWidth: 3, paddingLeft: 8}

// The Text component adds default styles which we need to unset so that
// styles applied to Markdown parent take effect. For instance, we need
// to unset the default color applied by <Text type="body"> so that
// <Markdown style={{color: ...}}> works.
const neutralStyle = {color: undefined, fontWeight: undefined}
const linkStyle = {fontWeight: undefined}
const boldStyle = {color: undefined}
const italicStyle = {color: undefined, fontStyle: 'italic', fontWeight: undefined}
const strikeStyle = {color: undefined, fontWeight: undefined, textDecorationLine: 'line-through'}

function previewCreateComponent(style) {
  return function(type, key, children, options) {
    switch (type) {
      case 'markup':
        return <Text type="Body" key={key} lineClamp={1} style={style}>{children}</Text>
      case 'emoji':
        return <EmojiIfExists emojiName={String(children)} size={12} key={key} />
      case 'native-emoji':
        return <Emoji emojiName={String(children)} size={12} key={key} />
      default:
        return <Text type="Body" key={key} style={{...neutralStyle, ...style}}>{children}</Text>
    }
  }
}

const _urlCopy = (url: ?string) => {
  if (!url) return
  NativeClipboard.setString(url)
}

const _urlChooseOption = (url: ?string) => {
  if (!url) return
  Alert.alert('', url, [
    {style: 'cancel', text: 'Cancel'},
    {onPress: () => openURL(url), text: 'Open Link'},
    {onPress: () => _urlCopy(url), text: 'Copy Link'},
  ])
}

function messageCreateComponent(style) {
  return function(type, key, children, options) {
    switch (type) {
      case 'markup':
        return <Box key={key}>{children}</Box>
      case 'inline-code':
        return <Text type="Body" key={key} style={codeSnippetStyle}>{children}</Text>
      case 'code-block':
        return (
          <Box key={key} style={codeSnippetBlockStyle}>
            <Text type="Body" style={codeSnippetBlockTextStyle}>{children}</Text>
          </Box>
        )
      case 'link':
        return (
          <Text
            type="BodyPrimaryLink"
            key={key}
            style={linkStyle}
            onClickURL={options.href}
            onLongPress={() => _urlChooseOption(options.href)}
          >
            {children}
          </Text>
        )
      case 'text-block':
        return (
          <Text type="Body" key={key} style={{...neutralStyle, ...style}}>
            {children.length ? children : '\u200b'}
          </Text>
        )
      case 'bold':
        return <Text type="BodySemibold" key={key} style={boldStyle}>{children}</Text>
      case 'italic':
        return <Text type="Body" key={key} style={italicStyle}>{children}</Text>
      case 'strike':
        return <Text type="Body" key={key} style={strikeStyle}>{children}</Text>
      case 'emoji':
        return <EmojiIfExists emojiName={String(children)} size={15} key={key} />
      case 'native-emoji':
        return <Emoji emojiName={String(children)} size={15} key={key} />
      case 'quote-block':
        return <Box key={key} style={quoteBlockStyle}>{children}</Box>
    }
  }
}

class Markdown extends PureComponent<void, Props, void> {
  render() {
    const createComponent = this.props.preview
      ? previewCreateComponent(this.props.style)
      : messageCreateComponent(this.props.style)
    const content = parseMarkdown(this.props.children, createComponent)
    if (typeof content === 'string') {
      return <Text type="Body" style={this.props.style}>{content}</Text>
    }
    return content
  }
}

export default Markdown
