import * as ED from './slow-data'

export const emojiData = {
  get categories() {
    return ED.categories
  },
  get categoryIcons() {
    return ED.categoryIcons
  },
  get defaultHoverEmoji() {
    return ED.defaultHoverEmoji
  },
  get emojiNameMap() {
    return ED.emojiNameMap
  },
  get emojiSearch() {
    return ED.emojiSearch
  },
  get skinTones() {
    return ED.skinTones
  },
}
