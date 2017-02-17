// @flow
import React, {PureComponent} from 'react'
import Emoji from './emoji'
import Text from './text'
import parser, {emojiIndexByName} from '../markdown/parser'

import type {Props as EmojiProps} from './emoji'
import type {MarkdownCreateComponent} from './markdown'

function processAST (ast, createComponent) {
  const stack = [ast]

  let index = 0
  while (stack.length > 0) {
    const top = stack[0]
    if (top.type && top.seen) {
      const childrenComponents = top.children.map(child => typeof child === 'string' ? child : child.component)
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

export function parseMarkdown (markdown: string = '', markdownCreateComponent: MarkdownCreateComponent) {
  try {
    return processAST(parser.parse(markdown), markdownCreateComponent)
  } catch (err) {
    console.warn('Markdown parsing failed:', err)
    return markdown
  }
}

export class EmojiIfExists extends PureComponent<void, EmojiProps & {style?: Object}, void> {
  render () {
    const emojiName = (this.props.children && this.props.children.join('')) || ''
    const exists = !!emojiIndexByName[emojiName]
    return exists ? <Emoji {...this.props} /> : <Text type='Body' style={this.props.style}>{emojiName}</Text>
  }
}
