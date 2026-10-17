import * as T from '@/constants/types'

export type UnfurlList = 'allow' | 'block'
export type UnfurlLists = {blocklist: ReadonlyArray<string>; whitelist: ReadonlyArray<string>}
// removed saved rows stay listed, with Restore, until the save
export type UnfurlDraft = UnfurlLists & {removed: ReadonlySet<string>}

export const draftOf = (saved: UnfurlLists): UnfurlDraft => ({...saved, removed: new Set()})

const listKeys = (list: UnfurlList) =>
  list === 'allow' ? (['whitelist', 'blocklist'] as const) : (['blocklist', 'whitelist'] as const)

// The service normalizes domains on save; this only keeps the rows tidy.
export const addDomain = (draft: UnfurlDraft, list: UnfurlList, input: string): UnfurlDraft => {
  const domain = input.trim().toLowerCase()
  if (!domain) return draft
  const [to, from] = listKeys(list)
  const removed = new Set(draft.removed)
  removed.delete(domain)
  const next: UnfurlDraft = {...draft, removed}
  next[from] = draft[from].filter(d => d !== domain)
  next[to] = draft[to].includes(domain) ? draft[to] : [...draft[to], domain]
  return next
}

// A saved row toggles Restore. A row added in this draft goes away, back to the
// other list if it was moved from there.
export const removeDomain = (
  draft: UnfurlDraft,
  saved: UnfurlLists,
  list: UnfurlList,
  domain: string
): UnfurlDraft => {
  const [to, from] = listKeys(list)
  if (saved[to].includes(domain)) {
    const removed = new Set(draft.removed)
    if (!removed.delete(domain)) removed.add(domain)
    return {...draft, removed}
  }
  const next: UnfurlDraft = {...draft}
  next[to] = draft[to].filter(d => d !== domain)
  if (saved[from].includes(domain)) next[from] = [...draft[from], domain]
  return next
}

const sameDomains = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every(d => b.includes(d))

export const hasEdits = (draft: UnfurlDraft, saved: UnfurlLists) =>
  draft.removed.size > 0 ||
  !sameDomains(draft.whitelist, saved.whitelist) ||
  !sameDomains(draft.blocklist, saved.blocklist)

export const unfurlSaveArgs = (selected: T.RPCChat.UnfurlMode | undefined, draft: UnfurlDraft) => {
  const keep = (d: string) => !draft.removed.has(d)
  return {
    blocklist: draft.blocklist.filter(keep),
    mode: selected ?? T.RPCChat.UnfurlMode.whitelisted,
    whitelist: draft.whitelist.filter(keep),
  }
}
