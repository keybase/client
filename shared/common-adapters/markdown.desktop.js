// @flow
import * as I from 'immutable'
import React, {PureComponent} from 'react'
import Text from './text'
import * as Styles from '../styles'
import * as Types from '../constants/types/chat2'
import Channel from './channel-container'
import Mention from './mention-container'
import Box from './box'
import Emoji from './emoji'
import {tldExp} from '../markdown/regex'
import {
  parseMarkdown,
  EmojiIfExists,
  channelNameToConvID,
  createMentionRegex,
  createChannelRegex,
} from './markdown.shared'
import {emojiRegex} from '../markdown/emoji'
import SimpleMarkdown from 'simple-markdown'

import type {Props, MarkdownMeta} from './markdown'

const wrapStyle = Styles.platformStyles({
  isElectron: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
})

const codeSnippetStyle = {
  ...Styles.globalStyles.fontTerminal,
  ...Styles.globalStyles.rounded,
  ...wrapStyle,
  backgroundColor: Styles.globalColors.beige,
  color: Styles.globalColors.blue,
  fontSize: 12,
  paddingLeft: Styles.globalMargins.xtiny,
  paddingRight: Styles.globalMargins.xtiny,
}

const codeSnippetBlockStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
    ...codeSnippetStyle,
    backgroundColor: Styles.globalColors.beige,
    color: Styles.globalColors.black_75,
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
  },
})

const textBlockStyle = Styles.platformStyles({
  common: {...wrapStyle},
  isElectron: {display: 'block', color: 'inherit', fontWeight: 'inherit'},
})
const linkStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {fontWeight: 'inherit'},
})
const neutralPreviewStyle = Styles.platformStyles({
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
})
const boldStyle = {...wrapStyle, color: 'inherit'}
const italicStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {color: 'inherit', fontStyle: 'italic', fontWeight: 'inherit'},
})

