/// <reference types="jest" />
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {
  getClientPrevFromThread,
  showAttachmentPreview,
  showPDFViewer,
  takeAttachmentPreviewMessage,
  takePDFMessage,
} from './attachment-actions'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const messageID = T.Chat.numberToMessageID(42)

const attachment = (id: number) =>
  makeMessageAttachment({conversationIDKey, id: T.Chat.numberToMessageID(id)})

let navigateAppend: jest.SpyInstance

beforeEach(() => {
  navigateAppend = jest.spyOn(Router, 'navigateAppend').mockImplementation(() => true)
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('getClientPrevFromThread', () => {
  const message = (ordinal: number, id: number) =>
    makeMessageText({
      conversationIDKey,
      id: T.Chat.numberToMessageID(id),
      ordinal: T.Chat.numberToOrdinal(ordinal),
    })

  const mapOf = (...messages: ReadonlyArray<T.Chat.Message>) =>
    new Map(messages.map(m => [m.ordinal, m] as const))

  test('is zero with no messages', () => {
    expect(getClientPrevFromThread(new Map())).toBe(0)
    expect(getClientPrevFromThread(new Map(), [])).toBe(0)
  })

  test('takes the id of the newest message that has one', () => {
    const older = message(1, 10)
    const newer = message(2, 11)
    expect(getClientPrevFromThread(mapOf(older, newer), [older.ordinal, newer.ordinal])).toBe(11)
  })

  test('skips pending messages that have no id yet', () => {
    const sent = message(1, 10)
    const pending = message(2, 0)
    expect(getClientPrevFromThread(mapOf(sent, pending), [sent.ordinal, pending.ordinal])).toBe(10)
  })

  test('skips ordinals that are not in the map', () => {
    const sent = message(1, 10)
    const missing = T.Chat.numberToOrdinal(2)
    expect(getClientPrevFromThread(mapOf(sent), [sent.ordinal, missing])).toBe(10)
  })
})

describe('attachment preview handoff', () => {
  test('hands the message to the fullscreen route exactly once', () => {
    const message = attachment(42)
    showAttachmentPreview(conversationIDKey, message)
    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatAttachmentFullscreen',
      params: {conversationIDKey, messageID},
    })
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBe(message)
    // a second mount must not replay the stale message
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
  })

  test('is keyed by conversation and message', () => {
    const message = attachment(42)
    showAttachmentPreview(conversationIDKey, message)
    const other = T.Chat.stringToConversationIDKey('conv2')
    expect(takeAttachmentPreviewMessage(other, messageID)).toBeUndefined()
    expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(43))).toBeUndefined()
    // the misses above must not have drained the mailbox
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBe(message)
  })

  test('refuses to navigate for a message with no id', () => {
    showAttachmentPreview(conversationIDKey, attachment(0))
    expect(navigateAppend).not.toHaveBeenCalled()
    expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(0))).toBeUndefined()
  })
})

describe('pdf handoff', () => {
  test('passes the url through only when there is one', () => {
    showPDFViewer(conversationIDKey, attachment(42))
    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatPDF',
      params: {conversationIDKey, messageID},
    })
    showPDFViewer(conversationIDKey, attachment(42), 'https://example.com/a.pdf')
    expect(navigateAppend).toHaveBeenLastCalledWith({
      name: 'chatPDF',
      params: {conversationIDKey, messageID, url: 'https://example.com/a.pdf'},
    })
  })

  test('does not share the preview mailbox', () => {
    const message = attachment(42)
    showPDFViewer(conversationIDKey, message)
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
    expect(takePDFMessage(conversationIDKey, messageID)).toBe(message)
  })

  test('refuses to navigate for a message with no id', () => {
    showPDFViewer(conversationIDKey, attachment(0))
    expect(navigateAppend).not.toHaveBeenCalled()
  })
})

test('signing out drops messages waiting in the handoff mailboxes', () => {
  showAttachmentPreview(conversationIDKey, attachment(42))
  showPDFViewer(conversationIDKey, attachment(42))
  resetAllStores()
  expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
  expect(takePDFMessage(conversationIDKey, messageID)).toBeUndefined()
})
