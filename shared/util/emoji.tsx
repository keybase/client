import * as React from 'react'
import * as Kb from '../common-adapters'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Chat2Types from '../constants/types/chat2'

export type EmojiData = {
  category: string
  name: string | null
  obsoleted_by?: string
  short_name: string
  short_names: Array<string>
  sort_order?: number
  skin_variations?: {[K in Chat2Types.EmojiSkinTone]: Object}
  teamname?: string
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

export type RenderableEmoji = {
  aliasForCustom?: string
  unicodeStock?: string
  renderStock?: string
  renderUrl?: string
}

export const renderEmoji = (
  emoji: RenderableEmoji,
  size: number,
  showTooltip: boolean,
  addTopMarginToCustom?: boolean,
  customEmojiSize?: number
) => {
  if (emoji.renderUrl) {
    return (
      <Kb.CustomEmoji
        size={customEmojiSize ?? size}
        src={emoji.renderUrl}
        alias={showTooltip ? emoji.aliasForCustom : undefined}
        addTopMargin={addTopMarginToCustom}
      />
    )
  }

  if (emoji.renderStock) {
    return <Kb.Emoji size={size} emojiName={emoji.renderStock} />
  }

  return null
}

export const RPCUserReacjiToRenderableEmoji = (
  userReacji: RPCTypes.UserReacji,
  noAnim: boolean
): RenderableEmoji => ({
  aliasForCustom: userReacji.name,
  renderStock: userReacji.customAddr ? undefined : userReacji.name,
  renderUrl: noAnim ? userReacji.customAddrNoAnim || undefined : userReacji.customAddr || undefined,
})

export function RPCToEmojiData(emoji: RPCChatTypes.Emoji, noAnim: boolean, category?: string): EmojiData {
  return {
    category: category ?? '',
    name: null,
    short_name: emoji.alias,
    short_names: [emoji.alias],
    teamname: emoji.teamname ?? undefined,
    unified: '',
    userEmojiRenderStock:
      emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.str ? emoji.source.str : undefined,
    userEmojiRenderUrl:
      emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.str
        ? undefined
        : noAnim && emoji.noAnimSource.typ === RPCChatTypes.EmojiLoadSourceTyp.httpsrv
        ? emoji.noAnimSource.httpsrv
        : emoji.source.httpsrv,
  }
}

export const emojiDataToRenderableEmoji = (
  emoji: EmojiData,
  skinToneModifier?: string,
  skinToneKey?: Chat2Types.EmojiSkinTone
): RenderableEmoji => ({
  aliasForCustom: emoji.short_name,
  renderStock: emoji.userEmojiRenderStock ?? `:${emoji.short_name}:${skinToneModifier ?? ''}`,
  renderUrl: emoji.userEmojiRenderUrl,
  unicodeStock:
    emoji.unified &&
    String.fromCodePoint(
      // @ts-ignore
      ...(skinToneModifier && skinToneKey ? emoji.skin_variations?.[skinToneKey].unified : emoji.unified)
        .split('-')
        .map((str: string) => Number.parseInt(str, 16))
    ),
})
