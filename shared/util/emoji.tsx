import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Chat2Types from '../constants/types/chat2'

export type EmojiData = {
  category: string
  name: string | null
  short_name: string
  short_names: Array<string>
  sort_order?: number
  unified: string
  skin_variations?: {[K in Chat2Types.EmojiSkinTone]: Object}
  source?: string
}
export function RPCToEmojiData(emoji: RPCChatTypes.Emoji, category?: string): EmojiData {
  if (emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.httpsrv) {
    return {
      category: category ?? '',
      name: null,
      short_name: emoji.alias,
      short_names: [emoji.alias],
      source: emoji.source.httpsrv,
      unified: '',
    }
  }
  return {
    category: category ?? '',
    name: emoji.source.str,
    short_name: emoji.alias,
    short_names: [emoji.alias],
    unified: '',
  }
}
