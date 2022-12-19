import * as Kb from '../common-adapters'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import emojidata from 'emoji-datasource-apple'
import groupBy from 'lodash/groupBy'
import type * as Styles from '../styles'
import type * as Chat2Types from '../constants/types/chat2'
import type * as RPCTypes from '../constants/types/rpc-gen'

const categorized = groupBy(emojidata, 'category')
const sorted: typeof categorized = {}
for (const cat in categorized) {
  sorted[cat] = categorized[cat].sort((a, b) => a.sort_order - b.sort_order)
}
delete sorted.undefined
export const categoryOrder = [
  'Smileys & Emotion',
  'Animals & Nature',
  'Food & Drink',
  'Activities',
  'Travel & Places',
  'Objects',
  'Symbols',
  'Flags',
]
export const categoryIcons = {
  Activities: 'iconfont-basketball',
  'Animals & Nature': 'iconfont-pawprint',
  Flags: 'iconfont-flag',
  'Food & Drink': 'iconfont-apple',
  Objects: 'iconfont-music',
  'Smileys & Emotion': 'iconfont-emoji',
  Symbols: 'iconfont-checkbox',
  'Travel & Places': 'iconfont-airplane',
}

export const categories = categoryOrder.map(category => ({
  category,
  emojis: sorted[category] as any as Array<EmojiData>,
}))

export const emojiNameMap = Object.values(emojidata).reduce((res: {[K in string]: EmojiData}, emoji: any) => {
  res[emoji.short_name] = emoji
  return res
}, {})

export const emojiSearch = (filter: string, maxResults: number) => {
  const parts = filter.toLowerCase().split(/[\s|,|\-|_]+/)
  const vals: Array<EmojiData> = Object.values(emojidata as any)
  type ResType = Array<{emoji: EmojiData; score: number}>
  const res = vals.reduce<ResType>((arr, emoji: EmojiData) => {
    let score = 0

    const looking = [...new Set([emoji.name, emoji.category, emoji.short_name, ...emoji.short_names])].map(
      l => (l ? l.toLowerCase() : '')
    )

    looking.forEach(look => {
      parts.forEach(part => {
        if (!look || !part) return
        const idx = look.indexOf(part)
        if (idx === -1) return
        if (idx === 0) {
          score += 3
        } else {
          score += 1
        }
      })
    })

    if (score) {
      arr.push({emoji, score})
    }
    return arr
  }, [])

  res.sort((a, b) => b.score - a.score)
  res.length = Math.min(res.length, maxResults)
  return res.map(r => r.emoji)
}

export const skinTones = ['1F3FA', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const

export const defaultHoverEmoji = emojiNameMap.potato || emojidata[0]

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
  sheet_x: number
  sheet_y: number
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

export const renderEmoji = (opts: {
  emoji: RenderableEmoji
  size: number
  showTooltip: boolean
  customEmojiSize?: number
  virtualText?: boolean
  customStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
}) => {
  const {emoji, size, showTooltip, customEmojiSize, virtualText, customStyle, style} = opts
  if (emoji.renderUrl) {
    return (
      <Kb.CustomEmoji
        size={customEmojiSize ?? size}
        src={emoji.renderUrl}
        alias={showTooltip ? emoji.aliasForCustom : undefined}
        style={customStyle}
      />
    )
  }

  if (emoji.renderStock) {
    return <Kb.Emoji size={size} emojiName={emoji.renderStock} disableSelecting={virtualText} style={style} />
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
    sheet_x: -1,
    sheet_y: -1,
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
      ...(skinToneModifier && skinToneKey
        ? // @ts-ignore
          emoji.skin_variations?.[skinToneKey].unified ?? ''
        : emoji.unified
      )
        .split('-')
        .map((str: string) => Number.parseInt(str, 16))
    ),
})
