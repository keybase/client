// Which Box2/ClickableBox call sites a diff touches, and which of those a base run mounted. Call
// site ids are `<file under shared/>:<line of the opening element>`, as babel-plugin.cjs marks them.
import {parse} from '@babel/parser'

export type Hunk = {oldStart: number; oldCount: number; newStart: number; newCount: number}
export type Range = {start: number; end: number}

const TARGETS: ReadonlySet<string> = new Set(['Box2', 'Kb.Box2', 'ClickableBox', 'Kb.ClickableBox'])

// The same files the babel plugin leaves unmarked.
export const unmarkedFile = (rel: string) => rel.startsWith('..') || /(^|\/)(node_modules|common-adapters)\//.test(rel)

// `git diff -U0` output → hunks per post-change path (repo-relative). Deleted files are dropped.
export const parseDiffHunks = (diff: string): Map<string, Array<Hunk>> => {
  const out = new Map<string, Array<Hunk>>()
  let current: Array<Hunk> | undefined
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4)
      if (p === '/dev/null') current = undefined
      else {
        current = []
        out.set(p.replace(/^b\//, ''), current)
      }
      continue
    }
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (m && current) {
      current.push({
        newCount: m[4] === undefined ? 1 : Number(m[4]),
        newStart: Number(m[3]),
        oldCount: m[2] === undefined ? 1 : Number(m[2]),
        oldStart: Number(m[1]),
      })
    }
  }
  return out
}

type AstNode = {type?: string; loc?: {start: {line: number}; end: {line: number}}; name?: unknown}

const jsxName = (n: unknown): string => {
  const node = n as {type?: string; name?: string; object?: unknown; property?: unknown}
  if (node.type === 'JSXIdentifier') return node.name ?? ''
  if (node.type === 'JSXMemberExpression') return `${jsxName(node.object)}.${jsxName(node.property)}`
  return ''
}

// Line ranges of every Box2/ClickableBox opening element in a .tsx source.
export const callSiteRanges = (src: string): Array<Range> => {
  const ast = parse(src, {plugins: ['typescript', 'jsx'], sourceType: 'module'})
  const out: Array<Range> = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x)
      return
    }
    if (!v || typeof v !== 'object') return
    const node = v as AstNode
    if (node.type === 'JSXOpeningElement' && node.loc && TARGETS.has(jsxName(node.name))) {
      out.push({end: node.loc.end.line, start: node.loc.start.line})
    }
    for (const [k, x] of Object.entries(v)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') walk(x)
    }
  }
  walk(ast.program)
  return out.sort((a, b) => a.start - b.start)
}

// A call site is changed when an added line falls inside it, or lines were deleted from inside it.
export const changedRanges = (ranges: ReadonlyArray<Range>, hunks: ReadonlyArray<Hunk>): Array<Range> =>
  ranges.filter(r =>
    hunks.some(h =>
      h.newCount > 0
        ? r.start <= h.newStart + h.newCount - 1 && r.end >= h.newStart
        : r.start <= h.newStart && r.end >= h.newStart + 1
    )
  )

// Where a base line ends up after the diff. A line inside a changed hunk maps to the matching
// offset in its replacement, clamped to it.
export const mapBaseLine = (line: number, hunks: ReadonlyArray<Hunk>): number => {
  let delta = 0
  for (const h of hunks) {
    const oldEnd = h.oldCount === 0 ? h.oldStart : h.oldStart + h.oldCount - 1
    if (h.oldCount > 0 && line >= h.oldStart && line <= oldEnd) {
      return h.newStart + Math.min(line - h.oldStart, Math.max(h.newCount - 1, 0))
    }
    if (oldEnd < line) delta += h.newCount - h.oldCount
  }
  return line + delta
}

// The changed call sites (as `file:line` in the post-change tree) that no mounted base id maps into.
export const unmountedChanged = (opts: {
  changed: Map<string, ReadonlyArray<Range>>
  baseHunks: Map<string, ReadonlyArray<Hunk>>
  mounted: ReadonlyArray<string>
}): Array<string> => {
  const mountedLines = new Map<string, Array<number>>()
  for (const id of opts.mounted) {
    const at = id.lastIndexOf(':')
    const file = id.slice(0, at)
    const line = mapBaseLine(Number(id.slice(at + 1)), opts.baseHunks.get(file) ?? [])
    mountedLines.set(file, [...(mountedLines.get(file) ?? []), line])
  }
  const out: Array<string> = []
  for (const [file, ranges] of opts.changed) {
    const lines = mountedLines.get(file) ?? []
    for (const r of ranges) {
      if (!lines.some(l => l >= r.start && l <= r.end)) out.push(`${file}:${r.start}`)
    }
  }
  return out.sort()
}
