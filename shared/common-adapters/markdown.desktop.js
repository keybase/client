// @flow
import React, {PureComponent} from 'react'
import Text from './text'
import * as Types from '../constants/types/chat2'
import Channel from './channel-container'
import Mention from './mention-container'
import Box from './box'
import Emoji from './emoji'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../styles'
import {parseMarkdown, EmojiIfExists} from './markdown.shared'
import SimpleMarkdown from 'simple-markdown'

import type {Props} from './markdown'

const wrapStyle = platformStyles({
  isElectron: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
})

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

const codeSnippetBlockStyle = platformStyles({
  common: {
    ...wrapStyle,
    ...codeSnippetStyle,
    backgroundColor: globalColors.beige,
    color: globalColors.black_75,
    marginBottom: globalMargins.xtiny,
    marginTop: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
  },
})

const textBlockStyle = platformStyles({
  common: {...wrapStyle},
  isElectron: {display: 'block', color: 'inherit', fontWeight: 'inherit'},
})
const linkStyle = platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {fontWeight: 'inherit'},
})
const neutralPreviewStyle = platformStyles({
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
})
const boldStyle = {...wrapStyle, color: 'inherit'}
const italicStyle = platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {color: 'inherit', fontStyle: 'italic', fontWeight: 'inherit'},
})

const strikeStyle = platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {
    color: 'inherit',
    fontWeight: 'inherit',
    textDecoration: 'line-through',
  },
})
const quoteStyle = {
  borderLeft: `3px solid ${globalColors.lightGrey2}`,
  paddingLeft: globalMargins.small,
}

function previewCreateComponent(type, key, children, options) {
  switch (type) {
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={12} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={12} key={key} />
    default:
      return (
        <Text type="BodySmall" key={key} style={neutralPreviewStyle}>
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
      return <Mention username={username} key={key} style={wrapStyle} />
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
        <Channel name={name} convID={Types.stringToConversationIDKey(convID)} key={key} style={linkStyle} />
      )
    case 'inline-code':
      return (
        <Text type="Body" key={key} style={codeSnippetStyle}>
          {children}
        </Text>
      )
    case 'code-block':
      return (
        <Text type="Body" key={key} style={codeSnippetBlockStyle}>
          {children}
        </Text>
      )
    case 'link':
      return (
        <Text
          className="hover-underline"
          type="BodyPrimaryLink"
          key={key}
          style={linkStyle}
          onClickURL={options.href}
        >
          {children}
        </Text>
      )
    case 'text-block':
      return (
        <Text type="Body" key={key} style={textBlockStyle}>
          {children && children.length ? children : '\u200b'}
        </Text>
      )
    case 'phone':
      return (
        <Text type="Body" key={key} style={wrapStyle}>
          {children}
        </Text>
      )
    case 'bold':
      return (
        <Text type="BodySemibold" key={key} style={boldStyle}>
          {children}
        </Text>
      )
    case 'italic':
      return (
        <Text type="Body" key={key} style={italicStyle}>
          {children}
        </Text>
      )
    case 'strike':
      return (
        <Text type="Body" key={key} style={strikeStyle}>
          {children}
        </Text>
      )
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'quote-block':
      return (
        <Box key={key} style={quoteStyle}>
          {children}
        </Box>
      )
  }
}

