import * as Styles from '../../styles'
import React, {PureComponent} from 'react'
import SimpleMarkdown from 'simple-markdown'
import Text from '../text'
import logger from '../../logger'
import {Props as MarkdownProps} from '.'
import {emojiIndexByChar, emojiRegex, commonTlds} from './emoji-gen'
import {reactOutput, previewOutput, bigEmojiOutput, markdownStyles, serviceOnlyOutput} from './react'

function createKbfsPathRegex(): RegExp | null {
  const username = `(?:[a-zA-Z0-9]+_?)+` // from go/kbun/username.go
  const socialAssertion = `[-_a-zA-Z0-9.]+@[a-zA-Z.]+`
  const user = `(?:(?:${username})|(?:${socialAssertion}))`
  const usernames = `${user}(?:,${user})*`
  const teamName = `${username}(?:\\.${username})*`
  const tlfType = `/(?:private|public|team)`
  const tlf = `/(?:(?:private|public)/${usernames}(#${usernames})?|team/${teamName})`
  const inTlf = `/(?:\\\\\\\\|\\\\ |\\S)+`
  const specialFiles = `/(?:.kbfs_.+)`
  return new RegExp(`^(/keybase(?:(?:${tlf}(${inTlf})?)|(?:${tlfType})|(?:${specialFiles}))?/?)(?=\\s|$)`)
}

const kbfsPathMatcher = SimpleMarkdown.inlineRegex(createKbfsPathRegex())

const serviceBeginDecorationTag = '\\$\\>kb\\$'
const serviceEndDecorationTag = '\\$\\<kb\\$'
function createServiceDecorationRegex(): RegExp | null {
  return new RegExp(
    `^${serviceBeginDecorationTag}(((?!${serviceEndDecorationTag}).)*)${serviceEndDecorationTag}`
  )
}

const serviceDecorationMatcher = SimpleMarkdown.inlineRegex(createServiceDecorationRegex())

// Only allow a small set of characters before a url
const textMatch = SimpleMarkdown.anyScopeRegex(
  new RegExp(
    // [\s\S]+? any char, at least 1 - lazy
    // (?= // Positive look ahead. It should have these chars ahead
    //     // This is kinda weird, but for the regex to terminate it should have these cases be true ahead of its termination
    //   [^0-9A-Za-z\s] not a character in this set. So don't terminate if there is still more normal chars to eat
    //   | [\u00c0-\uffff] OR any unicode char. If there is a weird unicode ahead, we terminate
    //   | [\w-_.]+@ // OR something that looks like it starts an email. If there is an email looking thing ahead stop here.
    //   | (\w+\.)+(${commonTlds.join('|')}) // OR there is a url with a common tld ahead. Stop if there's a common url ahead
    //   | \w+:\S // OR there's letters before a : so stop here.
    //   | $ // OR we reach the end of the line
    // )
    `^[\\s\\S]+?(?=[^0-9A-Za-z\\s]|[\\u00c0-\\uffff]|[\\w-_.]+@|(\\w+\\.)+(${commonTlds.join(
      '|'
    )})|\\n|\\w+:\\S|$)`
  )
)