const strikeStyle = Styles.platformStyles({
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
  borderLeft: `3px solid ${Styles.globalColors.lightGrey2}`,
  paddingLeft: Styles.globalMargins.small,
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

const linkRegex = /^( *)((https?:\/\/)?[\w-]+(?<tld>\.[\w-]+)+\.?(:\d+)?(\/\S*)?)\b/i
const inlineLinkMatch = SimpleMarkdown.inlineRegex(linkRegex)

var debugAnyScopeRegex = function(name, regex) {
  var match = function(source, state) {
    console.log('[debug]: ', name, source, state, regex.exec(source))
    return regex.exec(source)
  }
  match.regex = regex
  return match
}

const rules = (markdownMeta: ?MarkdownMeta) => ({
  newline: {
    // handle newlines, keep this to handle \n w/ other matchers
    ...SimpleMarkdown.defaultRules.newline,
    // original
    // match: blockRegex(/^(?:\n *)*\n/),
    // ours: handle \n inside text also
    match: SimpleMarkdown.anyScopeRegex(/^\n/),
  },
  escape: {
    // handle escaped chars, keep this to handle escapes globally
    ...SimpleMarkdown.defaultRules.escape,
  },
  fence: {
    // aka the ``` code blocks
    ...SimpleMarkdown.defaultRules.fence,
    order: 0,
    // original:
    // match: SimpleMarkdown.blockRegex(/^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n/),
    // ours: three ticks (anywhere) and remove any newlines in front and one in back
    match: SimpleMarkdown.anyScopeRegex(/^```(?:\n)?((?:\\[\s\S]|[^\\])+?)```(?!`)(\n)?/),
    parse: function(capture, parse, state) {
      return {
        content: capture[1],
        lang: undefined,
        type: 'codeBlock',
      }
    },
  },
  quotedFence: {
    // The ``` code blocks in a quote block >
    // i.e.
    // > They wrote ```
    //  foo = true
    // ```
    // It's much easier and cleaner to make this a separate rule
    ...SimpleMarkdown.defaultRules.fence,
    order: SimpleMarkdown.defaultRules.blockQuote.order - 0.5,
    // Example: https://regex101.com/r/ZiDBsO/6
    match: SimpleMarkdown.anyScopeRegex(/^(?: *> ?((?:[^\n](?!```))*)) ```\n?((?:\\[\s\S]|[^\\])+)```\n?/),

    parse: function(capture, parse, state) {
      return {
        content: [
          ...SimpleMarkdown.parseInline(parse, capture[1], state),
          {
            content: capture[2],
            type: 'codeBlock',
          },
        ],
        type: 'blockQuote',
      }
    },
  },
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
    // ours: we only want code blocks from fences (```) and not from spaces
    match: () => null,
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
  strong: {
    ...SimpleMarkdown.defaultRules.strong,
    // original
    // match: inlineRegex(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
    // ours: single stars
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
    // original is pretty long so not inlining it here
    // ours: wrapped in _'s
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
    // original:
    // match: inlineRegex(/^~~(?=\S)([\s\S]*?\S)~~/),
    // ours: single tidle doesn't cross a newline
    // match: SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\])+?)~(?!~)/),
    match: SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\\n])+?)~(?!~)/),
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
    // match: blockRegex(/^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/),
    // Original: A quote block only needs to start with > and everything in the same paragraph will be a quote
    // e.g. https://regex101.com/r/ZiDBsO/2
    // ours: Everything in the quote has to be preceded by >
    // unless it has the start of a fence
    // e.g. https://regex101.com/r/ZiDBsO/7
    match: SimpleMarkdown.blockRegex(/^( *>(?:[^\n](?!```))*\n)+/),
    react: (node, output, state) => {
      return (
        <Box key={state.key} style={quoteStyle}>
          {output(node.content, state)}
        </Box>
      )
    },
  },
  mention: {
    // A decent enough starting template
    // We'll change most of the stuff here anyways
    ...SimpleMarkdown.defaultRules.autolink,
    match: (source, state, lookBehind) => {
      const mentionRegex = createMentionRegex(markdownMeta)
      if (!mentionRegex) {
        return null
      }

      const matches = SimpleMarkdown.inlineRegex(mentionRegex)(source, state, lookBehind)
      // Also check that the lookBehind is not text
      if (matches && (!lookBehind || lookBehind.match(/\B$/))) {
        return matches
      }
      return null
    },
    parse: capture => ({
      type: 'mention',
      content: capture[1],
    }),
    react: (node, output, state) => {
      return <Mention username={node.content} key={state.key} style={wrapStyle} />
    },
  },
  channel: {
    // Just needs to be a higher order than mentions
    order: SimpleMarkdown.defaultRules.autolink.order + 0.5,
    match: (source, state, lookBehind) => {
      const channelRegex = createChannelRegex(markdownMeta)
      if (!channelRegex) {
        return null
      }

      const matches = SimpleMarkdown.inlineRegex(channelRegex)(source, state, lookBehind)
      // Also check that the lookBehind is not text
      if (matches && (!lookBehind || lookBehind.match(/\B$/))) {
        return matches
      }

      return null
    },
    parse: capture => ({
      type: 'channel',
      content: capture[1],
      convID: channelNameToConvID(markdownMeta, capture[1]),
    }),
    react: (node, output, state) => {
      return (
        <Channel
          name={node.content}
          convID={Types.stringToConversationIDKey(node.convID)}
          key={state.key}
          style={linkStyle}
        />
      )
    },
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
    // original:
    // /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/
    // ours: stop on single new lines
    match: SimpleMarkdown.anyScopeRegex(/^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n|\w+:\S|$)/),
  },
  emoji: {
    order: SimpleMarkdown.defaultRules.text.order - 0.5,
    match: SimpleMarkdown.inlineRegex(emojiRegex),
    parse: function(capture, parse, state) {
      return {content: capture[0]}
    },
    react: (node, output, state) => {
      // TODO support big emoji
      return <EmojiIfExists emojiName={String(node.content)} size={16} key={state.key} />
    },
  },
  link: {
    order: SimpleMarkdown.defaultRules.newline.order + 0.5,
    match: (source, state, lookBehind) => {
      const matches = inlineLinkMatch(source, state, lookBehind)
      // If there is a match, let's also check if it's a valid tld
      if (matches && tldExp.exec(matches.groups.tld)) {
        return matches
      }
      return null
    },
    parse: function(capture, parse, state) {
      return {spaceInFront: capture[1], content: capture[2]}
    },
    react: (node, output, state) => {
      return (
        <>
          {node.spaceInFront}
          <Text
            className="hover-underline"
            type="BodyPrimaryLink"
            key={state.key}
            style={linkStyle}
            title={node.content}
            onClickURL={node.content}
          >
            {node.content}
          </Text>
        </>
      )
    },
  },
})

const parserFromMeta = (meta: ?MarkdownMeta) => SimpleMarkdown.parserFor(rules(meta))

// These cases use just the react properties so the meta doesn't matter
const rulesWithNoMeta = rules(null)
const reactOutput = SimpleMarkdown.reactFor(SimpleMarkdown.ruleOutput(rulesWithNoMeta, 'react'))
const bigEmojiOutput = SimpleMarkdown.reactFor(
  SimpleMarkdown.ruleOutput(
    {
      ...rulesWithNoMeta,
      emoji: {
        react: (node, output, state) => {
          return <EmojiIfExists emojiName={String(node.content)} size={32} key={state.key} />
        },
      },
    },
    'react'
  )
)

const previewOutput = SimpleMarkdown.reactFor(
  (ast: any, output: Function, state: any): any => {
    // leaf node is just the raw value, so it has no ast.type
    if (typeof ast !== 'object') {
      return ast
    }

    switch (ast.type) {
      case 'emoji':
        return rulesWithNoMeta.emoji.react(ast, output, state)
      case 'newline':
        return ' '
      case 'codeBlock':
        return ' ' + output(ast.content, state)
      default:
        return output(ast.content, state)
    }
  }
)

const isAllEmoji = ast => {
  const trimmed = ast.filter(n => n.type !== 'newline')
  // Only 1 paragraph
  if (trimmed.length === 1 && trimmed[0].content && trimmed[0].content.some) {
    // Is something in the content not an emoji?
    return !trimmed[0].content.some(n => n.type !== 'emoji')
  }
  return false
}

class SimpleMarkdownComponent extends PureComponent<Props> {
  render() {
    const parser = parserFromMeta(this.props.meta)
    const parseTree = parser((this.props.children || '') + '\n', {
      inline: false,
      // This flag adds 2 new lines at the end of our input. One is necessary to parse the text as a paragraph, but the other isn't
      // So we add our own new line
      disableAutoBlockNewlines: true,
    })

    return (
      <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, this.props.style])}>
        {this.props.preview ? (
          <Text type="BodySmall" style={neutralPreviewStyle}>
            {previewOutput(parseTree)}
          </Text>
        ) : isAllEmoji(parseTree) ? (
          bigEmojiOutput(parseTree)
        ) : (
          reactOutput(parseTree)
        )}
      </Text>
    )
  }
}

class OriginalMarkdown extends PureComponent<Props> {
  render() {
    const content = parseMarkdown(
      this.props.children,
      this.props.preview ? previewCreateComponent : messageCreateComponent,
      this.props.meta
    )
    return (
      <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, this.props.style])}>
        {content}
      </Text>
    )
  }
}

class Markdown extends PureComponent<Props> {
  render() {
    if (this.props.simple) {
      return <SimpleMarkdownComponent {...this.props} />
    } else {
      return <OriginalMarkdown {...this.props} />
    }
  }
}

const styles = Styles.styleSheetCreate({
  rootWrapper: Styles.platformStyles({
    isElectron: {
      whiteSpace: 'pre',
    },
  }),
})

export {parserFromMeta}

export default Markdown
