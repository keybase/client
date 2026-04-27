/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {getConvoState} from '@/stores/convostate'
import {
  createConversationInputStoreForTesting,
  injectConversationInputText,
  onConversationInputEngineAction,
} from './input-state'

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  queueInboxRowUpdate: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

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

const makeGiphyResult = (targetUrl = 'https://media.giphy.com/media/target/giphy.gif') => ({
  preferredPreviewUrl: 'https://media.giphy.com/media/preview/giphy.gif',
  previewHeight: 120,
  previewIsVideo: false,
  previewUrl: 'https://media.giphy.com/media/preview/giphy.gif',
  previewWidth: 160,
  targetUrl,
})

const mockPostText = () => {
  let lastPost:
    | Parameters<typeof T.RPCChat.localPostTextNonblockRpcListener>[0]
    | undefined
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    lastPost = p
    return {outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID('posted-outbox'))}
  })
  return () => lastPost
}

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

test('setEditing explicit ordinal selects editable text and ignores missing messages', () => {
  const editOrdinal = T.Chat.numberToOrdinal(704)
  getConvoState(convID).dispatch.galleryMessagesLoaded([
    makeTextMessage({
      id: T.Chat.numberToMessageID(704),
      ordinal: editOrdinal,
      outboxID: T.Chat.stringToOutboxID('editable-text'),
      text: 'explicit edit text',
    }),
  ])
  const inputStore = createConversationInputStoreForTesting(convID)

  inputStore.getState().dispatch.setEditing(editOrdinal)

  expect(inputStore.getState().editing).toBe(editOrdinal)
  expect(inputStore.getState().unsentText).toBe('explicit edit text')

  inputStore.getState().dispatch.setEditing(T.Chat.numberToOrdinal(999))

  expect(inputStore.getState().editing).toBe(editOrdinal)
  expect(inputStore.getState().unsentText).toBe('explicit edit text')
})

test('external input injection is scoped to the target conversation', () => {
  const inputStore = createConversationInputStoreForTesting(convID)
  const otherInputStore = createConversationInputStoreForTesting(otherConvID)

  injectConversationInputText(convID, 'prefill from share')

  expect(inputStore.getState().unsentText).toBe('prefill from share')
  expect(otherInputStore.getState().unsentText).toBeUndefined()

  injectConversationInputText(convID, '')

  expect(inputStore.getState().unsentText).toBe('')

  injectConversationInputText(convID)

  expect(inputStore.getState().unsentText).toBeUndefined()
})

test('sendComposerText sends reply context and clears transient composer state', async () => {
  const replyOrdinal = T.Chat.numberToOrdinal(801)
  const replyMessageID = T.Chat.numberToMessageID(801)
  getConvoState(convID).dispatch.galleryMessagesLoaded([
    makeTextMessage({
      id: replyMessageID,
      ordinal: replyOrdinal,
      outboxID: T.Chat.stringToOutboxID('reply-target'),
      text: 'reply target',
    }),
  ])
  const getLastPost = mockPostText()
  const inputStore = createConversationInputStoreForTesting(convID)
  inputStore.getState().dispatch.setReplyTo(replyOrdinal)
  inputStore.getState().dispatch.setCommandMarkdown({body: '**markdown**', title: 'Command'})
  inputStore.getState().dispatch.setGiphyWindow(true)
  inputStore.getState().dispatch.injectIntoInput('reply text')

  inputStore.getState().dispatch.sendComposerText('sent reply')
  await flushPromises()

  expect(inputStore.getState().replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(inputStore.getState().commandMarkdown).toBeUndefined()
  expect(inputStore.getState().giphyWindow).toBe(false)
  expect(inputStore.getState().unsentText).toBe('')
  expect(getLastPost()?.params.body).toBe('sent reply')
  expect(getLastPost()?.params.replyTo).toBe(replyMessageID)
})

test('sendComposerText restores text when a stellar flow is canceled', async () => {
  const getLastPost = mockPostText()
  const inputStore = createConversationInputStoreForTesting(convID)

  inputStore.getState().dispatch.sendComposerText('restore me')
  await flushPromises()
  getLastPost()?.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})

  expect(inputStore.getState().unsentText).toBe('restore me')
})

