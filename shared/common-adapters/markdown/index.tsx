import * as Styles from '@/styles'
import * as React from 'react'
import * as SM from '@khanacademy/simple-markdown'
import Text from '@/common-adapters/text'
import logger from '@/logger'
import type {Props as MarkdownProps} from '.'
import Emoji, {type Props as EmojiProps} from '../emoji'
import {emojiIndexByName, emojiIndexByChar, emojiRegex, commonTlds} from './emoji-gen'
import {
  reactOutput,
  previewOutput,
  bigEmojiOutput,
  markdownStyles,
  serviceOnlyOutput,
  serviceOnlyNoWrapOutput,
} from './react'
import type * as T from '@/constants/types'
import type {StylesTextCrossPlatform, LineClampType} from '@/common-adapters/text'
import isArray from 'lodash/isArray'
import {ErrorBoundary} from 'react-error-boundary'

const SimpleMarkdown = SM.default

type MarkdownComponentType =
  | 'inline-code'
  | 'code-block'
  | 'link'
  | 'text'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'emoji'
  | 'native-emoji'
  | 'quote-block'

export type MarkdownCreateComponent = (
  type: MarkdownComponentType,
  key: string,
  children: Array<React.ReactNode>,
  options: {
    href?: string
    convID?: string
    bigEmoji?: boolean
  }
) => React.ReactNode

export type MarkdownMeta = {
  message: T.Chat.MessageText | T.Chat.MessageAttachment
}

export type StyleOverride = {
  paragraph?: StylesTextCrossPlatform
  fence?: StylesTextCrossPlatform
  inlineCode?: StylesTextCrossPlatform
  strong?: StylesTextCrossPlatform
  em?: StylesTextCrossPlatform
  emojiSize?: {size: 22 | 16 | 18 | 32 | 24 | 26 | 28 | 36}
  del?: StylesTextCrossPlatform
  link?: StylesTextCrossPlatform
  mailto?: StylesTextCrossPlatform
  preview?: StylesTextCrossPlatform
  kbfsPath?: StylesTextCrossPlatform
  emoji?: StylesTextCrossPlatform
  customEmoji?: StylesTextCrossPlatform
}

export type Props = {
  context?: string // metadata used for bookkeeping
  children?: string
  lineClamp?: LineClampType
  selectable?: boolean // desktop - applies to outer container only
  smallStandaloneEmoji?: boolean // don't increase font size for a standalone emoji
  paragraphTextClassName?: string
  preview?: boolean // if true render a simplified version
  serviceOnly?: boolean // only render stuff from the service
  serviceOnlyNoWrap?: boolean // only render stuff from the service, no wrapper
  disallowAnimation?: boolean // only if serviceOnly

  // Style only styles the top level container.
  // This is only useful in desktop because of cascading styles and there is a top level wrapper.
  // Mobile doesn't have this wrapper (on purpose), so if you want to style the container, do it
  // at a higher level.
  //
  // You can also use this to style previews which has a single top level wrapper, but it's
  // preferred to use the props.styleOverride.preview flag for this
  //
  // TODO type this up or remove it
  style?: Styles.StylesCrossPlatform
  allowFontScaling?: boolean
  messageType?: T.Chat.MessageType
  // This changes the specific style for specific types of text
  // for example you may want to make paragraphs, italics, etc to be black_50
  // but want blue_30 for the inline code
  styleOverride?: StyleOverride

  virtualText?: boolean // desktop only, see text.desktop
}

const serviceBeginDecorationTag = /\$>kb\$/
const serviceEndDecorationTag = /\$<kb\$/
const serviceDecorationRegex = new RegExp(
  `^${serviceBeginDecorationTag.source}(((?!${serviceEndDecorationTag.source}).)*)${serviceEndDecorationTag.source}`
)

const serviceDecorationMatcher = SimpleMarkdown.inlineRegex(serviceDecorationRegex)

