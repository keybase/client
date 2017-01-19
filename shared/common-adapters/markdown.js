// @flow

import Text from './text'
import {emojiIndex} from 'emoji-mart'
import Emoji from './emoji'
import React, {PureComponent} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'
import parser from '../markdown/parser'

import type {Props as EmojiProps} from './emoji'
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
const neutralPreviewStyle = {color: undefined, fontWeight: undefined}
const boldStyle = {...wrapStyle, color: undefined}
const italicStyle = {...wrapStyle, color: undefined, fontStyle: 'italic', fontWeight: undefined}
const strikeStyle = {...wrapStyle, color: undefined, fontWeight: undefined, textDecoration: 'line-through'}

class EmojiIfExists extends PureComponent<void, EmojiProps, void> {
  render () {
    const emoji = (this.props.children && this.props.children.join('')) || ''
    const exists = emojiIndex.emojis.hasOwnProperty(emoji.split('::')[0])
    return exists ? <Emoji {...this.props} /> : <Text type='Body' style={this.props.preview ? neutralPreviewStyle : neutralStyle}>:{emoji}:</Text>
  }
}

function previewCreateComponent (type, key, children) {
  switch (type) {
    case 'emoji':
      return <EmojiIfExists preview={true} size={13} key={key}>{children}</EmojiIfExists>
    default:
      return <Text type='BodySmall' key={key} style={neutralPreviewStyle}>{children}</Text>
  }
}

function messageCreateComponent (type, key, children) {
  switch (type) {
    case 'inline-code':
      return <Text type='Body' key={key} style={codeSnippetStyle}>{children}</Text>
    case 'code-block':
      return <Text type='Body' key={key} style={codeSnippetBlockStyle}>{children}</Text>
    case 'text':
      return <Text type='Body' key={key} style={neutralStyle}>{children}</Text>
    case 'bold':
      return <Text type='BodySemibold' key={key} style={boldStyle}>{children}</Text>
    case 'italic':
      return <Text type='Body' key={key} style={italicStyle}>{children}</Text>
    case 'strike':
      return <Text type='Body' key={key} style={strikeStyle}>{children}</Text>
    case 'emoji':
      return <EmojiIfExists size={16} key={key}>{children}</EmojiIfExists>
    // TODO
    case 'quote-block':
      return <Text type='Body' key={key} style={{}}>{children}</Text>
  }
}

function process (ast, createComponent) {
  const stack = [ast]

  let index = 0
  while (stack.length > 0) {
    const top = stack[0]
    if (top.type && top.seen) {
      // Needed to collect characters into strings
      const childrenComponents = top.children.reduce((acc, child, i) => {
        const last = acc[acc.length - 1]
        const isLast = i === top.children.length - 1
        if (Array.isArray(last)) {
          if (typeof child === 'string') {
            last.push(child)
            if (isLast) {
              acc[acc.length - 1] = last.join('')
            }
          } else {
            acc[acc.length - 1] = last.join('')
            acc.push(child.component)
          }
        } else {
          if (typeof child === 'string') {
            acc.push([child])
          } else {
            acc.push(child.component)
          }
        }

        return acc
      }, [])
      top.component = createComponent(top.type, index++, childrenComponents)
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
    return <Text type='Body' style={this.props.style}>{process(parser.parse(this.props.children || ''), this.props.preview ? previewCreateComponent : messageCreateComponent)}</Text>
  }
}

export default Markdown
