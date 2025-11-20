import emojidata from 'emoji-datasource-apple'
import groupBy from 'lodash/groupBy'
import {type EmojiData, emojiNameMap, skinTones} from '@/util/emoji-shared'
import type * as Kb from '@/common-adapters'

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

const categoryIcons: Record<string, Kb.IconType> = {
  Activities: 'iconfont-basketball',
  'Animals & Nature': 'iconfont-pawprint',
  Flags: 'iconfont-flag',
  'Food & Drink': 'iconfont-apple',
  Objects: 'iconfont-music',
  'Smileys & People': 'iconfont-emoji',
  Symbols: 'iconfont-checkbox',
  'Travel & Places': 'iconfont-airplane',
}

const categories = categoryOrder.map(category => ({
  category,
  emojis: sorted[category] as unknown as Array<EmojiData>,
}))

const _emojiSearch = (filter: string, maxResults: number) => {
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

const defaultHoverEmoji = (emojiNameMap['potato'] || emojidata[0]) as EmojiData

export const emojiData = {
  get emojiSearch() {
    return _emojiSearch
  },
  get categories() {
    return categories
  },
  get categoryIcons() {
    return categoryIcons
  },
  get skinTones() {
    return skinTones
  },
  get emojiNameMap() {
    return emojiNameMap
  },
  get defaultHoverEmoji() {
    return defaultHoverEmoji
  },
}

