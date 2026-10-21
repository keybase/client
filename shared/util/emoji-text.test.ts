/// <reference types="jest" />
import {emojiShortcodesToText} from './emoji-text'
import {emojiIndexByName} from '@/common-adapters/markdown/emoji-gen'

test('replaces standard shortcodes with the emoji', () => {
  expect(emojiShortcodesToText('nice :+1: and :tada:')).toBe(
    `nice ${emojiIndexByName[':+1:']} and ${emojiIndexByName[':tada:']}`
  )
})

test('keeps skin tones', () => {
  expect(emojiShortcodesToText(':santa::skin-tone-2:')).toBe(emojiIndexByName[':santa::skin-tone-2:'])
})

test('a skin tone the emoji has no variant for stays as text', () => {
  expect(emojiShortcodesToText(':tada::skin-tone-2:')).toBe(`${emojiIndexByName[':tada:']}:skin-tone-2:`)
})

test('a colon that closes a non-emoji can open the next shortcode', () => {
  expect(emojiShortcodesToText('meet 10:30:tada:')).toBe(`meet 10:30${emojiIndexByName[':tada:']}`)
  expect(emojiShortcodesToText('foo:bar:smile: ::')).toBe(`foo:bar${emojiIndexByName[':smile:']} ::`)
})

test('leaves custom and unknown names and plain colons alone', () => {
  expect(emojiShortcodesToText('see :party-parrot: at 10:30: ok')).toBe('see :party-parrot: at 10:30: ok')
  expect(emojiShortcodesToText('')).toBe('')
})