const makeTextRegexp = () => {
  const anyCharOne = /^[\s\S]+?/ // [\s\S]+? any char, at least 1 - lazy
  // (?= // Positive look ahead. It should have these chars ahead
  // This is kinda weird, but for the regex to terminate it should have these cases be true ahead of its termination

  // [^0-9A-Za-z\s] not a character in this set. So don't terminate if there is still more normal chars to eat
  const notNormal = /[^0-9A-Za-z\s]/
  // [\u00c0-\uffff] OR any unicode char. If there is a weird unicode ahead, we terminate
  const anyUnicode = /[\u00c0-\uffff]/
  // [\w-_.]+@ // OR something that looks like it starts an email. If there is an email looking thing ahead stop here.
  const emaily = /[\w-_.]+@/
  // (\w+\.)+(${commonTlds.join('|')}) // OR there is a url with a common tld ahead. Stop if there's a common url ahead
  const tldsPrefix = /(\w+\.)+/
  const tldsPosfix = new RegExp(`(${commonTlds.join('|')})`)
  const tlds = new RegExp([tldsPrefix.source, tldsPosfix.source].join(''))
  const newline = /\n/
  // | \w+:\S // OR there's letters before a : so stop here.
  const lettersColon = /\w+:\S/
  const end = /$/ //   | $ // OR we reach the end of the line
  return new RegExp(
    `${anyCharOne.source}(?=${[
      notNormal.source,
      anyUnicode.source,
      emaily.source,
      tlds.source,
      newline.source,
      lettersColon.source,
      end.source,
    ].join('|')})`
  )
}
// Only allow a small set of characters before a url
const textMatch = SimpleMarkdown.anyScopeRegex(makeTextRegexp())

const wrapInParagraph = (parse: SM.Parser, content: string, state: SM.State): Array<SM.SingleASTNode> => {
  const oldInParagraph = state['inParagraph'] as boolean
  state['inParagraph'] = true
  const ret = [{content: SimpleMarkdown.parseInline(parse, content, state), type: 'paragraph'}]
  state['inParagraph'] = oldInParagraph
  return ret
}

const wordBoundaryLookBehind = /\B$/
// Wraps the match to also check that the behind is not a text, but a boundary (like a space)
// i.e. "foo" fails but "foo " passes.
const wordBoundryLookBehindMatch =
  (matchFn: SM.MatchFunction) => (source: string, state: SM.State, prevCapture: string) => {
    if (wordBoundaryLookBehind.test(prevCapture)) {
      return matchFn(source, state, prevCapture)
    }
    return null
  }

