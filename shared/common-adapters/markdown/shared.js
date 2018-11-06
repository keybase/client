// @flow
import logger from '../../logger'
import * as Styles from '../../styles'
import React, {PureComponent} from 'react'
import {isMobile} from '../../constants/platform'
import Text from '../text'
import {
  reactOutputFontScaling,
  reactOutputNoFontScaling,
  previewOutput,
  bigEmojiOutputForFontScaling,
  markdownStyles,
} from './react'
import {type ConversationIDKey} from '../../constants/types/chat2'
import {isSpecialMention, specialMentions} from '../../constants/chat2'
import parser, {isPlainText, emojiIndexByChar} from '../../markdown/parser'
import {emojiRegex} from '../../markdown/emoji'
import {tldExp, commonTlds} from '../../markdown/regex'
import SimpleMarkdown from 'simple-markdown'

import type {MarkdownCreateComponent, MarkdownMeta, Props as MarkdownProps} from '../markdown'

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

function createMentionRegex(meta: ?MarkdownMeta): ?RegExp {
  if (!meta || !meta.mentionsAt || !meta.mentionsChannel) {
    return null
  }

  if (meta.mentionsChannel === 'none' && meta.mentionsAt.isEmpty()) {
    return null
  }

  return new RegExp(`^@(${[...specialMentions, ...meta.mentionsAt.toArray()].join('|')})\\b`)
}

function createChannelRegex(meta: ?MarkdownMeta): ?RegExp {
  if (!meta || !meta.mentionsChannelName || meta.mentionsChannelName.isEmpty()) {
    return null
  }

  return new RegExp(`^#(${meta.mentionsChannelName.keySeq().join('|')})\\b`)
}

function channelNameToConvID(meta: ?MarkdownMeta, channel: string): ?ConversationIDKey {
  return meta && meta.mentionsChannelName && meta.mentionsChannelName.get(channel)
}

function parseMarkdown(
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

// TODO, when named groups are supported on mobile, we can use this instead
// const linkRegex = /^( *)((https?:\/\/)?[\w-]+(?<tld>\.[\w-]+)+\.?(:\d+)?(\/\S*)?)\b/i
// This copies the functionality of this named group
// $FlowIssue treat this like a RegExp
const linkRegex: RegExp = {
  exec: source => {
    const r = /^( *)((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)\b/i
    const result = r.exec(source)
    if (result) {
      result.groups = {tld: result[4]}
      return result
    }
    return null
  },
}
const inlineLinkMatch = SimpleMarkdown.inlineRegex(linkRegex)

const wrapInParagraph = (parse, content, state) => [
  {
    type: 'paragraph',
    content: SimpleMarkdown.parseInline(parse, content, state),
  },
]

const wordBoundaryLookBehind = /\B$/
// Wraps the match to also check that the behind is not a text, but a boundary (like a space)
// i.e. "foo" fails but "foo " passes.
const wordBoundryLookBehindMatch = matchFn => (source, state, lookbehind) => {
  if (wordBoundaryLookBehind.exec(lookbehind)) {
    return matchFn(source, state, lookbehind)
  }
}

// Rules are defined here, the react components for these types are defined in markdown-react.js
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
        type: 'fence',
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
    match: SimpleMarkdown.anyScopeRegex(/^(?: *> *((?:[^\n](?!```))*)) ```\n?((?:\\[\s\S]|[^\\])+?)```\n?/),
    parse: function(capture, parse, state) {
      const preContent =
        isMobile && !!capture[1]
          ? wrapInParagraph(parse, capture[1], state)
          : SimpleMarkdown.parseInline(parse, capture[1], state)
      return {
        content: [
          ...preContent,
          {
            content: capture[2],
            type: 'fence',
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
    // ours: only allow a single backtick
    match: SimpleMarkdown.inlineRegex(/^(`)(?!`)\s*([\s\S]*?[^`\n])\s*\1(?!`)/),
  },
  paragraph: {
    ...SimpleMarkdown.defaultRules.paragraph,
    // original:
    // match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks, stop before a block quote or a code block (aka fence)
    match: SimpleMarkdown.blockRegex(/^((?:[^\n`]|(?:`(?!``))|\n(?!(?: *\n| *>)))+)\n?/),
    parse: (capture, parse, state) => {
      // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
      const content = isMobile ? capture[1].replace(/\n$/, '') : capture[1]
      return {
        content: SimpleMarkdown.parseInline(parse, content, state),
      }
    },
  },
  strong: {
    ...SimpleMarkdown.defaultRules.strong,
    // original
    // match: inlineRegex(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
    // ours: single stars
    match: wordBoundryLookBehindMatch(SimpleMarkdown.inlineRegex(/^\*((?:\\[\s\S]|[^\\])+?)\*(?!\*)/)),
  },
  em: {
    ...SimpleMarkdown.defaultRules.em,
    // original is pretty long so not inlining it here
    // ours: wrapped in _'s
    match: wordBoundryLookBehindMatch(SimpleMarkdown.inlineRegex(/^_((?:\\[\s\S]|[^\\])+?)_(?!_)/)),
  },
  del: {
    ...SimpleMarkdown.defaultRules.del,
    // original:
    // match: inlineRegex(/^~~(?=\S)([\s\S]*?\S)~~/),
    // ours: single tilde doesn't cross a newline
    match: wordBoundryLookBehindMatch(SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\\n])+?)~(?!~)/)),
  },
  blockQuote: {
    ...SimpleMarkdown.defaultRules.blockQuote,
    // match: blockRegex(/^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/),
    // Original: A quote block only needs to start with > and everything in the same paragraph will be a quote
    // e.g. https://regex101.com/r/ZiDBsO/2
    // ours: Everything in the quote has to be preceded by >
    // unless it has the start of a fence
    // e.g. https://regex101.com/r/ZiDBsO/8
    parse: (capture, parse, state) => {
      const content = capture[0].replace(/^ *> ?/gm, '')
      // On mobile we can't have text that isn't wrapped in a Text tag
      if (isMobile) {
        return {
          // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
          content: wrapInParagraph(parse, content.replace(/\n$/, ''), state),
        }
      }
      return {
        content: parse(content, state),
      }
    },
    match: (source, state, lookbehind) => {
      const regex = /^( *>(?:[^\n](?!```))+\n?)+/
      // make sure the look behind is empty
      const emptyLookbehind = /^$|\n *$/

      const match = regex.exec(source)
      if (match && emptyLookbehind.exec(lookbehind)) {
        return match
      }
      return null
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
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
    // original:
    // /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/
    // ours: stop on single new lines and common tlds. We want to stop at common tlds so this regex doesn't
    // consume the common case of saying: Checkout google.com, they got all the cool gizmos.
    match: SimpleMarkdown.anyScopeRegex(
      new RegExp(
        `^[\\s\\S]+?(?=[^0-9A-Za-z\\s]|[\\u00c0-\\uffff]|\\w+\\.(${commonTlds.join('|')})|\\n|\\w+:\\S|$)`
      )
    ),
  },
  emoji: {
    order: SimpleMarkdown.defaultRules.text.order - 0.5,
    match: SimpleMarkdown.inlineRegex(emojiRegex),
    parse: function(capture, parse, state) {
      // If it's a unicode emoji, let's get it's shortname
      const shortName = emojiIndexByChar[capture[0]]
      return {content: shortName || capture[0]}
    },
  },
  link: {
    order: SimpleMarkdown.defaultRules.newline.order + 0.5,
    match: (source, state, lookBehind) => {
      const matches = inlineLinkMatch(source, state, lookBehind)
      // If there is a match, let's also check if it's a valid tld
      if (matches && matches.groups && tldExp.exec(matches.groups.tld)) {
        return matches
      }
      return null
    },
    parse: function(capture, parse, state) {
      return {spaceInFront: capture[1], content: capture[2]}
    },
  },
})

