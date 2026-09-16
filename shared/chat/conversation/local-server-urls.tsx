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
