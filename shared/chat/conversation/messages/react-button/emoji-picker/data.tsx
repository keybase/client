import {emojiIndex} from 'emoji-mart'
// @ts-ignore
import emojidata from 'emoji-datasource'
import groupBy from 'lodash/groupBy'
import * as Types from '../../../../../constants/types/chat2'

export type EmojiData = {
  category: string
  name: string | null
  short_name: string
  short_names: Array<string>
  unified: string
  skin_variations?: {[K in Types.EmojiSkinTone]: Object}
  source?: string
}

const categorized = groupBy(emojidata, 'category')
const sorted: typeof categorized = {}
for (const cat in categorized) {
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

export const skinTones = new Map(
  categorized['Skin Tones'].map(skinTone => [skinTone.unified, skinTone]) ?? []
)

export const defaultHoverEmoji = emojiNameMap.potato || emojidata[0]

export {categories, categoryOrder, emojiIndex, emojiNameMap}
