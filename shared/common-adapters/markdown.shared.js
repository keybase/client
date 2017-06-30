// @flow
import React, {PureComponent} from 'react'
import Emoji from './emoji'
import Text from './text'
import parser, {emojiIndexByName} from '../markdown/parser'

import type {Props as EmojiProps} from './emoji'
import type {MarkdownCreateComponent} from './markdown'

function processAST(ast, createComponent) {
  const stack = [ast]

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

// Quick check to avoid markdown parsing overhead
const maybeMarkdown = markdown => {
  // only chars, numbers, whitespace, some common punctuation and periods that end sentences (not domains)
  return markdown && !markdown.match(/^([A-Za-z0-9!?=+@#$%^&()[\]]|\s|\.\B)*$/)
}

export function parseMarkdown(markdown: ?string, markdownCreateComponent: MarkdownCreateComponent) {
  try {
    return maybeMarkdown(markdown)
      ? processAST(parser.parse(markdown || ''), markdownCreateComponent)
      : markdown
  } catch (err) {
    console.warn('Markdown parsing failed:', err)
    return markdown
  }
}

export class EmojiIfExists
  extends PureComponent<void, EmojiProps & {style?: Object, allowFontScaling?: boolean}, void> {
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
