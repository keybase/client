// @flow
import logger from '../logger'
import React, {PureComponent} from 'react'
import Emoji from './emoji'
import Text from './text'
import {type ConversationIDKey} from '../constants/types/chat2'
import {isSpecialMention} from '../constants/chat2'
import parser, {emojiIndexByName, isPlainText} from '../markdown/parser'

import type {Props as EmojiProps} from './emoji'
import type {MarkdownCreateComponent, MarkdownMeta} from './markdown'

function processAST(ast, createComponent) {
  const stack = [ast]
  if (
    ast.children.length === 1 &&
    ast.children[0].type === 'text-block' &&
    ast.children[0].children.every(child => child.type === 'emoji' || child.type === 'native-emoji')
  ) {
    ast.children[0].children.forEach(child => (child.bigEmoji = true))
    ast.children[0].big = true
  }

  let index = 0
  while (stack.length > 0) {
    const top = stack[0]
    if (top.type && top.seen) {
      const childrenComponents = top.children.map(
        child => (typeof child === 'string' ? child : child.component)
      )
      top.component = createComponent(top.type, String(index++), childrenComponents, top)
      stack.shift()
    } else if (top.type && !top.seen) {
      top.seen = true
      stack.unshift(...top.children)
    } else {
      stack.shift()
    }
  }

  return ast.component
}

function isValidMention(meta: ?MarkdownMeta, mention: string): boolean {
  if (!meta || !meta.mentionsAt || !meta.mentionsChannel) {
    return false
  }
  const {mentionsChannel, mentionsAt} = meta
  if (mentionsChannel === 'None' && mentionsAt.isEmpty()) {
    return false
  }

  // TODO: Allow uppercase in mentions, and just normalize.
  return isSpecialMention(mention) || mentionsAt.has(mention)
}

function channelNameToConvID(meta: ?MarkdownMeta, channel: string): ?ConversationIDKey {
  return meta && meta.mentionsChannelName && meta.mentionsChannelName.get(channel)
}

export function parseMarkdown(
  markdown: ?string,
  markdownCreateComponent: MarkdownCreateComponent,
  meta: ?MarkdownMeta
) {
  const plainText = isPlainText(markdown)
  if (plainText) {
    return plainText
  }

  try {
    return processAST(
      parser.parse(markdown || '', {
        channelNameToConvID: (channel: string) => channelNameToConvID(meta, channel),
        isValidMention: (mention: string) => isValidMention(meta, mention),
      }),
      markdownCreateComponent
    )
  } catch (err) {
    logger.error('Markdown parsing failed:', err)
    return markdown
  }
}

export class EmojiIfExists extends PureComponent<
  EmojiProps & {style?: any, allowFontScaling?: boolean, lineClamp?: number},
  void
> {
  render() {
    const emojiNameLower = this.props.emojiName.toLowerCase()
    const exists = !!emojiIndexByName[emojiNameLower]
    return exists ? (
      <Emoji
        emojiName={emojiNameLower}
        size={this.props.size}
        allowFontScaling={this.props.allowFontScaling}
      />
    ) : (
      <Text
        type="Body"
        style={this.props.style}
        lineClamp={this.props.lineClamp}
        allowFontScaling={this.props.allowFontScaling}
      >
        {this.props.emojiName}
      </Text>
    )
  }
}
