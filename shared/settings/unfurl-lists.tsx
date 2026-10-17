export type UnfurlList = 'allow' | 'block'

export type UnfurlListEdits = {
  added: {allow: ReadonlyArray<string>; block: ReadonlyArray<string>}
  removed: ReadonlySet<string>
}

export const emptyUnfurlListEdits: UnfurlListEdits = {added: {allow: [], block: []}, removed: new Set()}

export const hasUnfurlListEdits = (edits: UnfurlListEdits) =>
  edits.removed.size > 0 || edits.added.allow.length > 0 || edits.added.block.length > 0

// The service normalizes domains on save; this only keeps the pending rows tidy.
export const addDomain = (
  edits: UnfurlListEdits,
  list: UnfurlList,
  domain: string,
  saved: ReadonlyArray<string> = []
): UnfurlListEdits => {
  const d = domain.trim().toLowerCase()
  if (!d) return edits
  const other = list === 'allow' ? 'block' : 'allow'
  const removed = new Set(edits.removed)
  removed.delete(d)
  return {
    added: {
      ...edits.added,
      [list]: edits.added[list].includes(d) || saved.includes(d) ? edits.added[list] : [...edits.added[list], d],
      [other]: edits.added[other].filter(x => x !== d),
    },
    removed,
  }
}

export const removeAddedDomain = (edits: UnfurlListEdits, list: UnfurlList, domain: string): UnfurlListEdits => ({
  ...edits,
  added: {...edits.added, [list]: edits.added[list].filter(x => x !== domain)},
})

const uniqueSorted = (xs: ReadonlyArray<string>) => [...new Set(xs)].sort()

export const nextLists = (
  saved: {whitelist: ReadonlyArray<string>; blocklist: ReadonlyArray<string>},
  edits: UnfurlListEdits
) => {
  const {added, removed} = edits
  const keep = (xs: ReadonlyArray<string>, otherAdded: ReadonlyArray<string>) =>
    xs.filter(x => !removed.has(x) && !otherAdded.includes(x))
  return {
    blocklist: uniqueSorted([...keep(saved.blocklist, added.allow), ...added.block]),
    whitelist: uniqueSorted([...keep(saved.whitelist, added.block), ...added.allow]),
  }
}