const rules = {
  // ...SimpleMarkdown.defaultRules,
  escape: {
    ...SimpleMarkdown.defaultRules.escape,
  },
  fence: {
    ...SimpleMarkdown.defaultRules.fence,
    // order: SimpleMarkdown.defaultRules.paragraph.order,
    // original:
    // match: SimpleMarkdown.blockRegex(/^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n/),
    // ours: three ticks (anywhere) and remove any newlines in front
    match: SimpleMarkdown.anyScopeRegex(/^```(?:\n)?((?:\\[\s\S]|[^\\])+?)```(?!`)/),
    parse: function(capture, parse, state) {
      return {
        content: capture[1],
        lang: undefined,
        type: 'codeBlock',
      }
    },
  },
  // newline: {
  // ...SimpleMarkdown.defaultRules.newline,
  // match: SimpleMarkdown.blockRegex(/^\n/),
  // react: function(node, output, state) {
  // return <Box />
  // },
  // },
  inlineCode: {
    ...SimpleMarkdown.defaultRules.inlineCode,
    // original:
    // match: inlineRegex(/^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/),
    // ours: onlyh allow a single backtick
    match: SimpleMarkdown.inlineRegex(/^(`)(?!`)\s*([\s\S]*?[^`\n])\s*\1(?!`)/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={codeSnippetStyle}>
          {node.content}
        </Text>
      )
    },
  },
  codeBlock: {
    ...SimpleMarkdown.defaultRules.codeBlock,
    // original:
    // match: blockRegex(/^(?:    [^\n]+\n*)+(?:\n *)+\n/),
    // ours:
    match: SimpleMarkdown.blockRegex(/^(?: {4}[^\n]+\n*)+(?:\n *)+\n/),
    react: (node, output, state) => {
      return (
        <Text key={state.key} type="Body" style={codeSnippetBlockStyle}>
          {node.content}
        </Text>
      )
    },
  },
  paragraph: {
    ...SimpleMarkdown.defaultRules.paragraph,
    // original:
    // match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks
    match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)\n/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={textBlockStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  // },
  // // link: {
  // // ...SimpleMarkdown.defaultRules.link,
  // // react: (node, output, state) => {
  // // return (
  // // <Text
  // // className="hover-underline"
  // // type="BodyPrimaryLink"
  // // key={state.key}
  // // style={linkStyle}
  // // onClickURL={state.href}
  // // >
  // // {node.content}
  // // </Text>
  // // )
  // // },
  // // },
  // // textBlock: {
  // // ...SimpleMarkdown.defaultRules.textBlock,
  // // react: (node, output, state) => {
  // // return (
  // // <Text type="Body" key={state.key} style={textBlockStyle}>
  // // {node.content && node.content.length ? node.content : '\u200b'}
  // // </Text>
  // // )
  // // },
  // // },
  strong: {
    ...SimpleMarkdown.defaultRules.strong,
    match: SimpleMarkdown.inlineRegex(/^\*((?:\\[\s\S]|[^\\])+?)\*(?!\*)/),
    react: (node, output, state) => {
      return (
        <Text type="BodySemibold" key={state.key} style={boldStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  em: {
    ...SimpleMarkdown.defaultRules.em,
    match: SimpleMarkdown.inlineRegex(/^_((?:\\[\s\S]|[^\\])+?)_(?!_)/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={italicStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  del: {
    ...SimpleMarkdown.defaultRules.del,
    match: SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\])+?)~(?!~)/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={strikeStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  blockQuote: {
    ...SimpleMarkdown.defaultRules.blockQuote,
    react: (node, output, state) => {
      return (
        <Box key={state.key} style={quoteStyle}>
          {output(node.content, state)}
        </Box>
      )
    },
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
    // match: SimpleMarkdown.anyScopeRegex(/^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n| {2,}\n|\w+:\S|$)/),
  },
}

const parser = SimpleMarkdown.parserFor(rules)
const reactOutput = SimpleMarkdown.reactFor(SimpleMarkdown.ruleOutput(rules, 'react'))

class Markdown extends PureComponent<Props> {
  render() {
    if (this.props.simple) {
      const parseTree = parser(this.props.children || '', {inline: false})
      console.log(parseTree)
      return (
        <div>
          {reactOutput(parseTree)}
          <pre>{'\n\n\n'}</pre>
          <pre>{this.props.children}</pre>
          <pre>{JSON.stringify(parseTree, null, 2)}</pre>
        </div>
      )
    } else {
      const content = parseMarkdown(
        this.props.children,
        this.props.preview ? previewCreateComponent : messageCreateComponent,
        this.props.meta
      )
      return (
        <Text type="Body" style={platformStyles({isElectron: {whiteSpace: 'pre', ...this.props.style}})}>
          {content}
        </Text>
      )
    }
  }
}

export default Markdown