test('sendComposerText edits the selected message and clears edit state', async () => {
  const editOrdinal = T.Chat.numberToOrdinal(901)
  const editMessageID = T.Chat.numberToMessageID(901)
  getConvoState(convID).dispatch.galleryMessagesLoaded([
    makeTextMessage({
      id: editMessageID,
      ordinal: editOrdinal,
      outboxID: T.Chat.stringToOutboxID('edit-target'),
      text: 'old text',
    }),
  ])
  const editPost = jest.spyOn(T.RPCChat, 'localPostEditNonblockRpcPromise').mockResolvedValue({
    outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID('edit-outbox')),
  })
  const inputStore = createConversationInputStoreForTesting(convID)
  inputStore.getState().dispatch.setEditing(editOrdinal)
  inputStore.getState().dispatch.setReplyTo(T.Chat.numberToOrdinal(705))
  inputStore.getState().dispatch.setGiphyWindow(true)
  inputStore.getState().dispatch.setCommandMarkdown({body: 'edit markdown'})

  inputStore.getState().dispatch.sendComposerText('new text')
  await flushPromises()

  expect(inputStore.getState().editing).toBe(T.Chat.numberToOrdinal(0))
  expect(inputStore.getState().replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(inputStore.getState().giphyWindow).toBe(false)
  expect(inputStore.getState().commandMarkdown).toBeUndefined()
  expect(inputStore.getState().unsentText).toBe('')
  expect(getConvoState(convID).messageMap.get(editOrdinal)?.submitState).toBe('editing')
  expect(editPost).toHaveBeenCalledWith(
    expect.objectContaining({
      body: 'new text',
      target: expect.objectContaining({messageID: editMessageID}),
    })
  )
})

test('giphy engine events and send path update the input owner', async () => {
  const replyOrdinal = T.Chat.numberToOrdinal(1001)
  const replyMessageID = T.Chat.numberToMessageID(1001)
  getConvoState(convID).dispatch.galleryMessagesLoaded([
    makeTextMessage({
      id: replyMessageID,
      ordinal: replyOrdinal,
      outboxID: T.Chat.stringToOutboxID('giphy-reply-target'),
    }),
  ])
  const getLastPost = mockPostText()
  const trackGiphy = jest.spyOn(T.RPCChat, 'localTrackGiphySelectRpcPromise').mockResolvedValue(undefined)
  const inputStore = createConversationInputStoreForTesting(convID)
  const result = makeGiphyResult()

  inputStore.getState().dispatch.injectIntoInput('/giphy cats')
  onConversationInputEngineAction({
    payload: {params: {clearInput: true, convID, show: true}},
    type: 'chat.1.chatUi.chatGiphyToggleResultWindow',
  } as never)
  onConversationInputEngineAction({
    payload: {params: {convID, results: {galleryUrl: 'https://giphy.com/search/cats', results: [result]}}},
    type: 'chat.1.chatUi.chatGiphySearchResults',
  } as never)
  inputStore.getState().dispatch.setReplyTo(replyOrdinal)

  expect(inputStore.getState().giphyWindow).toBe(true)
  expect(inputStore.getState().unsentText).toBe('')
  expect(inputStore.getState().giphyResult?.results).toEqual([result])

  inputStore.getState().dispatch.sendGiphyResult(result)
  await flushPromises()

  expect(trackGiphy).toHaveBeenCalledWith({result})
  expect(getLastPost()?.params.body).toBe(result.targetUrl)
  expect(getLastPost()?.params.replyTo).toBe(replyMessageID)
  expect(inputStore.getState().replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(inputStore.getState().giphyWindow).toBe(false)
  expect(inputStore.getState().unsentText).toBe('')
})

test('toggleGiphyPrefill toggles the slash command text', () => {
  const inputStore = createConversationInputStoreForTesting(convID)

  inputStore.getState().dispatch.toggleGiphyPrefill()
  expect(inputStore.getState().unsentText).toBe('/giphy ')

  inputStore.getState().dispatch.setGiphyWindow(true)
  inputStore.getState().dispatch.toggleGiphyPrefill()
  expect(inputStore.getState().unsentText).toBe('')
})

test('command status and markdown engine events are conversation scoped', () => {
  const inputStore = createConversationInputStoreForTesting(convID)
  const otherInputStore = createConversationInputStoreForTesting(otherConvID)
  const commandStatus = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'location disabled',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }
  const commandMarkdown = {body: '*formatted* command output', title: 'Command output'}

  onConversationInputEngineAction({
    payload: {
      params: {
        actions: commandStatus.actions,
        convID,
        displayText: commandStatus.displayText,
        typ: commandStatus.displayType,
      },
    },
    type: 'chat.1.chatUi.chatCommandStatus',
  } as never)
  onConversationInputEngineAction({
    payload: {params: {convID, md: commandMarkdown}},
    type: 'chat.1.chatUi.chatCommandMarkdown',
  } as never)

  expect(inputStore.getState().commandStatus).toEqual(commandStatus)
  expect(inputStore.getState().commandMarkdown).toEqual(commandMarkdown)
  expect(otherInputStore.getState().commandStatus).toBeUndefined()
  expect(otherInputStore.getState().commandMarkdown).toBeUndefined()

  onConversationInputEngineAction({
    payload: {params: {convID, md: null}},
    type: 'chat.1.chatUi.chatCommandMarkdown',
  } as never)

  expect(inputStore.getState().commandMarkdown).toBeUndefined()

  onConversationInputEngineAction({
    payload: {
      params: {
        actions: null,
        convID,
        displayText: 'no actions',
        typ: T.RPCChat.UICommandStatusDisplayTyp.status,
      },
    },
    type: 'chat.1.chatUi.chatCommandStatus',
  } as never)

  expect(inputStore.getState().commandStatus).toEqual({
    actions: [],
    displayText: 'no actions',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.status,
  })
})
