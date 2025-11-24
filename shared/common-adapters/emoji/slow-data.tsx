// this file is loaded by emoji.tsx in a deferred way since its expensive to parse
import emojidata, {type EmojiData} from 'emoji-datasource-apple'
import groupBy from 'lodash/groupBy'
import type * as Kb from '@/common-adapters'

export const skinTones = ['1F3FA', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const
export const emojiNameMap = Object.values(emojidata).reduce<Record<string, EmojiData>>((res, emoji) => {
  res[emoji.short_name] = emoji
  return res
}, {})

export type {EmojiData} from 'emoji-datasource-apple'

const categorized = groupBy(emojidata, 'category')
categorized['Smileys & People'] = [
  ...(categorized['Smileys & Emotion'] ?? []),
  ...(categorized['People & Body'] ?? []),
]
delete categorized['Smileys & Emotion']
delete categorized['People & Body']
delete categorized['Component']

const sorted: typeof categorized = {}
for (const cat in categorized) {
  if (cat && cat !== 'undefined') {
    sorted[cat] = categorized[cat]!.sort((a, b) => a.sort_order - b.sort_order)
  }
}

export const categoryOrder = [
  'Smileys & People',
  'Animals & Nature',
  'Food & Drink',
  'Activities',
  'Travel & Places',
  'Objects',
  'Symbols',
  'Flags',
]

if (__DEV__ && Object.keys(categorized).sort().join(',') !== [...categoryOrder].sort().join(',')) {
  console.log('[EMOJI] categories incorrect!', categorized)
}

export const categoryIcons: Record<string, Kb.IconType> = {
  Activities: 'iconfont-basketball',
  'Animals & Nature': 'iconfont-pawprint',
  Flags: 'iconfont-flag',
  'Food & Drink': 'iconfont-apple',
  Objects: 'iconfont-music',
  'Smileys & People': 'iconfont-emoji',
  Symbols: 'iconfont-checkbox',
  'Travel & Places': 'iconfont-airplane',
}

export const categories = categoryOrder.map(category => ({
  category,
  emojis: sorted[category] as unknown as Array<EmojiData>,
}))

export const emojiSearch = (filter: string, maxResults: number) => {
  const parts = filter.toLowerCase().split(/[\s|,|\-|_]+/)
  const vals: Array<EmojiData> = Object.values(emojidata)
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

export const defaultHoverEmoji = (emojiNameMap['potato'] || emojidata[0]) as EmojiData