// Rules are defined here, the react components for these types are defined in markdown-react.js
const rules: {[type: string]: SM.ParserRule} = {
  blockQuote: {
    ...SimpleMarkdown.defaultRules.blockQuote,
    // match: blockRegex(/^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/),
    // Original: A quote block only needs to start with > and everything in the same paragraph will be a quote
    // e.g. https://regex101.com/r/ZiDBsO/2
    // ours: Everything in the quote has to be preceded by >
    // unless it has the start of a fence
    // e.g. https://regex101.com/r/ZiDBsO/8
    match: (source: string, state: SM.State, prevCapture: string): SM.Capture | null => {
      if (state['blockQuoteRecursionLevel'] > 6) {
        return null
      }
      const regex = /^( *>(?:[^\n](?!```))+\n?)+/
      // make sure the look behind is empty
      const emptyLookbehind = /^$|\n *$/

      const match = regex.exec(source)
      if (match && emptyLookbehind.test(prevCapture)) {
        return match
      }
      return null
    },
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) => {
      const content = capture[0]?.replace(/^ *> */gm, '') ?? ''
      const oldBlockQuoteRecursionLevel: number = state['blockQuoteRecursionLevel'] || 0
      state['blockQuoteRecursionLevel'] = oldBlockQuoteRecursionLevel + 1
      const ret = {content: nestedParse(content, state)}
      state['blockQuoteRecursionLevel'] = oldBlockQuoteRecursionLevel
      return ret
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
    parse: (capture: SM.Capture, _nestedParse: SM.Parser, _state: SM.State) => {
      // If it's a unicode emoji, let's get it's shortname
      const shortName = emojiIndexByChar[capture[0] ?? '']
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
    match: (source: string, state: SM.State, _prevCapture: string) =>
      Styles.isMobile && !state['inParagraph'] ? [source] : null,
    order: 10000,
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) =>
      wrapInParagraph(nestedParse, capture[0] ?? '', state),
  },
  fence: {
    // aka the ``` code blocks
    ...SimpleMarkdown.defaultRules.fence,
    match: SimpleMarkdown.anyScopeRegex(/^```(?:\n)?((?:\\[\s\S]|[^\\])+?)```(?!`)(\n)?/),
    // original:
    // match: SimpleMarkdown.blockRegex(/^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n/),
    // ours: three ticks (anywhere) and remove any newlines in front and one in back
    order: 0,
    parse: function (capture: SM.Capture, _nestedParse: SM.Parser, _state: SM.State) {
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
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) => {
      // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
      const content = Styles.isMobile ? capture[1]?.replace(/\n$/, '') ?? '' : capture[1] ?? ''
      const oldInParagraph = state['inParagraph'] as boolean
      state['inParagraph'] = true
      const ret = {content: SimpleMarkdown.parseInline(nestedParse, content, state)}
      state['inParagraph'] = oldInParagraph
      return ret
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
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) => {
      const preContent: Array<SM.SingleASTNode> =
        Styles.isMobile && !!capture[1]
          ? wrapInParagraph(nestedParse, capture[1], state)
          : (SimpleMarkdown.parseInline(nestedParse, capture[1] ?? '', state) as Array<SM.SingleASTNode>)
      return {
        content: [...preContent, {content: capture[2], type: 'fence'}],
        type: 'blockQuote',
      }
    },
  },
  serviceDecoration: {
    match: (source: string, state: SM.State, prevCapture: string) => {
      return serviceDecorationMatcher(source, state, prevCapture)
    },
    order: 1,
    parse: (capture: SM.Capture, _nestedParse: SM.Parser, _state: SM.State) => ({
      content: capture[1],
      type: 'serviceDecoration',
    }),
  },
  spoiler: {
    match: SimpleMarkdown.inlineRegex(/^!>(.*?)<!/),
    order: 2,
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) => ({
      content: nestedParse(capture[1] || '', state),
      raw: capture[1],
      type: 'spoiler',
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
    match: (source: string, state: SM.State, prevCapture: string) =>
      Styles.isMobile && !state['inParagraph'] ? null : textMatch(source, state, prevCapture),
  },
}

const simpleMarkdownParser = SimpleMarkdown.parserFor(rules)

const noRules: {[type: string]: SM.ParserRule} = {
  // we prevent matching against text if we're mobile and we aren't in a paragraph. This is because
  // in Mobile you can't have text outside a text tag, and a paragraph is what adds the text tag.
  // This is just a fallback (note the order) in case nothing else matches. It wraps the content in
  // a paragraph and tries to match again. Won't fallback on itself. If it's already in a paragraph,
  // it won't match.
  fallbackParagraph: {
    match: (source: string, state: SM.State, _prevCapture: string) =>
      Styles.isMobile && !state['inParagraph'] ? [source] : null,
    order: 10000,
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) =>
      wrapInParagraph(nestedParse, capture[0] ?? '', state),
  },
  paragraph: {
    ...SimpleMarkdown.defaultRules.paragraph,
    // original:
    // match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks, stop before a block quote or a code block (aka fence)
    match: SimpleMarkdown.blockRegex(/^((?:[^\n`]|(?:`(?!``))|\n(?!(?: *\n| *>)))+)\n?/),
    parse: (capture: SM.Capture, nestedParse: SM.Parser, state: SM.State) => {
      // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
      const content = (Styles.isMobile ? capture[1]?.replace(/\n$/, '') : capture[1]) ?? ''
      const oldInParagraph = state['inParagraph'] as boolean
      state['inParagraph'] = true
      const ret = {content: SimpleMarkdown.parseInline(nestedParse, content, state)}
      state['inParagraph'] = oldInParagraph
      return ret
    },
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
    // original:
    // /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/
    // ours: stop on single new lines and common tlds. We want to stop at common tlds so this regex doesn't
    // consume the common case of saying: Checkout google.com, they got all the cool gizmos.
    match: (source: string, state: SM.State, _prevCapture: string) =>
      Styles.isMobile && !state['inParagraph'] ? null : [source],
  },
}
const noMarkdownParser = SimpleMarkdown.parserFor(noRules)

const isAllEmoji = (ast: Array<SM.SingleASTNode>) => {
  let emojiLine = 0
  for (const node of ast) {
    if (node.type === 'newline') {
      continue // ignore newline
    }
    const c = node['content'] as Array<{type: string}> | string
    if (!isArray(c) || c.some(n => n.type !== 'emoji' && n.type !== 'newline')) {
      return false // non-emoji, done
    }

    emojiLine++
    if (emojiLine > 1) {
      return false // too many, done
    }
  }

  return emojiLine === 1
}

const tooLong = 10000
const fastMDReg = /[*_`@#]/

const shouldUseParser = (s: string) => {
  if (s.length < tooLong) return true
  return s.search(fastMDReg) !== -1
}

const ErrorComponent = (p: {children: React.ReactNode}) => {
  const {children} = p
  return (
    <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, markdownStyles.wrapStyle] as const)}>
      {children ?? ''}
    </Text>
  )
}

const SimpleMarkdownComponent = React.memo(function SimpleMarkdownComponent(p: MarkdownProps) {
  const {allowFontScaling, styleOverride = {}, paragraphTextClassName, messageType, children} = p
  const {serviceOnly, preview, smallStandaloneEmoji, virtualText, lineClamp, style, selectable} = p
  const {serviceOnlyNoWrap, disallowAnimation, context} = p
  let parseTree: Array<SM.SingleASTNode>
  let output: React.ReactNode
  try {
    const options = {
      // This flag adds 2 new lines at the end of our input. One is necessary to parse the text as a paragraph, but the other isn't
      // So we add our own new line
      disableAutoBlockNewlines: true,
      inline: false,
      messageType,
    }

    parseTree = (() => {
      switch (true) {
        case shouldUseParser(children ?? ''):
          return simpleMarkdownParser((children || '').trim() + '\n', options)
        default:
          return noMarkdownParser(children + '\n', options)
      }
    })()

    const state = {
      allowFontScaling,
      context,
      disallowAnimation,
      messageType,
      paragraphTextClassName,
      styleOverride,
      virtualText,
    }

    output = (() => {
      switch (true) {
        case serviceOnlyNoWrap:
          return serviceOnlyNoWrapOutput(parseTree, state)
        case serviceOnly:
          return serviceOnlyOutput(parseTree, state)
        case preview:
          return previewOutput(parseTree, state)
        case !smallStandaloneEmoji && isAllEmoji(parseTree):
          return bigEmojiOutput(parseTree, state)
        default:
          return reactOutput(parseTree, state)
      }
    })()
  } catch (e) {
    logger.error('Error parsing markdown')
    logger.debug('Error parsing markdown', e)
    return <ErrorComponent>{children}</ErrorComponent>
  }

  const inner = (() => {
    switch (true) {
      case serviceOnlyNoWrap:
        return output
      case serviceOnly:
        return (
          <Text className={paragraphTextClassName} type="Body" style={style} lineClamp={lineClamp}>
            {output}
          </Text>
        )
      case preview:
        return (
          <Text
            className={paragraphTextClassName}
            type={Styles.isMobile ? 'Body' : 'BodySmall'}
            style={Styles.collapseStyles([markdownStyles.neutralPreviewStyle, style, styleOverride.preview])}
            lineClamp={1 as const}
          >
            {output}
          </Text>
        )
      default:
        return output
    }
  })()

  // Mobile doesn't use a wrapper
  return (
    <ErrorBoundary fallback={<ErrorComponent>{children}</ErrorComponent>}>
      {Styles.isMobile ? (
        inner
      ) : (
        <Text
          className={paragraphTextClassName}
          type="Body"
          lineClamp={lineClamp}
          style={Styles.collapseStyles([styles.rootWrapper, style])}
          selectable={selectable}
        >
          {inner}
        </Text>
      )}
    </ErrorBoundary>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  rootWrapper: Styles.platformStyles({
    isElectron: {whiteSpace: 'pre'},
  }),
}))

// TODO kill this when we remove the old markdown parser. This check is done at the parsing level.
export const EmojiIfExists = React.memo(function EmojiIfExists(
  props: EmojiProps & {
    paragraphTextClassName?: string
    style?: Styles.StylesCrossPlatform
    allowFontScaling?: boolean
    lineClamp?: LineClampType
  }
) {
  const emojiNameLower = props.emojiName.toLowerCase()
  const exists = !!emojiIndexByName[emojiNameLower]
  return exists ? (
    <Emoji emojiName={emojiNameLower} size={props.size} allowFontScaling={props.allowFontScaling} />
  ) : (
    <SimpleMarkdownComponent
      paragraphTextClassName={props.paragraphTextClassName}
      style={props.style}
      lineClamp={props.lineClamp}
      allowFontScaling={props.allowFontScaling}
    >
      {props.emojiName}
    </SimpleMarkdownComponent>
  )
})

export default SimpleMarkdownComponent
