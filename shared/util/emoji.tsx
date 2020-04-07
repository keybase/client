import * as React from 'react'
import * as Kb from '../common-adapters'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Chat2Types from '../constants/types/chat2'

export type EmojiData = {
  category: string
  name: string | null
  short_name: string
  short_names: Array<string>
  sort_order?: number
  skin_variations?: {[K in Chat2Types.EmojiSkinTone]: Object}
  unified: string
  userEmojiRenderStock?: string
  userEmojiRenderUrl?: string
}

export const getEmojiStr = (emoji: EmojiData, skinToneModifier?: string) => {
  if (emoji.userEmojiRenderUrl || emoji.userEmojiRenderStock) {
    return `:${emoji.short_name}:`
  }

  return `:${emoji.short_name}:${skinToneModifier ?? ''}`
}

export const renderEmoji = (emoji: EmojiData, size: number, skinToneModifier?: string) => {
  if (emoji.userEmojiRenderUrl) {
    return <Kb.CustomEmoji size={size} src={emoji.userEmojiRenderUrl} alias={emoji.short_name} />
  }

  if (emoji.userEmojiRenderStock) {
    return <Kb.Emoji size={size} emojiName={emoji.userEmojiRenderStock} />
  }

  return <Kb.Emoji size={size} emojiName={`:${emoji.short_name}:${skinToneModifier ?? ''}`} />
}

export const RPCUserReacjiToEmojiData = (userReacji: RPCTypes.UserReacji): EmojiData => {
  return {
    category: '',
    name: null,
    short_name: userReacji.name,
    short_names: [userReacji.name],
    unified: '',
    userEmojiRenderStock: userReacji.customAddr ? undefined : userReacji.name,
    userEmojiRenderUrl: userReacji.customAddr || undefined,
  }
}

export function RPCToEmojiData(emoji: RPCChatTypes.Emoji, category?: string): EmojiData {
  return {
    category: category ?? '',
    name: null,
    short_name: emoji.alias,
    short_names: [emoji.alias],
    unified: '',
    userEmojiRenderStock:
      emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.str ? emoji.source.str : undefined,
    userEmojiRenderUrl:
      emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.str ? undefined : emoji.source.httpsrv,
  }
}
