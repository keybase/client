// @flow
import {emojiIndex} from 'emoji-mart'
import emojidata from 'emoji-datasource'
import {groupBy} from 'lodash-es'

export type EmojiData = {
  category: string,
  name: ?string,
  short_name: string,
  unified: string,
}

const categorized = groupBy(emojidata, 'category')
const sorted = {}
for (let cat in categorized) {
  sorted[cat] = categorized[cat].sort((a, b) => a.sort_order - b.sort_order)
}
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
// TODO type emojis
const categories: Array<{category: string, emojis: Array<EmojiData>}> = categoryOrder.map(category => ({
  category,
  emojis: sorted[category],
}))

export {categories, emojiIndex}
