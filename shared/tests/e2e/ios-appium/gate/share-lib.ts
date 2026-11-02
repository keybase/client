// The share extension's hand-off to the app, read from its app group, and the pages the flow serves
// Safari. Pure: gate/share.ts drives the sheets and reads the files.
import * as path from 'path'

// What the extension writes for each shared item: a file it copied into its payload folder
// (originalPath), or text (content), or the static description of one it couldn't prepare (error).
export type ManifestItem = {content?: string; error?: string; originalPath?: string; type?: string}

// The manifest the extension writes, and the name the service moves it to while it reads it (then
// removes it).
export const MANIFEST_NAMES = ['manifest.json', 'manifest.claimed'] as const

export const parseManifest = (text: string): Array<ManifestItem> => {
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('the share manifest is not a list')
  return parsed.map(i => {
    if (typeof i !== 'object' || i === null) throw new Error('a share manifest item is not an object')
    const o = i as Record<string, unknown>
    const str = (k: string) => (typeof o[k] === 'string' ? o[k] : undefined)
    return {content: str('content'), error: str('error'), originalPath: str('originalPath'), type: str('type')}
  })
}

// What a share handed over: the items of the manifest it wrote (undefined when none was seen), and why
// one of their files could not be recorded for the cleanup, when one could not.
export type Handed = {folderProblem?: string; items?: ReadonlyArray<ManifestItem>}

export type WantItem = {type: 'file' | 'image' | 'text' | 'video'; ext?: string; content?: string}

// The one item a share of one thing hands the app: none dropped, its type, and a file's extension
// or the text exactly. Errors name no path or text.
export const requireOneItem = ({folderProblem, items}: Handed, want: WantItem): ManifestItem => {
  if (folderProblem) throw new Error(folderProblem)
  if (!items) throw new Error('the share extension wrote no manifest')
  if (items.some(i => i.error)) throw new Error('the share extension could not prepare an item')
  if (items.length !== 1) throw new Error(`the share extension handed over ${items.length} items, not 1`)
  const [item] = items as [ManifestItem]
  if (item.type !== want.type) throw new Error(`the shared item is a ${item.type ?? '?'}, not a ${want.type}`)
  if (want.ext !== undefined && path.extname(item.originalPath ?? '').toLowerCase() !== want.ext) {
    throw new Error(`the shared file is not a ${want.ext}`)
  }
  if (want.content !== undefined && item.content !== want.content) throw new Error('the shared text is not the text shared')
  if (want.type !== 'text' && !item.originalPath) throw new Error('the shared item has no file')
  return item
}

// The payload folder (root/<share>) a manifest item's file sits in: the extension makes one per
// share and one sub-folder per item. Refuses a path outside that shape, so a cleanup only ever
// removes a share's own folder under the incoming-shares root.
export const payloadFolder = (root: string, originalPath: string) => {
  const rel = path.relative(root, originalPath)
  const parts = rel.split(path.sep)
  if (rel.startsWith('..') || path.isAbsolute(rel) || parts.length !== 3 || parts.some(p => !p || p === '.' || p === '..')) {
    throw new Error('a shared file is not in a payload folder of incoming-shares')
  }
  return path.join(root, parts[0]!)
}

// A per-run page for Safari holding `text` in a text area labelled `label`: the text is a stamped
// marker, so nothing in it needs escaping beyond what a marker may hold.
export const textPage = (label: string, text: string) => {
  if (!/^[A-Za-z0-9 _.-]{1,120}$/.test(text) || !/^[a-z ]{1,40}$/.test(label)) throw new Error('refusing page text that is not a stamped marker')
  return [
    '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>e2e share</title></head>',
    `<body><textarea aria-label="${label}" rows="4" cols="30">${text}</textarea></body></html>`,
    '',
  ].join('\n')
}

export type ServedRequest = {method: string; path: string; userAgent: string}

// The requests the share extension made itself (Safari's own page loads are not its).
export const extensionRequests = (requests: ReadonlyArray<ServedRequest>, since: number) =>
  requests.slice(since).filter(r => /KeybaseShare/i.test(r.userAgent))

// chat1.UnfurlMode: ALWAYS 0, NEVER 1, WHITELISTED 2.
export type UnfurlSettings = {mode: number; whitelist?: ReadonlyArray<string> | null}

// Domains the service unfurls in every mode (go/chat/unfurl/utils.go isAutoAllowedDomain).
const AUTO_ALLOWED = ['giphy.com', 'keybasemaps']

// Why sending `text` would have the phone's service fetch a link in it, or undefined when it would
// not: the app then only offers a preview. A gate run fetches no link but keybase.io's. The service
// matches a link by its host's eTLD+1 (go/chat/unfurl/utils.go:43-61 GetDomain) looked up exactly in
// the whitelist (go/chat/unfurl/extractor.go:102); with no public suffix list here, every dot-suffix
// of the host stands in for it, so a whitelist entry naming any of them refuses.
export const unfurlFetchProblem = (s: UnfurlSettings, text: string) => {
  for (const link of text.match(/https?:\/\/\S+/g) ?? []) {
    let host: string
    try {
      host = new URL(link).hostname.toLowerCase()
    } catch {
      return 'the shared text holds a link the harness cannot read: refusing to send it'
    }
    const labels = host.split('.')
    const suffixes = labels.map((_, i) => labels.slice(i).join('.'))
    const whitelisted = (s.whitelist ?? []).some(d => suffixes.includes(d.toLowerCase()))
    const auto = suffixes.some(d => AUTO_ALLOWED.includes(d))
    if (s.mode === 0 || auto || (s.mode === 2 && whitelisted)) return 'the smoke account unfurls a link in the shared text: refusing to send it'
  }
  return undefined
}

// The text a Maps place card shares: its name and an Apple Maps link, each on a line.
export const mapsShareProblem = (text: string, place: string) => {
  const lines = text.split('\n')
  if (!lines.includes(place)) return 'the Maps share does not hold the place name'
  if (!lines.some(l => /^https:\/\/maps\.apple(\.com)?\//.test(l))) return 'the Maps share holds no Apple Maps link'
  return undefined
}
