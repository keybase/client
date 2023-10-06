import Emoji from '../common-adapters/emoji'
import emojidata from 'emoji-datasource-apple'
import groupBy from 'lodash/groupBy'
import type * as Styles from '../styles'
import * as T from '../constants/types'
import CustomEmoji from './custom-emoji'
import {type EmojiData, emojiNameMap} from '../util/emoji-shared'
export {type EmojiData, emojiNameMap, skinTones} from '../util/emoji-shared'

const categorized = groupBy(emojidata, 'category')
const sorted: typeof categorized = {}
for (const cat in categorized) {
  if (cat && cat !== 'undefined') {
    sorted[cat] = categorized[cat]!.sort((a, b) => a.sort_order - b.sort_order)
  }
}
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

export const defaultHoverEmoji = emojiNameMap['potato'] || emojidata[0]

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
      <CustomEmoji
        size={customEmojiSize ?? size}
        src={emoji.renderUrl}
        alias={showTooltip ? emoji.aliasForCustom : undefined}
        style={customStyle}
      />
    )
  }

  if (emoji.renderStock) {
    return <Emoji size={size} emojiName={emoji.renderStock} disableSelecting={virtualText} style={style} />
  }

  return null
}

export const RPCUserReacjiToRenderableEmoji = (
  userReacji: T.RPCGen.UserReacji,
  noAnim: boolean
): RenderableEmoji => ({
  aliasForCustom: userReacji.name,
  renderStock: userReacji.customAddr ? undefined : userReacji.name,
  renderUrl: noAnim ? userReacji.customAddrNoAnim || undefined : userReacji.customAddr || undefined,
})

export function RPCToEmojiData(emoji: T.RPCChat.Emoji, noAnim: boolean, category?: string): EmojiData {
  return {
    category: category ?? '',
    name: undefined,
    sheet_x: -1,
    sheet_y: -1,
    short_name: emoji.alias,
    short_names: [emoji.alias],
    teamname: emoji.teamname ?? undefined,
    unified: '',
    userEmojiRenderStock:
      emoji.source.typ === T.RPCChat.EmojiLoadSourceTyp.str ? emoji.source.str : undefined,
    userEmojiRenderUrl:
      emoji.source.typ === T.RPCChat.EmojiLoadSourceTyp.str
        ? undefined
        : noAnim && emoji.noAnimSource.typ === T.RPCChat.EmojiLoadSourceTyp.httpsrv
        ? emoji.noAnimSource.httpsrv
        : emoji.source.httpsrv,
  }
}

export const emojiDataToRenderableEmoji = (
  emoji: EmojiData,
  skinToneModifier?: string,
  skinToneKey?: T.Chat.EmojiSkinTone
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
