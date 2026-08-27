/// <reference types="jest" />

import {expect, test, describe} from '@jest/globals'
import * as T from '@/constants/types'
import type {EmojiData} from './slow-data'
import {RPCToEmojiData, emojiDataToRenderableEmoji, getEmojiStr} from './index'

const makeEmojiData = (p: Partial<EmojiData> = {}): EmojiData =>
  ({
    category: 'Smileys & People',
    name: 'SMILING FACE',
    non_qualified: '',
    sheet_x: 0,
    sheet_y: 0,
    short_name: 'smile',
    short_names: ['smile'],
    sort_order: 1,
    unified: '1F604',
    ...p,
  }) as EmojiData

const makeRPCEmoji = (source: T.RPCChat.EmojiLoadSource, noAnimSource?: T.RPCChat.EmojiLoadSource) =>
  ({
    alias: 'party_parrot',
    isAlias: false,
    isBig: false,
    isCrossTeam: false,
    isReacji: false,
    noAnimSource: noAnimSource ?? source,
    remoteSource: {typ: T.RPCChat.EmojiRemoteSourceTyp.stockalias},
    source,
  }) as unknown as T.RPCChat.Emoji

describe('emojiDataToRenderableEmoji', () => {
  test('stock emoji decodes unified codepoints', () => {
    const r = emojiDataToRenderableEmoji(makeEmojiData())
    expect(r.aliasForCustom).toBe('smile')
    expect(r.renderStock).toBe(':smile:')
    expect(r.renderUrl).toBeUndefined()
    expect(r.unicodeStock).toBe('\u{1F604}')
  })

  test('multi-codepoint unified values join into one string', () => {
    const r = emojiDataToRenderableEmoji(makeEmojiData({short_name: 'flag-us', unified: '1F1FA-1F1F8'}))
    expect(r.unicodeStock).toBe('\u{1F1FA}\u{1F1F8}')
  })

  test('skin tone modifier is appended to the stock render string', () => {
    const r = emojiDataToRenderableEmoji(makeEmojiData(), '::skin-tone-3')
    expect(r.renderStock).toBe(':smile:::skin-tone-3')
  })

  test('skin tone key selects the matching skin variation codepoints', () => {
    const data = makeEmojiData({
      short_name: 'wave',
      skin_variations: {'1F3FD': {unified: '1F44B-1F3FD'}},
      unified: '1F44B',
    } as Partial<EmojiData>)
    const r = emojiDataToRenderableEmoji(data, '::skin-tone-4', '1F3FD')
    expect(r.unicodeStock).toBe('\u{1F44B}\u{1F3FD}')
  })

  test('user emoji render overrides win over the derived stock name', () => {
    const r = emojiDataToRenderableEmoji(
      makeEmojiData({unified: '', userEmojiRenderUrl: 'https://example.com/e.png'} as Partial<EmojiData>)
    )
    expect(r.renderUrl).toBe('https://example.com/e.png')
    expect(r.unicodeStock).toBe('')
  })
})

describe('getEmojiStr', () => {
  test('stock emoji keeps the skin tone modifier', () => {
    expect(getEmojiStr(makeEmojiData(), '::skin-tone-2')).toBe(':smile:::skin-tone-2')
  })

  test('no modifier means a bare name', () => {
    expect(getEmojiStr(makeEmojiData())).toBe(':smile:')
  })

  test('custom emoji drop the skin tone modifier entirely', () => {
    const custom = makeEmojiData({userEmojiRenderUrl: 'https://example.com/e.png'} as Partial<EmojiData>)
    expect(getEmojiStr(custom, '::skin-tone-2')).toBe(':smile:')
    const stockAlias = makeEmojiData({userEmojiRenderStock: ':+1:'} as Partial<EmojiData>)
    expect(getEmojiStr(stockAlias, '::skin-tone-2')).toBe(':smile:')
  })
})

describe('RPCToEmojiData', () => {
  test('str sources become stock aliases with no url', () => {
    const d = RPCToEmojiData(makeRPCEmoji({str: ':+1:', typ: T.RPCChat.EmojiLoadSourceTyp.str}), false)
    expect(d.userEmojiRenderStock).toBe(':+1:')
    expect(d.userEmojiRenderUrl).toBeUndefined()
    expect(d.short_name).toBe('party_parrot')
    expect(d.short_names).toEqual(['party_parrot'])
    expect(d.category).toBe('')
  })

  test('httpsrv sources become urls with no stock alias', () => {
    const d = RPCToEmojiData(
      makeRPCEmoji({httpsrv: 'http://localhost/anim.gif', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv}),
      false
    )
    expect(d.userEmojiRenderStock).toBeUndefined()
    expect(d.userEmojiRenderUrl).toBe('http://localhost/anim.gif')
  })

  test('noAnim picks the still url when one exists', () => {
    const emoji = makeRPCEmoji(
      {httpsrv: 'http://localhost/anim.gif', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv},
      {httpsrv: 'http://localhost/still.png', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv}
    )
    expect(RPCToEmojiData(emoji, true).userEmojiRenderUrl).toBe('http://localhost/still.png')
    expect(RPCToEmojiData(emoji, false).userEmojiRenderUrl).toBe('http://localhost/anim.gif')
  })

  test('noAnim falls back to the animated url when the still source is not httpsrv', () => {
    const emoji = makeRPCEmoji(
      {httpsrv: 'http://localhost/anim.gif', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv},
      {str: ':+1:', typ: T.RPCChat.EmojiLoadSourceTyp.str}
    )
    expect(RPCToEmojiData(emoji, true).userEmojiRenderUrl).toBe('http://localhost/anim.gif')
  })

  test('category is passed through when given', () => {
    const d = RPCToEmojiData(
      makeRPCEmoji({str: ':+1:', typ: T.RPCChat.EmojiLoadSourceTyp.str}),
      false,
      'teamname'
    )
    expect(d.category).toBe('teamname')
  })
})
