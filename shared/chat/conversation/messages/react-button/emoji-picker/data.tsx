import emojidata from 'emoji-datasource-apple'
import groupBy from 'lodash/groupBy'
import type {EmojiData} from '../../../../../util/emoji'

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
  emojis: sorted[category] as any as EmojiData,
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
