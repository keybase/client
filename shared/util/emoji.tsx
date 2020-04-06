import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Chat2Types from '../constants/types/chat2'

export type EmojiData = {
  aliasTo?: string
  category: string
  name: string | null
  short_name: string
  short_names: Array<string>
  sort_order?: number
  unified: string
  skin_variations?: {[K in Chat2Types.EmojiSkinTone]: Object}
  source?: string
}

export const expandAlias = (emoji: EmojiData, modifierStr?: string) =>
  emoji.aliasTo ?? `:${emoji.short_name}:${modifierStr ?? ''}`

export function RPCToEmojiData(emoji: RPCChatTypes.Emoji, category?: string): EmojiData {
  return {
    aliasTo: emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.str ? emoji.source.str : undefined,
    category: category ?? '',
    name: null,
    short_name: emoji.alias,
    short_names: [emoji.alias],
    source: emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.str ? undefined : emoji.source.httpsrv,
    unified: '',
  }
}
