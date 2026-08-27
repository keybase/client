/// <reference types="jest" />

import {expect, test, describe} from '@jest/globals'
import {categories, categoryIcons, emojiNameMap, emojiSearch, defaultHoverEmoji, skinTones} from './slow-data'

describe('emojiNameMap', () => {
  test('maps canonical short names', () => {
    expect(emojiNameMap['smile']?.short_name).toBe('smile')
    expect(emojiNameMap['+1']?.short_name).toBe('+1')
  })

  test('aliases resolve to the same emoji as the canonical name', () => {
    const canonical = emojiNameMap['+1']
    expect(canonical).toBeTruthy()
    for (const alias of canonical!.short_names) {
      expect(emojiNameMap[alias]).toBe(canonical)
    }
  })

  test('unknown names are absent', () => {
    expect(emojiNameMap['definitely-not-an-emoji']).toBeUndefined()
  })

  test('an alias never overwrites an emoji that owns that short name', () => {
    for (const [name, emoji] of Object.entries(emojiNameMap)) {
      const owner = emojiNameMap[emoji.short_name]
      // if some other emoji claims `name` as its canonical short_name, that one wins
      if (owner?.short_name === name) {
        expect(emoji.short_name).toBe(name)
      }
    }
  })
})

describe('categories', () => {
  test('are in the documented display order', () => {
    expect(categories.map(c => c.category)).toEqual([
      'Smileys & People',
      'Animals & Nature',
      'Food & Drink',
      'Activities',
      'Travel & Places',
      'Objects',
      'Symbols',
      'Flags',
    ])
  })

  test('every category is non-empty and has an icon', () => {
    for (const {category, emojis} of categories) {
      expect(emojis.length).toBeGreaterThan(0)
      expect(categoryIcons[category]).toBeTruthy()
    }
  })

  test('emojis inside a category are sorted by sort_order', () => {
    for (const {emojis} of categories) {
      const orders = emojis.map(e => e.sort_order)
      expect(orders).toEqual([...orders].sort((a, b) => a - b))
    }
  })

  test('Smileys & People merges the two upstream categories', () => {
    const smileys = categories[0]!.emojis
    const raw = new Set(smileys.map(e => e.category))
    expect(raw).toEqual(new Set(['Smileys & Emotion', 'People & Body']))
  })

  test('the Component category is dropped', () => {
    expect(categories.some(c => c.category === 'Component')).toBe(false)
  })
})

describe('emojiSearch', () => {
  test('respects maxResults', () => {
    expect(emojiSearch('face', 5)).toHaveLength(5)
    expect(emojiSearch('face', 1)).toHaveLength(1)
  })

  test('prefix matches outrank substring matches', () => {
    const res = emojiSearch('smile', 10)
    expect(res[0]?.short_name.startsWith('smile')).toBe(true)
  })

  test('an exact short name is found', () => {
    expect(emojiSearch('potato', 10).map(e => e.short_name)).toContain('potato')
  })

  test('is case insensitive', () => {
    expect(emojiSearch('POTATO', 5).map(e => e.short_name)).toEqual(
      emojiSearch('potato', 5).map(e => e.short_name)
    )
  })

  test('splits the filter on spaces, commas, dashes and underscores', () => {
    const dashed = emojiSearch('flag-us', 5).map(e => e.short_name)
    const spaced = emojiSearch('flag us', 5).map(e => e.short_name)
    expect(dashed).toEqual(spaced)
    // the US flag's canonical short_name is `us`; `flag-us` is one of its aliases
    expect(dashed[0]).toBe('us')
    expect(emojiSearch('flag-us', 5)[0]?.short_names).toContain('flag-us')
  })

  test('nonsense filters return nothing', () => {
    expect(emojiSearch('zzzzqqqqxxxx', 10)).toEqual([])
  })

  test('results are unique', () => {
    const res = emojiSearch('face', 25)
    expect(new Set(res).size).toBe(res.length)
  })
})

test('skinTones covers the five fitzpatrick modifiers plus the default', () => {
  expect(skinTones).toHaveLength(6)
  expect(new Set(skinTones).size).toBe(6)
})

test('defaultHoverEmoji resolves', () => {
  expect(defaultHoverEmoji.short_name).toBe('potato')
})
