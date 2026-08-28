/// <reference types="jest" />
import type {EmojiData} from '@/common-adapters/emoji'
import {getSkinToneModifierStrIfAvailable} from './index'

const emoji = (skinVariations?: Record<string, unknown>) =>
  ({
    short_name: 'wave',
    skin_variations: skinVariations,
    unified: '1F44B',
  }) as unknown as EmojiData

test('no modifier without a chosen skin tone', () => {
  expect(getSkinToneModifierStrIfAvailable(emoji({'1F3FB': {}}), undefined)).toBeUndefined()
})

test('no modifier when the emoji has no variations at all', () => {
  expect(getSkinToneModifierStrIfAvailable(emoji(), '1F3FB')).toBeUndefined()
  expect(getSkinToneModifierStrIfAvailable(emoji({}), '1F3FB')).toBeUndefined()
})

test('no modifier when the emoji lacks that particular variation', () => {
  expect(getSkinToneModifierStrIfAvailable(emoji({'1F3FB': {}}), '1F3FF')).toBeUndefined()
})

test('the modifier is the one based index into the fitzpatrick list', () => {
  const all = emoji({
    '1F3FA': {},
    '1F3FB': {},
    '1F3FC': {},
    '1F3FD': {},
    '1F3FE': {},
    '1F3FF': {},
  })
  expect(getSkinToneModifierStrIfAvailable(all, '1F3FA')).toBe(':skin-tone-1:')
  expect(getSkinToneModifierStrIfAvailable(all, '1F3FB')).toBe(':skin-tone-2:')
  expect(getSkinToneModifierStrIfAvailable(all, '1F3FF')).toBe(':skin-tone-6:')
})
