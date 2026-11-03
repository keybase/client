// The elements of an Appium (XCUITest) page source, in document order, with their attributes
// decoded. Pure: one page source read replaces a WebDriver call per element and attribute.

export type SourceElement = {attrs: Record<string, string>; type: string}

const entities: Record<string, string> = {amp: '&', apos: "'", gt: '>', lt: '<', quot: '"'}
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16))
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10))
    return entities[e] ?? m
  })

const attrsOf = (tag: string) => {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/ ([a-zA-Z]+)="([^"]*)"/g)) out[m[1] ?? ''] = decode(m[2] ?? '')
  return out
}

export const sourceElements = (source: string): Array<SourceElement> =>
  [...source.matchAll(/<(XCUIElementType[A-Za-z]+) [^>]*>/g)].map(m => ({attrs: attrsOf(m[0]), type: m[1] ?? ''}))

// Each of sourceElements' elements' parent, as an index into them (-1: none), read off the same tags.
export const sourceParents = (source: string): Array<number> => {
  const parents: Array<number> = []
  const open: Array<number> = []
  for (const m of source.matchAll(/<(XCUIElementType[A-Za-z]+) [^>]*>|<\/XCUIElementType[A-Za-z]+>/g)) {
    if (m[0].startsWith('</')) {
      open.pop()
      continue
    }
    parents.push(open.at(-1) ?? -1)
    if (!m[0].endsWith('/>')) open.push(parents.length - 1)
  }
  return parents
}

// The frame a page source element's attributes give, in window points.
export const sourceRect = (attrs: Record<string, string>) => ({
  height: Number(attrs['height']),
  width: Number(attrs['width']),
  x: Number(attrs['x']),
  y: Number(attrs['y']),
})

// An XCUITest predicate clause for the element at exactly `r`, to fetch one read off a page source.
export const framePredicate = (r: {height: number; width: number; x: number; y: number}) =>
  `rect.x == ${r.x} AND rect.y == ${r.y} AND rect.width == ${r.width} AND rect.height == ${r.height}`

// The parts of an accessibility label: XCUITest joins a box's texts with ", ", and a text drawn with a
// no-break space (a size, a date) reads as one with a space.
export const labelParts = (label: string) =>
  label
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .split(', ')
    .map(p => p.trim())

// Whether `label` holds `part` as one of its parts.
export const labelHas = (label: string, part: string) => labelParts(label).includes(part)

// Whether an element's traits attribute ("Selected, Image") holds `trait`.
export const hasTrait = (traits: string | null | undefined, trait: string) => (traits ?? '').split(', ').includes(trait)
