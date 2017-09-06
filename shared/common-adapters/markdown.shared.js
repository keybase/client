// @flow
import React, {PureComponent} from 'react'
import Emoji from './emoji'
import Text from './text'
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

function preprocessMarkdown(markdown: string, meta: ?MarkdownMeta) {
  if (!meta || !meta.mentions || !meta.channelMention) {
    return markdown
  }
  const {channelMention, mentions} = meta
  if (channelMention === 'None' && mentions.length === 0) {
    return markdown
  }

  return markdown.replace(/\B@([a-z][a-z0-9_]+)/g, (match, matchedGroup) => {
    if (matchedGroup === 'here' || matchedGroup === 'channel' || mentions.has(matchedGroup)) {
      return `${match}@keybase`
    }
    return match
  })
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
    return processAST(parser.parse(preprocessMarkdown(markdown || '', meta)), markdownCreateComponent)
  } catch (err) {
    console.warn('Markdown parsing failed:', err)
    return markdown
  }
}

export class EmojiIfExists
  extends PureComponent<EmojiProps & {style?: Object, allowFontScaling?: boolean}, void> {
  render() {
    const emojiNameLower = this.props.emojiName.toLowerCase()
    const exists = !!emojiIndexByName[emojiNameLower]
    return exists
      ? <Emoji
          emojiName={emojiNameLower}
          size={this.props.size}
          allowFontScaling={this.props.allowFontScaling}
        />
      : <Text type="Body" style={this.props.style} allowFontScaling={this.props.allowFontScaling}>
          {this.props.emojiName}
        </Text>
  }
}
