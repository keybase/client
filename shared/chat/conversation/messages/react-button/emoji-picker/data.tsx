import {emojiIndex} from 'emoji-mart'
import emojidata from 'emoji-datasource'
import groupBy from 'lodash/groupBy'
import {EmojiData} from '../../../../../util/emoji'

const categorized = groupBy(emojidata, 'category')
const sorted: typeof categorized = {}
for (const cat in categorized) {
  sorted[cat] = categorized[cat].sort((a, b) => a.sort_order - b.sort_order)
}
delete sorted.undefined
const categoryOrder = [
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
// @ts-ignore
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
    // sometimes its a collection of things
    if (emoji.id === undefined && emoji[1]) {
      emoji = emoji[1]
    }
    const shortName = emoji.id
    const emojiFromEmojiData = emojidata.find(e => e.short_name === shortName)
    if (emojiFromEmojiData) {
      // @ts-ignore
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
