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

  test('every canonical short name is owned by its own emoji, and its aliases point back at it', () => {
    const canonicalNames = new Set(Object.values(emojiNameMap).map(e => e.short_name))
    expect(canonicalNames.size).toBeGreaterThan(1000)
    for (const name of canonicalNames) {
      const emoji = emojiNameMap[name]
      // an alias pass must never have taken this entry over
      expect(emoji?.short_name).toBe(name)
      for (const alias of emoji!.short_names) {
        expect(emojiNameMap[alias]).toBe(emoji)
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

  test('maxResults truncates after ranking, so the best matches survive', () => {
    const all = emojiSearch('face', 100).map(e => e.short_name)
    expect(all.length).toBeGreaterThan(5)
    expect(emojiSearch('face', 5).map(e => e.short_name)).toEqual(all.slice(0, 5))
  })
})

test('skinTones is the five real fitzpatrick modifiers plus a default-yellow sentinel', () => {
  expect(skinTones).toHaveLength(6)
  expect(new Set(skinTones).size).toBe(6)

  const variationKeys = new Set<string>()
  for (const {emojis} of categories) {
    for (const emoji of emojis) {
      for (const key of Object.keys(emoji.skin_variations ?? {})) {
        variationKeys.add(key)
      }
    }
  }
  // 1F3FB-1F3FF are the modifiers the data actually keys its variations on
  const [defaultTone, ...modifiers] = skinTones
  expect(modifiers).toEqual(['1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'])
  for (const modifier of modifiers) {
    expect(variationKeys.has(modifier)).toBe(true)
  }
  // the first entry is a sentinel for "no modifier"; no emoji has a variation for it
  expect(defaultTone).toBe('1F3FA')
  expect(variationKeys.has(defaultTone!)).toBe(false)
})

test('defaultHoverEmoji resolves', () => {
  expect(defaultHoverEmoji.short_name).toBe('potato')
})
