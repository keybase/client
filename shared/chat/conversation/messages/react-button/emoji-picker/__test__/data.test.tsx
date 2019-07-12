/* eslint-env jest */
import {categories, categoryOrder, emojiNameMap, emojiIndex} from '../data'
// @ts-ignore
import emojidata from 'emoji-datasource'

const searchIndexOmissions = [
  'skin-tone-2',
  'skin-tone-3',
  'skin-tone-4',
  'skin-tone-5',
  'skin-tone-6',
].sort()

describe('emoji data processing', () => {
  it('nameMap containes all possible search results', () => {
    let containsAll = true
    Object.values(emojiIndex.emojis).forEach((emoji: any) => {
      if (!emojiNameMap[emoji.id]) {
        containsAll = false
      }
    })
    expect(containsAll).toBe(true)
  })
  it('categorized data has same number of categories as category order', () =>
    expect(categories.length).toEqual(categoryOrder.length))
  it('search index is only missing skin tone variations', () => {
    const missingEmojis: Array<string> = []
    emojidata.forEach(emoji => {
      const fromIndex = emojiIndex.emojis[emoji.short_name]
      if (!fromIndex) {
        missingEmojis.push(emoji.short_name)
      }
    })
    expect(missingEmojis.sort()).toEqual(searchIndexOmissions)
  })
})
