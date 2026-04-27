/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {getConvoState} from '@/stores/convostate'
import {createConversationInputStoreForTesting} from './input-state'

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  queueInboxRowUpdate: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const makeTextMessage = (override?: Omit<Partial<T.Chat.MessageText>, 'text'> & {text?: string}) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(101),
    ordinal: T.Chat.numberToOrdinal(101),
    outboxID: T.Chat.stringToOutboxID('outbox-1'),
    timestamp: 100,
    ...override,
    text: new HiddenString(override?.text ?? 'hello'),
  })

const makeAttachmentMessage = (override?: Partial<T.Chat.MessageAttachment>) =>
  Message.makeMessageAttachment({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(201),
    ordinal: T.Chat.numberToOrdinal(201),
    outboxID: T.Chat.stringToOutboxID('attachment-outbox'),
    timestamp: 100,
    title: 'attachment title',
    ...override,
  })

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('setEditing last picks the latest editable local message and injects its content', () => {
  const attachmentOrdinal = T.Chat.numberToOrdinal(703)
  getConvoState(convID).dispatch.galleryMessagesLoaded([
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(701),
      ordinal: T.Chat.numberToOrdinal(701),
      outboxID: T.Chat.stringToOutboxID('someone-else'),
    }),
    makeTextMessage({
      exploded: true,
      id: T.Chat.numberToMessageID(702),
      ordinal: T.Chat.numberToOrdinal(702),
      outboxID: T.Chat.stringToOutboxID('exploded-self'),
      text: 'ignore me',
    }),
    makeAttachmentMessage({
      id: T.Chat.numberToMessageID(703),
      ordinal: attachmentOrdinal,
      outboxID: T.Chat.stringToOutboxID('editable-attachment'),
      title: 'picked attachment title',
    }),
  ])
  const inputStore = createConversationInputStoreForTesting(convID)

  inputStore.getState().dispatch.setEditing('last')

  expect(inputStore.getState().editing).toBe(attachmentOrdinal)
  expect(inputStore.getState().unsentText).toBe('picked attachment title')
})

test('setEditing clear resets editing state and clears unsent text', () => {
  const inputStore = createConversationInputStoreForTesting(convID)
  const current = inputStore.getState()
  inputStore.setState({
    ...current,
    editing: T.Chat.numberToOrdinal(10),
    unsentText: 'draft text',
  })

  inputStore.getState().dispatch.setEditing('clear')

  expect(inputStore.getState().editing).toBe(T.Chat.numberToOrdinal(0))
  expect(inputStore.getState().unsentText).toBe('')
})
