import * as T from '@/constants/types'
import {parseServiceDecoration} from '@/common-adapters/markdown/service-decoration-parser'

// The service hands out '' for URLs on its local http server while that server is down (iOS
// background). A message refreshed then must not lose the URLs we already have: they work again
// once the server is back, and nothing else would refill them.

export const localServerURLKeys: ReadonlySet<string> = new Set(['fileURL', 'previewURL'])

const decorationRegex = /\$>kb\$(.*?)\$<kb\$/g

const blankSource = (source: T.RPCChat.EmojiLoadSource, onEmpty: () => void): T.RPCChat.EmojiLoadSource => {
  if (source.typ !== T.RPCChat.EmojiLoadSourceTyp.httpsrv) return source
  if (!source.httpsrv) onEmpty()
  return {...source, httpsrv: ''}
}

const withoutEmojiURLs = (decorated: string) => {
  let hasEmpty = false
  const onEmpty = () => {
    hasEmpty = true
  }
  const blanked = decorated.replace(decorationRegex, (match, json: string) => {
    const d = parseServiceDecoration(json)
    if (d?.typ !== T.RPCChat.UITextDecorationTyp.emoji) return match
    const noAnimSource = blankSource(d.emoji.noAnimSource, onEmpty)
    const source = blankSource(d.emoji.source, onEmpty)
    return JSON.stringify({...d, emoji: {...d.emoji, noAnimSource, source}})
  })
  return {blanked, hasEmpty}
}

// true when incoming decorated text is existing with emoji URLs gone empty, so existing should stay
export const shouldKeepEmojiURLs = (existing: string, incoming: string) => {
  if (existing === incoming || !incoming.includes('$>kb$')) return false
  const next = withoutEmojiURLs(incoming)
  if (!next.hasEmpty) return false
  const cur = withoutEmojiURLs(existing)
  return !cur.hasEmpty && cur.blanked === next.blanked
}

type ImageDisplay = T.RPCChat.UnfurlImageDisplay | null | undefined

const imageKeepingURL = (existing: ImageDisplay, incoming: ImageDisplay) =>
  incoming && !incoming.url && existing?.url ? {...incoming, url: existing.url} : incoming

export const unfurlKeepingLocalServerURLs = (
  existing: T.RPCChat.UIMessageUnfurlInfo | undefined,
  incoming: T.RPCChat.UIMessageUnfurlInfo
): T.RPCChat.UIMessageUnfurlInfo => {
  const cur = existing?.unfurl
  const next = incoming.unfurl
  if (cur?.unfurlType === T.RPCChat.UnfurlType.generic && next.unfurlType === T.RPCChat.UnfurlType.generic) {
    const favicon = imageKeepingURL(cur.generic.favicon, next.generic.favicon)
    const media = imageKeepingURL(cur.generic.media, next.generic.media)
    if (favicon === next.generic.favicon && media === next.generic.media) return incoming
    return {...incoming, unfurl: {...next, generic: {...next.generic, favicon, media}}}
  }
  if (cur?.unfurlType === T.RPCChat.UnfurlType.giphy && next.unfurlType === T.RPCChat.UnfurlType.giphy) {
    const favicon = imageKeepingURL(cur.giphy.favicon, next.giphy.favicon)
    const image = imageKeepingURL(cur.giphy.image, next.giphy.image)
    const video = imageKeepingURL(cur.giphy.video, next.giphy.video)
    if (favicon === next.giphy.favicon && image === next.giphy.image && video === next.giphy.video) {
      return incoming
    }
    return {...incoming, unfurl: {...next, giphy: {...next.giphy, favicon, image, video}}}
  }
  return incoming
}
