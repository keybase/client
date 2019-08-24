import {emojiIndex} from 'emoji-mart'
// @ts-ignore
import emojidata from 'emoji-datasource'
import {groupBy} from 'lodash-es'

export type EmojiData = {
  category: string
  name: string | null
  short_name: string
  unified: string
}

const categorized = groupBy(emojidata, 'category')
const sorted = {}
for (let cat in categorized) {
  sorted[cat] = categorized[cat].sort((a, b) => a.sort_order - b.sort_order)
}
// @ts-ignore
delete sorted.undefined
const categoryOrder = [
  'Smileys & People',
  'Animals & Nature',
  'Food & Drink',
  'Activities',
  'Travel & Places',
  'Objects',
  'Symbols',
  'Flags',
]
const categories: Array<{
  category: string
  emojis: Array<EmojiData>
}> = categoryOrder.map(category => ({
  category,
  emojis: sorted[category],
}))

// Map from EmojiMart's `id` to EmojiDatasource's object
const emojiNameMap = Object.values(emojiIndex.emojis).reduce(
  (res: {[K in string]: EmojiData}, emoji: any) => {
    const shortName = emoji.id
    const emojiFromEmojiData = emojidata.find(e => e.short_name === shortName)
    if (emojiFromEmojiData) {
      res[shortName] = emojiFromEmojiData
    }
    return res
  },
  {}
)

export {categories, categoryOrder, emojiIndex, emojiNameMap}