const parserFromMeta = (meta: ?MarkdownMeta) => SimpleMarkdown.parserFor(rules(meta))

const isAllEmoji = ast => {
  const trimmed = ast.filter(n => n.type !== 'newline')
  // Only 1 paragraph
  if (trimmed.length === 1 && trimmed[0].content && trimmed[0].content.some) {
    // Is something in the content not an emoji?
    return !trimmed[0].content.some(n => n.type !== 'emoji' && n.type !== 'newline')
  }
  return false
}

class SimpleMarkdownComponent extends PureComponent<MarkdownProps> {
  render() {
    const parser = parserFromMeta(this.props.meta)
    const reactOutput = this.props.allowFontScaling ? reactOutputFontScaling : reactOutputNoFontScaling
    const parseTree = parser((this.props.children || '').trim() + '\n', {
      inline: false,
      // This flag adds 2 new lines at the end of our input. One is necessary to parse the text as a paragraph, but the other isn't
      // So we add our own new line
      disableAutoBlockNewlines: true,
    })
    const inner = this.props.preview ? (
      <Text
        type={isMobile ? 'Body' : 'BodySmall'}
        style={markdownStyles.neutralPreviewStyle}
        lineClamp={isMobile ? 1 : undefined}
      >
        {previewOutput(parseTree)}
      </Text>
    ) : isAllEmoji(parseTree) ? (
      bigEmojiOutputForFontScaling(!!this.props.allowFontScaling)(parseTree)
    ) : (
      reactOutput(parseTree)
    )

    // Mobile doesn't use a wrapper
    return isMobile ? (
      inner
    ) : (
      <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, this.props.style])}>
        {inner}
      </Text>
    )
  }
}

const styles = Styles.styleSheetCreate({
  rootWrapper: Styles.platformStyles({
    isElectron: {
      whiteSpace: 'pre',
    },
  }),
})

export {
  SimpleMarkdownComponent,
  channelNameToConvID,
  createChannelRegex,
  createMentionRegex,
  isValidMention,
  parseMarkdown,
  parserFromMeta,
}
