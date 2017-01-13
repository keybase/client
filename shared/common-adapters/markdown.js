// @flow

import Text from './text'
import {emojiIndex} from 'emoji-mart'
import Emoji from './emoji'
import React, {PureComponent} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'
import parser from '../markdown/parser'

import type {Props as EmojiProps} from './emoji'
import type {Props} from './markdown'

const codeSnippetStyle = {
  ...globalStyles.fontTerminal,
  ...globalStyles.rounded,
  fontSize: 12,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
  backgroundColor: globalColors.beige,
  color: globalColors.blue,
}

const codeSnippetBlockStyle = {
  ...codeSnippetStyle,
  display: 'block',
  color: globalColors.black_75,
  backgroundColor: globalColors.beige,
  marginTop: globalMargins.xtiny,
  marginBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
  paddingBottom: globalMargins.xtiny,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  whiteSpace: 'pre-wrap',
}

class EmojiIfExists extends PureComponent<void, EmojiProps, void> {
  render () {
    const emoji = (this.props.children && this.props.children.join('')) || ''
    const exists = emojiIndex.emojis.hasOwnProperty(emoji.split('::')[0])
    return exists ? <Emoji {...this.props} /> : <Text type='Body' style={{color: undefined, fontWeight: undefined}}>:{emoji}:</Text>
  }
}

function createComponent (type, key, children) {
  switch (type) {
    case 'inline-code':
      return <Text type='Body' key={key} style={codeSnippetStyle}>{children}</Text>
    case 'code-block':
      return <Text type='Body' key={key} style={codeSnippetBlockStyle}>{children}</Text>
    case 'text':
      return <Text type='Body' key={key} style={{color: undefined, fontWeight: undefined}}>{children}</Text>
    case 'bold':
      return <Text type='BodySemibold' key={key} style={{color: undefined}}>{children}</Text>
    case 'italic':
      return <Text type='Body' key={key} style={{color: undefined, fontStyle: 'italic', fontWeight: undefined}}>{children}</Text>
    case 'strike':
      return <Text type='Body' key={key} style={{color: undefined, fontWeight: undefined, textDecoration: 'line-through'}}>{children}</Text>
    case 'emoji':
      return <EmojiIfExists size={16} key={key}>{children}</EmojiIfExists>
    // TODO
    case 'quote-block':
      return <Text type='Body' key={key} style={{}}>{children}</Text>
  }
}

function process (ast) {
  const stack = [ast]

  let index = 0
  while (stack.length > 0) {
    const top = stack[0]
    if (top.type && top.seen) {
      top.component = createComponent(top.type, index++, top.children.map(c => c.component ? c.component : c))
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

class Markdown extends PureComponent<void, Props, void> {
  render () {
    return <Text type='Body' style={this.props.style}>{process(parser.parse(this.props.children || ''))}</Text>
  }
}

export default Markdown
