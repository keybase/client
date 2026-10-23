import * as Styles from '@/styles'
import type * as React from 'react'
import {
  anyScopeRegex,
  blockRegex,
  indexAhead,
  memoFor,
  inlineRegex,
  parseInline,
  parserFor,
  type Capture,
  type MatchFunction,
  type Parser,
  type ParserRule,
  type SingleASTNode,
  type State as EngineState,
} from './engine'
import {BareErrorBoundary} from '@/common-adapters/error-boundary'
import Text from '@/common-adapters/text'
import logger from '@/logger'
import {emojiIndexByChar, emojiIndexByName, emojiRegex, emojiUnicodeRegex, commonTlds} from './emoji-gen'
import {
  reactOutput,
  previewOutput,
  bigEmojiOutput,
  markdownStyles,
  serviceOnlyOutput,
  serviceOnlyNoWrapOutput,
} from './react'
import type * as T from '@/constants/types'
import type {StylesTextCrossPlatform, LineClampType} from '@/common-adapters/text.shared'

type State = EngineState & {
  blockQuoteRecursionLevel?: number
  isMobile?: boolean
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
  selectable?: boolean
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

export type ParseMarkdownOptions = {
  isMobile?: boolean
  messageType?: T.Chat.MessageType
  shouldUseMarkdownParser?: boolean
}

export type MarkdownOutputKind =
  | 'serviceOnlyNoWrap'
  | 'serviceOnly'
  | 'preview'
  | 'bigEmoji'
  | 'default'

const serviceBeginDecorationTag = /\$>kb\$/
const serviceEndDecorationTag = /\$<kb\$/
const serviceDecorationRegex = new RegExp(
  `^${serviceBeginDecorationTag.source}(((?!${serviceEndDecorationTag.source}).)*)${serviceEndDecorationTag.source}`
)

const serviceEndDecorationTagAhead = new RegExp(serviceEndDecorationTag.source, 'g')
const spoilerRegex = /^!>(.*?)<!/
const spoilerEndAhead = /<!/g
// the line ends a regex `.` won't cross
const lineEndAhead = /[\n\r\u2028\u2029]/g

// For a rule shaped `opener (.*) closer`: the regex can only match if the first closer after the
// opener comes before the line ends, and then it always does. Checking that first means a line full
// of openers doesn't rescan the rest of the line at every one of them.
const closesOnLine = (state: State, closerAhead: RegExp, openerLength: number) => {
  const close = indexAhead(state, closerAhead, openerLength)
  if (close === -1) {
    return false
  }
  const lineEnd = indexAhead(state, lineEndAhead, openerLength)
  return lineEnd === -1 || lineEnd > close
}

// Text runs up to (not including) the first position after its first char where one of these is
// ahead. Whether it stops at a position only depends on the string around it, not where the run
// started, so the search for the next stop is remembered (indexAhead) instead of redone each run.
const makeTextStopRegexp = () => {
  // OR a character that some other rule could start with, so that rule gets a chance at this
  // position. Everything else -- ordinary punctuation -- stays inside the text run; stopping on all
  // of it (the original was [^0-9A-Za-z\s\u00c0-\uffff]) emits a node, and a react element, per
  // character of '....' or 'e.g.'. Non-latin letters are ordinary too: stopping on those meant one
  // node per character of any japanese or cyrillic message. Emoji have their own alternative below.
  // Keep this in sync with the rules: \ escape, ` fence/inlineCode, * strong, _ em, ~ del,
  // : emoji, ! spoiler, $ serviceDecoration, > blockQuote/quotedFence.
  const notNormal = /[\\`*_~:!$>]/
  // OR there is an emoji ahead, so the emoji rule gets a chance at it.
  // This used to be [\u00c0-\uffff], i.e. any non-latin char at all, which stopped the text run
  // before every single character of a non-english message: one node, and one react element, per
  // character. Matching actual emoji instead keeps a japanese or cyrillic sentence in one node.
  const anyUnicode = emojiUnicodeRegex
  // [\w-_.]+@ // OR something that looks like it starts an email. If there is an email looking thing ahead stop here.
  // The repetitions below are bounded (a dns label is at most 63 chars): unbounded they rescan the
  // rest of the message at every position checked, which is quadratic.
  const emaily = /[\w-_.]{1,64}@/
  // OR there is a url with a common tld ahead: see findUrlStarts, checked alongside these.
  const newline = /\n/
  // | \w+:\S // OR there's letters before a : so stop here. Same word-start anchor as the tlds.
  const lettersColon = /(?<![0-9A-Za-z])\w{1,64}:\S/
  const end = /$/ //   | $ // OR we reach the end of the line
  return new RegExp(
    `(?=${[
      notNormal.source,
      anyUnicode.source,
      emaily.source,
      newline.source,
      lettersColon.source,
      end.source,
    ].join('|')})`,
    'g'
  )
}
const textStopAhead = makeTextStopRegexp()

const tlds = new Set(commonTlds)
const tldMin = Math.min(...commonTlds.map(t => t.length))
const tldMax = Math.max(...commonTlds.map(t => t.length))
const isWordChar = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95
const dotChar = 46
const underscoreChar = 95

// The text rule also stops where a url with a common tld starts, i.e. where
// /(?<![0-9A-Za-z])(\w{1,63}\.)+(tld)\b/ matches, so it doesn't swallow the common case of
// 'Checkout google.com, they got all the cool gizmos'.
// The lookbehind matters: without it the url is "ahead" from every position inside the word that
// starts it, so the text rule stops after a single character over and over and emits one node --
// and one react element -- per character. 'https://keybase.io/docs' used to parse to 17 of them.
// \b so a tld only counts at a word end: x.comx is not a url, x.com/y is.
// As a regex lookahead that re-reads a whole dotted run (a.b.c.d...) at every position in it, which
// is quadratic, so instead this finds every such position in one pass from the end. Tlds are all
// letters, so "tld\b" at i means the word starting at i is exactly a tld.
const findUrlStarts = (s: string): Array<number> => {
  // every url has a dot
  if (!s.includes('.')) {
    return []
  }
  const n = s.length
  // wordEnd[i]: where the run of \w chars starting at i ends (i itself if s[i] isn't one)
  const wordEnd = new Int32Array(n + 1)
  wordEnd[n] = n
  // tldAhead[i]: (\w{1,63}\.)*(tld)\b matches at i
  const tldAhead = new Uint8Array(n + 2)
  const starts: Array<number> = []
  for (let i = n - 1; i >= 0; --i) {
    const end = isWordChar(s.charCodeAt(i)) ? wordEnd[i + 1]! : i
    wordEnd[i] = end
    const length = end - i
    const isTld = length >= tldMin && length <= tldMax && tlds.has(s.slice(i, end))
    const labelThenTld = length >= 1 && length <= 63 && s.charCodeAt(end) === dotChar && tldAhead[end + 1] === 1
    tldAhead[i] = isTld || labelThenTld ? 1 : 0
    const prev = i > 0 ? s.charCodeAt(i - 1) : 0
    if (labelThenTld && !(isWordChar(prev) && prev !== underscoreChar)) {
      starts.push(i)
    }
  }
  return starts.reverse()
}

// Index in the current source of the first url start after its first char, or -1.
const urlAhead = (state: State) => {
  const {pos} = state.cursor!
  const starts = memoFor(state, findUrlStarts, findUrlStarts)
  let lo = 0
  let hi = starts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid]! <= pos) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo < starts.length ? starts[lo]! - pos : -1
}

const textMatch = (source: string, state: State): Capture => {
  // the end of the source is always a stop
  const stop = indexAhead(state, textStopAhead, 1)
  const url = urlAhead(state)
  return [source.slice(0, url !== -1 && url < stop ? url : stop)]
}

const wrapInParagraph = (parse: Parser, content: string, state: State): Array<SingleASTNode> => {
  const oldInParagraph = state['inParagraph'] as boolean
  state['inParagraph'] = true
  const ret = [{content: parseInline(parse, content, state), type: 'paragraph'}]
  state['inParagraph'] = oldInParagraph
  return ret
}

const isMarkdownMobile = (state: State) => state.isMobile ?? isMobile

const wordBoundaryLookBehind = /\B$/
// Wraps the match to also check that the behind is not a text, but a boundary (like a space)
// i.e. "foo" fails but "foo " passes.
const wordBoundryLookBehindMatch =
  (matchFn: MatchFunction) => (source: string, state: State, prevCapture: string) => {
    if (wordBoundaryLookBehind.test(prevCapture)) {
      return matchFn(source, state, prevCapture)
    }
    return null
  }

// A single line of a block quote, e.g. '> foo\n'
// sticky so the scan below never has to slice the source
const quotedLineRegex = / *>[^\n]*(?:\n|$)/y
// Strips the quote marker (and a single following space, so code indentation survives)
const quoteMarkerRegex = /^ *> ?/gm
const isFullyQuoted = (block: string) =>
  block.split('\n').every(line => line.trim() === '' || /^ *>/.test(line))
const countFences = (line: string) => (line.match(/```/g) ?? []).length
const emojiMatcher = inlineRegex(emojiRegex)
const quotedFenceRegex = /^(?: *> *((?:[^\n](?!```))*)) ```\n?((?:\\[\s\S]|[^\\])+?)```\n?/
const quotedFenceStart = /^ *>/
const fenceAhead = /```/g
const newlineAhead = /\n/g

// Lower order is tried first. These are the orders simple-markdown gave its rules, kept so the
// precedence between ours stays the same.
const blockQuoteOrder = 6
const paragraphOrder = 11
const textOrder = 25

const parseText = (capture: Capture) => ({content: capture[0]})

// Rules are defined here, the react components for these types are defined in markdown-react.js
const rules: {[type: string]: ParserRule} = {
  blockQuote: {
    order: blockQuoteOrder,
    // match: blockRegex(/^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/),
    // Original: A quote block only needs to start with > and everything in the same paragraph will be a quote
    // e.g. https://regex101.com/r/ZiDBsO/2
    // ours: Everything in the quote has to be preceded by >. Fences that open and close inside the
    // quote are kept (the marker is stripped before the nested parse, so the fence rule sees them),
    // but we stop before a fence that never closes inside the quote so quotedFence can handle it.
    match: (source: string, state: State, prevCapture: string): Capture | null => {
      if ((state['blockQuoteRecursionLevel'] ?? 0) > 6) {
        return null
      }
      // make sure the look behind is empty
      const emptyLookbehind = /^$|\n *$/
      if (!emptyLookbehind.test(prevCapture)) {
        return null
      }

      let insideFence = false
      let balancedEnd = 0
      quotedLineRegex.lastIndex = 0
      while (quotedLineRegex.lastIndex < source.length) {
        const line = quotedLineRegex.exec(source)?.[0]
        if (!line) break
        insideFence = (countFences(line) + (insideFence ? 1 : 0)) % 2 === 1
        if (!insideFence) {
          balancedEnd = quotedLineRegex.lastIndex
        }
      }
      if (!balancedEnd) {
        return null
      }
      const matched = source.slice(0, balancedEnd)
      return [matched]
    },
    parse: (capture: Capture, nestedParse: Parser, state: State) => {
      const content = capture[0]?.replace(quoteMarkerRegex, '') ?? ''
      const oldBlockQuoteRecursionLevel = state['blockQuoteRecursionLevel'] || 0
      state['blockQuoteRecursionLevel'] = oldBlockQuoteRecursionLevel + 1
      const ret = {content: nestedParse(content, state)}
      state['blockQuoteRecursionLevel'] = oldBlockQuoteRecursionLevel
      return ret
    },
  },
  del: {
    // original:
    // match: inlineRegex(/^~~(?=\S)([\s\S]*?\S)~~/),
    // ours: single tilde doesn't cross a newline
    match: wordBoundryLookBehindMatch(inlineRegex(/^~((?:\\[\s\S]|[^\\\n])+?)~(?!~)/)),
    order: 22,
    parse: (capture: Capture, nestedParse: Parser, state: State) => ({
      content: parseInline(nestedParse, capture[1] ?? '', state),
    }),
  },
  em: {
    // original is pretty long so not inlining it here
    // ours: wrapped in _'s
    match: wordBoundryLookBehindMatch(inlineRegex(/^_((?:\\[\s\S]|[^\\\n])+?)_(?!_)/)),
    order: 21,
    parse: (capture: Capture, nestedParse: Parser, state: State) => ({
      content: nestedParse(capture[1] ?? '', state),
    }),
    // em and strong share an order: the longer match wins, em on a tie
    quality: (capture: Capture) => (capture[0]?.length ?? 0) + 0.2,
  },
  emoji: {
    // emojiRegex matches the *shape* of a short name rather than an alternation of every known one,
    // so confirm the name actually exists. A `:name::skin-tone-N:` whose combination we don't know
    // falls back to the bare `:name:`, which is what the old alternation of literals did.
    match: (source: string, state: State, prevCapture: string): Capture | null => {
      const capture = emojiMatcher(source, state, prevCapture)
      const matched = capture?.[0]
      if (!matched) {
        return null
      }
      if (!matched.startsWith(':') || emojiIndexByName[matched]) {
        return capture
      }
      const base = matched.slice(0, matched.indexOf(':', 1) + 1)
      return emojiIndexByName[base] ? [base, base] : null
    },
    order: textOrder - 0.5,
    parse: (capture: Capture) => {
      // If it's a unicode emoji, let's get it's shortname
      const shortName = emojiIndexByChar[capture[0] ?? '']
      return {content: shortName || capture[0]}
    },
  },
  escape: {
    // handle escaped chars, keep this to handle escapes globally.
    // Letters, numbers and spaces can't be escaped, so backslashes in plain text still show.
    match: inlineRegex(/^\\([^0-9A-Za-z\s])/),
    order: 12,
    parse: (capture: Capture) => ({content: capture[1], type: 'text'}),
  },
  // we prevent matching against text if we're mobile and we aren't in a paragraph. This is because
  // in Mobile you can't have text outside a text tag, and a paragraph is what adds the text tag.
  // This is just a fallback (note the order) in case nothing else matches. It wraps the content in
  // a paragraph and tries to match again. Won't fallback on itself. If it's already in a paragraph,
  // it won't match.
  fallbackParagraph: {
    match: (source: string, state: State) =>
      isMarkdownMobile(state) && !state['inParagraph'] ? [source] : null,
    order: 10000,
    parse: (capture: Capture, nestedParse: Parser, state: State) =>
      wrapInParagraph(nestedParse, capture[0] ?? '', state),
  },
  fence: {
    // aka the ``` code blocks
    match: anyScopeRegex(/^```(?:\n)?((?:\\[\s\S]|[^\\])+?)```(?!`)(\n)?/),
    // original:
    // match: blockRegex(/^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n/),
    // ours: three ticks (anywhere) and remove any newlines in front and one in back
    order: 0,
    parse: function (capture: Capture) {
      return {
        content: capture[1],
        lang: undefined,
        type: 'fence',
      }
    },
  },
  inlineCode: {
    // original:
    // match: inlineRegex(/^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/),
    // ours: only allow a single backtick.
    // This used to be a regex, but trimming the padding with \s* around a lazy [\s\S]*? content group
    // is ambiguous and backtracked cubically: a 2k message of `<spaces>x hung the parser for seconds.
    // The scan below is the same grammar in one linear pass.
    match: (source: string): Capture | null => {
      if (!source.startsWith('`') || source[1] === '`') {
        return null
      }
      for (let i = 1; i < source.length; ++i) {
        // the closing backtick can't be part of a run of them
        if (source[i] !== '`' || source[i + 1] === '`') {
          continue
        }
        const raw = source.slice(1, i)
        let content = raw.trim()
        if (!content) {
          // all padding: keep a single trailing space, but never a bare newline
          const last = raw.slice(-1)
          if (last !== ' ' && last !== '\t') {
            continue
          }
          content = last
        }
        if (content.endsWith('`')) {
          continue
        }
        return [source.slice(0, i + 1), '`', content]
      }
      return null
    },
    order: 23,
    // a single space next to a backtick is padding so code can start or end with one, drop it
    parse: (capture: Capture) => ({content: capture[2]?.replace(/^ (?= *`)|(` *) $/g, '$1')}),
  },
  newline: {
    // handle newlines, keep this to handle \n w/ other matchers
    // original
    // match: blockRegex(/^(?:\n *)*\n/),
    // ours: handle \n inside text also
    match: anyScopeRegex(/^\n/),
    order: 10,
    parse: () => ({}),
  },
  paragraph: {
    order: paragraphOrder,
    // original:
    // match: blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks, stop before a block quote or a code block (aka fence)
    match: blockRegex(/^((?:[^\n`]|(?:`(?!``))|\n(?!(?: *\n| *>)))+)\n?/),
    parse: (capture: Capture, nestedParse: Parser, state: State) => {
      // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
      const content = isMarkdownMobile(state) ? (capture[1]?.replace(/\n$/, '') ?? '') : (capture[1] ?? '')
      const oldInParagraph = state['inParagraph'] as boolean
      state['inParagraph'] = true
      const ret = {content: parseInline(nestedParse, content, state)}
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
    match: (source: string, state: State): Capture | null => {
      if (!quotedFenceStart.test(source)) {
        return null
      }
      // The opening ``` has to be the first one on the quote's line. Everything the regex looks at
      // from that fence on is the same for every > before it on the line, so once it fails for a
      // fence it fails for all of them: remember that, so a line of >'s doesn't rescan the rest of
      // the line (and the fence body) at each one.
      const fence = indexAhead(state, fenceAhead, 0)
      if (fence === -1) {
        return null
      }
      const newline = indexAhead(state, newlineAhead, 0)
      if (newline !== -1 && newline < fence) {
        return null
      }
      const declined = memoFor(state, quotedFenceRegex, () => new Set<number>())
      const at = state.cursor!.pos + fence
      if (declined.has(at)) {
        return null
      }
      const capture = quotedFenceRegex.exec(source)
      // When every line of the fence body is quoted too, this is a normal block quote that happens
      // to contain a fence. blockQuote handles that (and strips the markers), so decline here.
      if (!capture || isFullyQuoted(capture[2] ?? '')) {
        declined.add(at)
        return null
      }
      return capture
    },
    // Example: https://regex101.com/r/ZiDBsO/6
    order: blockQuoteOrder - 0.5,
    parse: (capture: Capture, nestedParse: Parser, state: State) => {
      const preContent: Array<SingleASTNode> =
        isMarkdownMobile(state) && !!capture[1]
          ? wrapInParagraph(nestedParse, capture[1], state)
          : parseInline(nestedParse, capture[1] ?? '', state)
      return {
        content: [...preContent, {content: capture[2], type: 'fence'}],
        type: 'blockQuote',
      }
    },
  },
  serviceDecoration: {
    match: (source: string, state: State) =>
      state.inline &&
      source.startsWith('$>kb$') &&
      closesOnLine(state, serviceEndDecorationTagAhead, '$>kb$'.length)
        ? serviceDecorationRegex.exec(source)
        : null,
    order: 1,
    parse: (capture: Capture) => ({
      content: capture[1],
      type: 'serviceDecoration',
    }),
  },
  spoiler: {
    match: (source: string, state: State) =>
      state.inline && source.startsWith('!>') && closesOnLine(state, spoilerEndAhead, '!>'.length)
        ? spoilerRegex.exec(source)
        : null,
    order: 2,
    parse: (capture: Capture, nestedParse: Parser, state: State) => ({
      content: nestedParse(capture[1] || '', state),
      raw: capture[1],
      type: 'spoiler',
    }),
  },
  strong: {
    // original
    // match: inlineRegex(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
    // ours: single stars
    match: wordBoundryLookBehindMatch(inlineRegex(/^\*((?:\\[\s\S]|[^\\\n])+?)\*(?!\*)/)),
    order: 21,
    parse: (capture: Capture, nestedParse: Parser, state: State) => ({
      content: parseInline(nestedParse, capture[1] ?? '', state),
    }),
    quality: (capture: Capture) => (capture[0]?.length ?? 0) + 0.1,
  },
  text: {
    order: textOrder,
    parse: parseText,
    // original:
    // /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/
    // ours: stop on single new lines and common tlds. We want to stop at common tlds so this regex doesn't
    // consume the common case of saying: Checkout google.com, they got all the cool gizmos.
    match: (source: string, state: State) =>
      isMarkdownMobile(state) && !state['inParagraph'] ? null : textMatch(source, state),
  },
}

const simpleMarkdownParser = parserFor(rules)

const noRules: {[type: string]: ParserRule} = {
  // we prevent matching against text if we're mobile and we aren't in a paragraph. This is because
  // in Mobile you can't have text outside a text tag, and a paragraph is what adds the text tag.
  // This is just a fallback (note the order) in case nothing else matches. It wraps the content in
  // a paragraph and tries to match again. Won't fallback on itself. If it's already in a paragraph,
  // it won't match.
  fallbackParagraph: {
    match: (source: string, state: State) =>
      isMarkdownMobile(state) && !state['inParagraph'] ? [source] : null,
    order: 10000,
    parse: (capture: Capture, nestedParse: Parser, state: State) =>
      wrapInParagraph(nestedParse, capture[0] ?? '', state),
  },
  paragraph: {
    order: paragraphOrder,
    // original:
    // match: blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks, stop before a block quote or a code block (aka fence)
    match: blockRegex(/^((?:[^\n`]|(?:`(?!``))|\n(?!(?: *\n| *>)))+)\n?/),
    parse: (capture: Capture, nestedParse: Parser, state: State) => {
      // Remove a trailing newline because sometimes it sneaks in from when we add the newline to create the initial block
      const content = (isMarkdownMobile(state) ? capture[1]?.replace(/\n$/, '') : capture[1]) ?? ''
      const oldInParagraph = state['inParagraph'] as boolean
      state['inParagraph'] = true
      const ret = {content: parseInline(nestedParse, content, state)}
      state['inParagraph'] = oldInParagraph
      return ret
    },
  },
  text: {
    order: textOrder,
    parse: parseText,
    // original:
    // /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/
    // ours: stop on single new lines and common tlds. We want to stop at common tlds so this regex doesn't
    // consume the common case of saying: Checkout google.com, they got all the cool gizmos.
    match: (source: string, state: State) =>
      isMarkdownMobile(state) && !state['inParagraph'] ? null : [source],
  },
}
const noMarkdownParser = parserFor(noRules)

export const isAllEmoji = (ast: Array<SingleASTNode>) => {
  let emojiLine = 0
  for (const node of ast) {
    if (node.type === 'newline') {
      continue // ignore newline
    }
    const c = node['content'] as Array<{type: string}> | string
    if (!Array.isArray(c) || c.some(n => n.type !== 'emoji' && n.type !== 'newline')) {
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

export const shouldUseParser = (s: string) => {
  if (s.length < tooLong) return true
  return s.search(fastMDReg) !== -1
}

export const parseMarkdown = (
  input = '',
  options?: ParseMarkdownOptions
): Array<SingleASTNode> => {
  const shouldUseMarkdownParser = options?.shouldUseMarkdownParser ?? shouldUseParser(input)
  const parser = shouldUseMarkdownParser ? simpleMarkdownParser : noMarkdownParser
  const source = shouldUseMarkdownParser ? input.trim() : input
  return parser(source + '\n', {
    inline: false,
    isMobile: options?.isMobile ?? isMobile,
    messageType: options?.messageType,
  })
}

export const getMarkdownOutputKind = (
  parseTree: Array<SingleASTNode>,
  options?: Pick<Props, 'preview' | 'serviceOnly' | 'serviceOnlyNoWrap' | 'smallStandaloneEmoji'>
): MarkdownOutputKind => {
  switch (true) {
    case !!options?.serviceOnlyNoWrap:
      return 'serviceOnlyNoWrap'
    case !!options?.serviceOnly:
      return 'serviceOnly'
    case !!options?.preview:
      return 'preview'
    case !options?.smallStandaloneEmoji && isAllEmoji(parseTree):
      return 'bigEmoji'
    default:
      return 'default'
  }
}

const ErrorComponent = (p: {children: React.ReactNode}) => {
  const styles = useStyles()
  const {children} = p
  return (
    <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, markdownStyles.wrapStyle] as const)}>
      {children ?? ''}
    </Text>
  )
}

// Kept outside the component: the react compiler can't yet compile value blocks
// inside try/catch, so an inline try/catch would bail out the whole component and
// re-parse the markdown on every render.
const renderMarkdown = (
  children: string | undefined,
  messageType: Props['messageType'],
  state: State,
  kindOptions: Pick<Props, 'preview' | 'serviceOnly' | 'serviceOnlyNoWrap' | 'smallStandaloneEmoji'>
): {parseFailed: boolean; output: React.ReactNode} => {
  try {
    const parseTree = parseMarkdown(children ?? '', {isMobile: isMobile, messageType})
    const outputKind = getMarkdownOutputKind(parseTree, kindOptions)
    switch (outputKind) {
      case 'serviceOnlyNoWrap':
        return {output: serviceOnlyNoWrapOutput(parseTree, state), parseFailed: false}
      case 'serviceOnly':
        return {output: serviceOnlyOutput(parseTree, state), parseFailed: false}
      case 'preview':
        return {output: previewOutput(parseTree, state), parseFailed: false}
      case 'bigEmoji':
        return {output: bigEmojiOutput(parseTree, state), parseFailed: false}
      default:
        return {output: reactOutput(parseTree, state), parseFailed: false}
    }
  } catch (e) {
    logger.error('Error parsing markdown')
    logger.debug('Error parsing markdown', e)
    return {output: null, parseFailed: true}
  }
}

const emptyStyleOverride: StyleOverride = {}

function SimpleMarkdownComponent(p: Props) {
  const styles = useStyles()
  // One destructure: split across statements the compiler keeps `p` itself as a memo dependency, so
  // every new props object re-parses the markdown even when nothing it reads actually changed.
  const {
    allowFontScaling,
    styleOverride = emptyStyleOverride,
    paragraphTextClassName,
    messageType,
    children,
    serviceOnly,
    preview,
    smallStandaloneEmoji,
    virtualText,
    lineClamp,
    style,
    selectable,
    serviceOnlyNoWrap,
    disallowAnimation,
    context,
  } = p

  const state = {
    allowFontScaling,
    context,
    disallowAnimation,
    messageType,
    paragraphTextClassName,
    selectable,
    styleOverride,
    virtualText,
  }

  const {output, parseFailed} = renderMarkdown(children, messageType, state, {
    preview,
    serviceOnly,
    serviceOnlyNoWrap,
    smallStandaloneEmoji,
  })

  if (parseFailed) {
    return <ErrorComponent>{children}</ErrorComponent>
  }

  const inner = ((): React.ReactNode => {
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
            type={isMobile ? 'Body' : 'BodySmall'}
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
    <BareErrorBoundary fallback={<ErrorComponent>{children}</ErrorComponent>}>
      {isMobile ? (
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
    </BareErrorBoundary>
  )
}

const useStyles = Styles.createStyleHook(() => ({
  rootWrapper: Styles.platformStyles({
    isElectron: {whiteSpace: 'pre'},
  }),
}))

export default SimpleMarkdownComponent
