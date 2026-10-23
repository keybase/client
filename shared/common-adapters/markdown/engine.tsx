// The parse and output loops markdown is built on: the parts of simple-markdown
// (https://github.com/Khan/perseus/tree/main/packages/simple-markdown, MIT) we use, with the same
// behaviour. Every rule lives in index.tsx (parsing) and react.tsx (output).
import type * as React from 'react'

export type SingleASTNode = {
  type: string
  [key: string]: unknown
}
export type Capture = Array<string> & {index?: number}
type Search = {from: number; found: number}
// A rule's source is always base.substring(pos), base being the string the current (possibly
// nested) parse is walking through.
type Cursor = {base: string; pos: number; searches: Map<RegExp, Map<string, Search>>}
export type State = {
  key?: string | number | undefined
  inline?: boolean | null | undefined
  prevCapture?: Capture | null
  cursor?: Cursor
  [key: string]: unknown
}
export type MatchFunction = (source: string, state: State, prevCapture: string) => Capture | null | undefined
export type Parser = (source: string, state: State) => Array<SingleASTNode>
export type ParserRule = {
  readonly order: number
  readonly match: MatchFunction
  // Rules at the same order that have a quality all get a chance to match, and the highest wins.
  readonly quality?: (capture: Capture, state: State, prevCapture: string) => number
  readonly parse: (capture: Capture, nestedParse: Parser, state: State) => object
}
export type ParserRules = {readonly [type: string]: ParserRule}

export type Output<Result> = (node: SingleASTNode | Array<SingleASTNode>, state?: State) => Result
export type ReactOutput = Output<React.ReactNode>
// node and state are never: each rule declares its own node and state shapes
export type OutputRules = {
  readonly [type: string]: {readonly react: (node: never, output: ReactOutput, state: never) => React.ReactNode}
}

const crNewlineRegex = /\r\n?/g
const tabRegex = /\t/g
const formfeedRegex = /\f/g
const preprocess = (source: string) =>
  source.replace(crNewlineRegex, '\n').replace(formfeedRegex, '').replace(tabRegex, '    ')

export const parserFor = (rules: ParserRules): Parser => {
  // increasing order, then rules with a quality first, then by name
  const ruleList = Object.keys(rules)
    .map(type => ({rule: rules[type]!, type}))
    .sort((a, b) => {
      if (a.rule.order !== b.rule.order) {
        return a.rule.order - b.rule.order
      }
      const qa = a.rule.quality ? 0 : 1
      const qb = b.rule.quality ? 0 : 1
      if (qa !== qb) {
        return qa - qb
      }
      return a.type < b.type ? -1 : a.type > b.type ? 1 : 0
    })

  const nestedParse: Parser = (base, state) => {
    const result: Array<SingleASTNode> = []
    const cursor = state.cursor!
    let source = base
    let pos = 0
    while (source) {
      let best: {capture: Capture; rule: ParserRule; type: string} | undefined
      let quality = NaN
      cursor.base = base
      cursor.pos = pos
      const prevCapture = state.prevCapture?.[0] ?? ''
      for (const {rule, type} of ruleList) {
        if (best && !(rule.order === best.rule.order && rule.quality)) {
          break
        }
        const capture = rule.match(source, state, prevCapture)
        if (!capture) {
          continue
        }
        const currQuality = rule.quality ? rule.quality(capture, state, prevCapture) : 0
        // NaN on the first match, so that always wins
        if (!(currQuality <= quality)) {
          best = {capture, rule, type}
          quality = currQuality
        }
      }
      if (!best) {
        throw new Error('markdown: no rule matched')
      }
      const parsed = best.rule.parse(best.capture, nestedParse, state)
      if (Array.isArray(parsed)) {
        result.push(...(parsed as Array<SingleASTNode>))
      } else {
        const node = parsed as {type?: string}
        node.type ??= best.type
        result.push(node as SingleASTNode)
      }
      state.prevCapture = best.capture
      const length = best.capture[0]?.length ?? 0
      pos += length
      source = source.substring(length)
    }
    return result
  }

  return (source, state) => {
    state.prevCapture = null
    state.cursor = {base: '', pos: 0, searches: new Map()}
    return nestedParse(preprocess(source), state)
  }
}

// Index in the current source of the next match of `regex` (which must be global) at or after
// `offset`, or -1. The answer is kept per string, so a rule asking at every position it's tried at
// scans the string once, not the rest of it each time.
export const indexAhead = (state: State, regex: RegExp, offset: number): number => {
  const cursor = state.cursor!
  const {base, pos} = cursor
  const from = pos + offset
  let byBase = cursor.searches.get(regex)
  if (!byBase) {
    byBase = new Map()
    cursor.searches.set(regex, byBase)
  }
  let search = byBase.get(base)
  // still good if nothing was found from search.from on, or what was found is still ahead
  if (!search || from < search.from || (search.found !== -1 && search.found < from)) {
    regex.lastIndex = from
    search = {found: regex.exec(base)?.index ?? -1, from}
    byBase.set(base, search)
  }
  return search.found === -1 ? -1 : search.found - pos
}

export const inlineRegex =
  (regex: RegExp): MatchFunction =>
  (source, state) =>
    state.inline ? regex.exec(source) : null

export const blockRegex =
  (regex: RegExp): MatchFunction =>
  (source, state) =>
    state.inline ? null : regex.exec(source)

export const anyScopeRegex =
  (regex: RegExp): MatchFunction =>
  source =>
    regex.exec(source)

export const parseInline = (parse: Parser, content: string, state: State) => {
  const isCurrentlyInline = state.inline || false
  state.inline = true
  const result = parse(content, state)
  state.inline = isCurrentlyInline
  return result
}

export const textReact = (node: {content: unknown}) => node.content as string

// Joins neighbouring text nodes into one string before output.
export const arrayReact = (arr: Array<SingleASTNode>, output: ReactOutput, state: State) => {
  const oldKey = state.key
  const result: Array<React.ReactNode> = []
  for (let i = 0; i < arr.length; i++) {
    state.key = String(i)
    let node = arr[i]!
    if (node.type === 'text') {
      let content = node['content'] as string
      for (; i + 1 < arr.length && arr[i + 1]!.type === 'text'; i++) {
        content += arr[i + 1]!['content'] as string
      }
      node = {content, type: 'text'}
    }
    result.push(output(node, state))
  }
  state.key = oldKey
  return result
}

export const outputFor = (rules: OutputRules): ReactOutput => {
  let latestState: State = {}
  const arrayRule = (rules['Array']?.react ?? arrayReact) as typeof arrayReact
  const nestedOutput: ReactOutput = (ast, state): React.ReactNode => {
    state = state ?? latestState
    latestState = state
    if (Array.isArray(ast)) {
      return arrayRule(ast, nestedOutput, state)
    }
    const rule = rules[ast.type]!.react as (node: SingleASTNode, output: ReactOutput, state: State) => React.ReactNode
    return rule(ast, nestedOutput, state)
  }
  return (ast, state): React.ReactNode => {
    latestState = state ?? {}
    return nestedOutput(ast, latestState)
  }
}
