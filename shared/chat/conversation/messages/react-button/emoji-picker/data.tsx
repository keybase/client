import emojidata from 'emoji-datasource'
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
  const res = Object.values(emojidata as any).map((emoji: EmojiData) => {
    let score = 0

    const looking = [...new Set([emoji.name, emoji.category, emoji.short_name, ...emoji.short_names])].map(
      l => (l ? l.toLowerCase() : '')
    )

    // TODO flags coming in????

    looking.forEach(look => {
      parts.forEach(part => {
        const idx = look.indexOf(part)
        if (idx === -1) return
        if (idx === 0) {
          score += 3
        } else {
          score += 1
        }
      })
    })

    return {emoji, score}
  })

  res.sort((a, b) => b.score - a.score)
  res.length = Math.min(res.length, maxResults)
  return res.map(r => r.emoji)
}

export const skinTones = new Map(
  categorized['Skin Tones'].map(skinTone => [skinTone.unified, skinTone]) ?? []
)

export const defaultHoverEmoji = emojiNameMap.potato || emojidata[0]
