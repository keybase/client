import type * as ED from './slow-data'

export const emojiData = {
  get categories() {
    const ed = require('./slow-data') as typeof ED
    return ed.categories
  },
  get categoryIcons() {
    const ed = require('./slow-data') as typeof ED
    return ed.categoryIcons
  },
  get defaultHoverEmoji() {
    const ed = require('./slow-data') as typeof ED
    return ed.defaultHoverEmoji
  },
  get emojiNameMap() {
    const ed = require('./slow-data') as typeof ED
    return ed.emojiNameMap
  },
  get emojiSearch() {
    const ed = require('./slow-data') as typeof ED
    return ed.emojiSearch
  },
  get skinTones() {
    const ed = require('./slow-data') as typeof ED
    return ed.skinTones
  },
}