const wrapInParagraph = (parse, content, state) => [
  {
    content: SimpleMarkdown.parseInline(parse, content, {...state, inParagraph: true}),
    type: 'paragraph',
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
//
// TODO: Type rules. In particular, use a better type for State than
// that provided by simple-markdown, which is {[string]: any}.
const rules = {
  blockQuote: {
    ...SimpleMarkdown.defaultRules.blockQuote,
    // match: blockRegex(/^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/),
    // Original: A quote block only needs to start with > and everything in the same paragraph will be a quote
    // e.g. https://regex101.com/r/ZiDBsO/2
    // ours: Everything in the quote has to be preceded by >
    // unless it has the start of a fence
    // e.g. https://regex101.com/r/ZiDBsO/8
    match: (source, state, lookbehind) => {
      if (state.blockQuoteRecursionLevel > 6) {
        return null
      }
      const regex = /^( *>(?:[^\n](?!```))+\n?)+/
      // make sure the look behind is empty
      const emptyLookbehind = /^$|\n *$/

      const match = regex.exec(source)
      if (match && emptyLookbehind.exec(lookbehind)) {
        return match
      }
      return null
    },
    parse: (capture, parse, state) => {
      const content = capture[0].replace(/^ *> */gm, '')
      const blockQuoteRecursionLevel = state.blockQuoteRecursionLevel || 0
      const nextState = {...state, blockQuoteRecursionLevel: blockQuoteRecursionLevel + 1}

      return {
        content: parse(content, nextState),
      }
    },
  },
  del: {
    ...SimpleMarkdown.defaultRules.del,
    // original:
    // match: inlineRegex(/^~~(?=\S)([\s\S]*?\S)~~/),
    // ours: single tilde doesn't cross a newline
    match: wordBoundryLookBehindMatch(SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\\n])+?)~(?!~)/)),
  },
  em: {
    ...SimpleMarkdown.defaultRules.em,
    // original is pretty long so not inlining it here
    // ours: wrapped in _'s
    match: wordBoundryLookBehindMatch(SimpleMarkdown.inlineRegex(/^_((?:\\[\s\S]|[^\\\n])+?)_(?!_)/)),
  },
  emoji: {
    match: SimpleMarkdown.inlineRegex(emojiRegex),
    order: SimpleMarkdown.defaultRules.text.order - 0.5,
    parse: function(capture, _, __) {
      // If it's a unicode emoji, let's get it's shortname
      const shortName = emojiIndexByChar[capture[0]]
      return {content: shortName || capture[0]}
    },
  },
  escape: {
    // handle escaped chars, keep this to handle escapes globally
    ...SimpleMarkdown.defaultRules.escape,
  },
  // we prevent matching against text if we're mobile and we aren't in a paragraph. This is because
  // in Mobile you can't have text outside a text tag, and a paragraph is what adds the text tag.
  // This is just a fallback (note the order) in case nothing else matches. It wraps the content in
  // a paragraph and tries to match again. Won't fallback on itself. If it's already in a paragraph,
  // it won't match.
  fallbackParagraph: {
    // $FlowIssue - tricky to get this to type properly
    match: (source, state, _) => (Styles.isMobile && !state.inParagraph ? [source] : null),
    order: 10000,
    parse: (capture, parse, state) => wrapInParagraph(parse, capture[0], state),
  },
  fence: {
    // aka the ``` code blocks
    ...SimpleMarkdown.defaultRules.fence,
    match: SimpleMarkdown.anyScopeRegex(/^```(?:\n)?((?:\\[\s\S]|[^\\])+?)```(?!`)(\n)?/),
    // original:
    // match: SimpleMarkdown.blockRegex(/^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n/),
    // ours: three ticks (anywhere) and remove any newlines in front and one in back
    order: 0,
    parse: function(capture, _, __) {
      return {
        content: capture[1],
        lang: undefined,
        type: 'fence',
      }
    },
  },
  inlineCode: {
    ...SimpleMarkdown.defaultRules.inlineCode,
    // original:
    // match: inlineRegex(/^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/),
    // ours: only allow a single backtick
    match: SimpleMarkdown.inlineRegex(/^(`)(?!`)\s*(?!`)([\s\S]*?[^`\n])\s*\1(?!`)/),
  },
  kbfsPath: {
    match: (source, state, lookBehind) => {
      const matches = kbfsPathMatcher(source, state, lookBehind)
      // Also check that the lookBehind is not text
      if (matches && (!lookBehind || lookBehind.match(/\B$/))) {
        return matches
      }
      return null
    }, // lower than mention
    order: SimpleMarkdown.defaultRules.autolink.order - 0.1,
    parse: capture => ({
      content: capture[1],
      type: 'kbfsPath',
    }),
  },
  newline: {
    // handle newlines, keep this to handle \n w/ other matchers
    ...SimpleMarkdown.defaultRules.newline,
    // original
    // match: blockRegex(/^(?:\n *)*\n/),
    // ours: handle \n inside text also
    match: SimpleMarkdown.anyScopeRegex(/^\n/),
  },
  paragraph: {
    ...SimpleMarkdown.defaultRules.paragraph,
    // original:
    // match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks, stop before a block quote or a code block (aka fence)
    match: SimpleMarkdown.blockRegex(/^((?:[^\n`]|(?:`(?!``))|\n(?!(?: *\n| *>)))+)\n?/),
    parse: (capture, parse, state) => {
      // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
      const content = Styles.isMobile ? capture[1].replace(/\n$/, '') : capture[1]
      return {
        content: SimpleMarkdown.parseInline(parse, content, {...state, inParagraph: true}),
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
    match: SimpleMarkdown.anyScopeRegex(/^(?: *> *((?:[^\n](?!```))*)) ```\n?((?:\\[\s\S]|[^\\])+?)```\n?/),
    // Example: https://regex101.com/r/ZiDBsO/6
    order: SimpleMarkdown.defaultRules.blockQuote.order - 0.5,
    parse: function(capture, parse, state) {
      const preContent =
        Styles.isMobile && !!capture[1]
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
  serviceDecoration: {
    match: (source, state, lookBehind) => {
      return serviceDecorationMatcher(source, state, lookBehind)
    },
    order: 1,
    parse: capture => ({
      content: capture[1],
      type: 'serviceDecoration',
    }),
  },
  strong: {
    ...SimpleMarkdown.defaultRules.strong,
    // original
    // match: inlineRegex(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
    // ours: single stars
    match: wordBoundryLookBehindMatch(SimpleMarkdown.inlineRegex(/^\*((?:\\[\s\S]|[^\\\n])+?)\*(?!\*)/)),
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
    // original:
    // /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/
    // ours: stop on single new lines and common tlds. We want to stop at common tlds so this regex doesn't
    // consume the common case of saying: Checkout google.com, they got all the cool gizmos.
    match: (source, state, lookBehind) =>
      Styles.isMobile && !state.inParagraph ? null : textMatch(source, state, lookBehind),
  },
}

const simpleMarkdownParser = SimpleMarkdown.parserFor(rules)

const isAllEmoji = ast => {
  const trimmed = ast.filter(n => n.type !== 'newline')
  // Only 1 paragraph
  if (trimmed.length === 1 && trimmed[0].content && trimmed[0].content.some) {
    // Is something in the content not an emoji?
    return !trimmed[0].content.some(n => n.type !== 'emoji' && n.type !== 'newline')
  }
  return false
}

class SimpleMarkdownComponent extends PureComponent<
  MarkdownProps,
  {
    hasError: boolean
  }
> {
  state = {hasError: false}

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return {hasError: true}
  }

  componentDidCatch(error: Error) {
    logger.error('Error rendering markdown')
    logger.debug('Error rendering markdown', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, markdownStyles.wrapStyle])}>
          {this.props.children || ''}
        </Text>
      )
    }
    const {allowFontScaling, styleOverride = {}} = this.props
    let parseTree
    let output
    try {
      parseTree = simpleMarkdownParser((this.props.children || '').trim() + '\n', {
        // This flag adds 2 new lines at the end of our input. One is necessary to parse the text as a paragraph, but the other isn't
        // So we add our own new line
        disableAutoBlockNewlines: true,
        inline: false,
        markdownMeta: this.props.meta,
      })

      const state = {
        allowFontScaling,
        markdownMeta: this.props.meta,
        styleOverride,
      }

      output = this.props.serviceOnly
        ? serviceOnlyOutput(parseTree, state)
        : this.props.preview
        ? previewOutput(parseTree)
        : isAllEmoji(parseTree) && !this.props.smallStandaloneEmoji
        ? bigEmojiOutput(parseTree, state)
        : reactOutput(parseTree, state)
    } catch (e) {
      logger.error('Error parsing markdown')
      logger.debug('Error parsing markdown', e)
      return (
        <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, markdownStyles.wrapStyle])}>
          {this.props.children || ''}
        </Text>
      )
    }
    const inner = this.props.serviceOnly ? (
      <Text type="Body" style={this.props.style}>
        {output}
      </Text>
    ) : this.props.preview ? (
      <Text
        type={Styles.isMobile ? 'Body' : 'BodySmall'}
        style={Styles.collapseStyles([
          markdownStyles.neutralPreviewStyle,
          this.props.style,
          styleOverride.preview,
        ])}
        lineClamp={1}
      >
        {output}
      </Text>
    ) : (
      output
    )

    // Mobile doesn't use a wrapper
    return Styles.isMobile ? (
      inner
    ) : (
      <Text
        type="Body"
        lineClamp={this.props.lineClamp}
        style={Styles.collapseStyles([styles.rootWrapper, this.props.style])}
        selectable={this.props.selectable}
      >
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

export {SimpleMarkdownComponent, simpleMarkdownParser}
