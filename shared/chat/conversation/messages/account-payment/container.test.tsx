/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {makeChatPaymentInfo, makeChatRequestInfo, makeMessageRequestPayment} from '@/constants/chat/message'
import {getRequestMessageInfo, makeSendPaymentVerb} from './container'

describe('makeSendPaymentVerb', () => {
  test('pending reads the same for both sides', () => {
    expect(makeSendPaymentVerb('pending', true)).toBe('sending')
    expect(makeSendPaymentVerb('pending', false)).toBe('sending')
  })

  test('canceled and claimable soften for the recipient', () => {
    for (const status of ['canceled', 'claimable'] as const) {
      expect(makeSendPaymentVerb(status, true)).toBe('sending')
      expect(makeSendPaymentVerb(status, false)).toBe('attempting to send')
    }
  })

  test('errors read as attempted for both sides', () => {
    expect(makeSendPaymentVerb('error', true)).toBe('attempted to send')
    expect(makeSendPaymentVerb('error', false)).toBe('attempted to send')
  })

  test('anything else is a completed send', () => {
    expect(makeSendPaymentVerb('completed', true)).toBe('sent')
    expect(makeSendPaymentVerb('none', false)).toBe('sent')
  })
})

describe('getRequestMessageInfo', () => {
  const messageID = T.Chat.numberToMessageID(4)
  const message = makeMessageRequestPayment({
    conversationIDKey: T.Chat.stringToConversationIDKey('conv1'),
    id: messageID,
    requestInfo: makeChatRequestInfo({amount: 'from the message'}),
  })

  test('falls back to the info already on the message', () => {
    expect(getRequestMessageInfo(new Map(), message)?.amount).toBe('from the message')
  })

  test('a later info from the accounts map wins', () => {
    const fresher = makeChatRequestInfo({amount: 'from the map'})
    expect(getRequestMessageInfo(new Map([[messageID, fresher]]), message)).toBe(fresher)
  })

  test('throws when the map holds a payment info for a request message', () => {
    const wrongType = makeChatPaymentInfo()
    expect(() => getRequestMessageInfo(new Map([[messageID, wrongType]]), message)).toThrow()
  })
})
