// @flow
import React, {PureComponent} from 'react'
import * as Types from '../constants/types/chat2'
import Text from './text'
import Box from './box'
import Emoji from './emoji'
import Channel from './channel-container'
import Mention from './mention-container'
import {globalStyles, globalColors, globalMargins, styleSheetCreate} from '../styles'
import {parseMarkdown, EmojiIfExists} from './markdown.shared'
import {NativeClipboard} from './native-wrappers.native'
import openURL from '../util/open-url'
import {Alert} from 'react-native'

import type {Props} from './markdown'

function previewCreateComponent(style) {
  return function(type, key, children, options) {
    switch (type) {
      case 'markup':
        return (
          <Text type="Body" key={key} lineClamp={1} style={style}>
            {children}
          </Text>
        )
      case 'emoji':
        return <EmojiIfExists emojiName={String(children)} size={12} key={key} />
      case 'native-emoji':
        return <Emoji emojiName={String(children)} size={12} key={key} />
      default:
        return (
          <Text type="Body" key={key} lineClamp={1} style={[styles.neutral, style]}>
            {children}
          </Text>
        )
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

function messageCreateComponent(style, allowFontScaling) {
  return function(type, key, children, options) {
    switch (type) {
      case 'markup':
        return <Box key={key}>{children}</Box>
      case 'inline-code':
        return (
          <Text type="Body" key={key} style={styles.codeSnippet} allowFontScaling={allowFontScaling}>
            {children}
          </Text>
        )
      case 'code-block':
        return (
          <Box key={key} style={styles.codeSnippetBlock}>
            <Text type="Body" style={styles.codeSnippetBlockText} allowFontScaling={allowFontScaling}>
              {children}
            </Text>
          </Box>
        )
      case 'link':
      case 'phone':
        return (
          <Text
            type="BodyPrimaryLink"
            key={key}
            style={styles.link}
            onClickURL={options.href}
            onLongPress={() => _urlChooseOption(options.href)}
            allowFontScaling={allowFontScaling}
          >
            {children}
          </Text>
        )
      case 'text-block':
        return (
          <Text
            type="Body"
            key={key}
            style={[styles.neutral, style, options.big ? styles.big : null]}
            allowFontScaling={allowFontScaling}
          >
            {children && children.length ? children : '\u200b'}
          </Text>
        )
      case 'bold':
        return (
          <Text type="BodySemibold" key={key} style={styles.bold} allowFontScaling={allowFontScaling}>
            {children}
          </Text>
        )
      case 'italic':
        return (
          <Text type="Body" key={key} style={styles.italic} allowFontScaling={allowFontScaling}>
            {children}
          </Text>
        )
      case 'strike':
        return (
          <Text type="Body" key={key} style={styles.strike} allowFontScaling={allowFontScaling}>
            {children}
          </Text>
        )
      case 'mention':
        const username = children[0]
        if (typeof username !== 'string') {
          throw new Error('username unexpectedly not string')
        }
        // Don't pass in neutralStyle for style as that sets
        // fontWeight to undefined, which overrides the BodySemibold
        // type that Mention uses.
        return (
          <Mention
            username={username}
            key={key}
            style={{color: undefined}}
            allowFontScaling={allowFontScaling}
          />
        )
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
            style={styles.link}
            allowFontScaling={allowFontScaling}
          />
        )
      case 'emoji':
        return (
          <EmojiIfExists
            emojiName={String(children)}
            size={options.bigEmoji ? 32 : 15}
            key={key}
            allowFontScaling={allowFontScaling}
          />
        )
      case 'native-emoji':
        return (
          <Emoji
            emojiName={String(children)}
            size={options.bigEmoji ? 32 : 15}
            key={key}
            allowFontScaling={allowFontScaling}
          />
        )
      case 'quote-block':
        return (
          <Box key={key} style={styles.quoteBlock}>
            {children}
          </Box>
        )
    }
  }
}

class Markdown extends PureComponent<Props> {
  render() {
    const createComponent = this.props.preview
      ? previewCreateComponent(this.props.style)
      : messageCreateComponent(this.props.style, !!this.props.allowFontScaling)
    const content = parseMarkdown(this.props.children, createComponent, this.props.meta)
    if (typeof content === 'string') {
      if (this.props.preview) {
        return createComponent('', '', content, {})
      } else {
        return (
          <Text type="Body" style={this.props.style} allowFontScaling={this.props.allowFontScaling}>
            {content}
          </Text>
        )
      }
    }
    return content
  }
}

const styles = styleSheetCreate({
  big: {fontSize: 32, lineHeight: undefined},
  bold: {color: undefined},
  codeSnippet: {
    ...globalStyles.fontTerminal,
    backgroundColor: globalColors.beige,
    color: globalColors.blue,
    fontSize: 13,
    // FIXME not yet supported for nested <Text>:
    // ...globalStyles.rounded,
    // paddingLeft: globalMargins.xtiny,
    // paddingRight: globalMargins.xtiny,
  },
  codeSnippetBlock: {
    ...globalStyles.rounded,
    backgroundColor: globalColors.beige,
    marginBottom: globalMargins.xtiny,
    marginTop: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
  codeSnippetBlockText: {
    ...globalStyles.fontTerminal,
    color: globalColors.black_75,
  },
  italic: {color: undefined, fontStyle: 'italic', fontWeight: undefined},
  // The Text component adds default styles which we need to unset so that
  // styles applied to Markdown parent take effect. For instance, we need
  // to unset the default color applied by <Text type="body"> so that
  // <Markdown style={{color: ...}}> works.
  link: {fontWeight: undefined},
  neutral: {color: undefined, fontWeight: undefined},
  quoteBlock: {borderLeftColor: globalColors.lightGrey2, borderLeftWidth: 3, paddingLeft: 8},
  strike: {color: undefined, fontWeight: undefined, textDecorationLine: 'line-through'},
})

export default Markdown
