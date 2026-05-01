/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import type * as React from 'react'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, renderHook} from '@testing-library/react'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {ConversationInputProvider, useConversationInput} from './input-state'
import {ConversationThreadProvider, useConversationThreadActions} from '../thread-context'

let mockRouteParams: Record<string, unknown> = {}
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({params: mockRouteParams}),
}))

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  getInboxRowTrustedState: jest.fn(() => undefined),
  queueInboxRowUpdate: jest.fn(),
  setInboxRowTrustedState: jest.fn(),
  syncInboxRowBadgeState: jest.fn(),
  syncInboxRowsFromLayout: jest.fn(),
  syncInboxRowsFromMetaAndParticipants: jest.fn(),
  syncInboxRowsFromMetas: jest.fn(),
  syncInboxRowsFromParticipantMap: jest.fn(),
  syncInboxRowsFromParticipants: jest.fn(),
  updateInboxRowTyping: jest.fn(),
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

const makeRpcOutboxID = (label: string): T.RPCChat.OutboxID => new TextEncoder().encode(label)
const makeOutboxID = (label: string): T.Chat.OutboxID => T.Chat.rpcOutboxIDToOutboxID(makeRpcOutboxID(label))

const mockPostText = () => {
  let lastPost: Parameters<typeof T.RPCChat.localPostTextNonblockRpcListener>[0] | undefined
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    lastPost = p
    await Promise.resolve()
    return {outboxID: makeRpcOutboxID('posted-outbox')}
  })
  return () => lastPost
}

const wrapperFor = (id: T.Chat.ConversationIDKey) =>
  function Wrapper(p: React.PropsWithChildren) {
    return (
      <ConversationThreadProvider id={id}>
        <ConversationInputProvider id={id}>{p.children}</ConversationInputProvider>
      </ConversationThreadProvider>
    )
  }

const renderInput = (id = convID) =>
  renderHook(() => useConversationInput(s => s), {
    wrapper: wrapperFor(id),
  })

const renderInputWithThreadActions = (id = convID) =>
  renderHook(
    () => ({
      input: useConversationInput(s => s),
      threadActions: useConversationThreadActions(),
    }),
    {wrapper: wrapperFor(id)}
  )

const notifyInputEngineAction = (action: Parameters<typeof notifyEngineActionListeners>[0]) => {
  act(() => {
    notifyEngineActionListeners(action)
  })
}

beforeEach(() => {
  mockRouteParams = {}
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('route input action injects prefill text into the mounted provider', () => {
  mockRouteParams = {inputAction: {key: 'prefill-1', text: 'prefill from route', type: 'injectText'}}

  const {result} = renderInput()

  expect(result.current.unsentText).toBe('prefill from route')
})

test('setEditing last picks the latest editable local message and injects its content', () => {
  const attachmentOrdinal = T.Chat.numberToOrdinal(703)
  const {result} = renderInputWithThreadActions()

  act(() => {
    result.current.threadActions.addMessages(
      [
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
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    result.current.input.dispatch.setEditing('last')
  })

  expect(result.current.input.editing).toBe(attachmentOrdinal)
  expect(result.current.input.unsentText).toBe('picked attachment title')
})

test('setEditing clear resets editing state and clears unsent text', () => {
  const editOrdinal = T.Chat.numberToOrdinal(704)
  const {result} = renderInputWithThreadActions()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(704),
          ordinal: editOrdinal,
          outboxID: T.Chat.stringToOutboxID('editable-text'),
          text: 'explicit edit text',
        }),
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    result.current.input.dispatch.setEditing(editOrdinal)
    result.current.input.dispatch.setEditing('clear')
  })

  expect(result.current.input.editing).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.unsentText).toBe('')
})

test('setEditing explicit ordinal selects editable text and ignores missing messages', () => {
  const editOrdinal = T.Chat.numberToOrdinal(704)
  const {result} = renderInputWithThreadActions()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(704),
          ordinal: editOrdinal,
          outboxID: T.Chat.stringToOutboxID('editable-text'),
          text: 'explicit edit text',
        }),
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    result.current.input.dispatch.setEditing(editOrdinal)
  })

  expect(result.current.input.editing).toBe(editOrdinal)
  expect(result.current.input.unsentText).toBe('explicit edit text')

  act(() => {
    result.current.input.dispatch.setEditing(T.Chat.numberToOrdinal(999))
  })

  expect(result.current.input.editing).toBe(editOrdinal)
  expect(result.current.input.unsentText).toBe('explicit edit text')
})

test('input injection is scoped to the owning provider', () => {
  const input = renderInput()
  const otherInput = renderInput(otherConvID)

  act(() => {
    input.result.current.dispatch.injectIntoInput('prefill from share')
  })

  expect(input.result.current.unsentText).toBe('prefill from share')
  expect(otherInput.result.current.unsentText).toBeUndefined()

  act(() => {
    input.result.current.dispatch.injectIntoInput('')
  })

  expect(input.result.current.unsentText).toBe('')

  act(() => {
    input.result.current.dispatch.injectIntoInput()
  })

  expect(input.result.current.unsentText).toBeUndefined()
})

test('sendComposerText sends reply context and clears transient composer state', async () => {
  const replyOrdinal = T.Chat.numberToOrdinal(801)
  const replyMessageID = T.Chat.numberToMessageID(801)
  const getLastPost = mockPostText()
  const {result} = renderInputWithThreadActions()
  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: replyMessageID,
          ordinal: replyOrdinal,
          outboxID: T.Chat.stringToOutboxID('reply-target'),
          text: 'reply target',
        }),
      ],
      {markAsRead: false}
    )
  })
  act(() => {
    result.current.input.dispatch.setReplyTo(replyOrdinal)
    result.current.input.dispatch.setCommandMarkdown({body: '**markdown**', title: 'Command'})
    result.current.input.dispatch.setGiphyWindow(true)
    result.current.input.dispatch.injectIntoInput('reply text')
  })

  act(() => {
    result.current.input.dispatch.sendComposerText('sent reply')
  })
  await flushPromises()

  expect(result.current.input.replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.commandMarkdown).toBeUndefined()
  expect(result.current.input.giphyWindow).toBe(false)
  expect(result.current.input.unsentText).toBe('')
  expect(getLastPost()?.params.body).toBe('sent reply')
  expect(getLastPost()?.params.replyTo).toBe(replyMessageID)
})

test('sendComposerText restores text when a stellar flow is canceled', async () => {
  const getLastPost = mockPostText()
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('restore me')
  })
  await flushPromises()
  act(() => {
    getLastPost()?.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})
  })

  expect(result.current.unsentText).toBe('restore me')
})

test('sendComposerText edits the selected message and clears edit state', async () => {
  const editOrdinal = T.Chat.numberToOrdinal(901)
  const editMessageID = T.Chat.numberToMessageID(901)
  const editPost = jest.spyOn(T.RPCChat, 'localPostEditNonblockRpcPromise').mockResolvedValue({
    outboxID: makeRpcOutboxID('edit-outbox'),
  })
  const {result} = renderInputWithThreadActions()
  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: editMessageID,
          ordinal: editOrdinal,
          outboxID: makeOutboxID('edit-target'),
          text: 'old text',
        }),
      ],
      {markAsRead: false}
    )
  })
  act(() => {
    result.current.input.dispatch.setEditing(editOrdinal)
    result.current.input.dispatch.setReplyTo(T.Chat.numberToOrdinal(705))
    result.current.input.dispatch.setGiphyWindow(true)
    result.current.input.dispatch.setCommandMarkdown({body: 'edit markdown'})
  })

  act(() => {
    result.current.input.dispatch.sendComposerText('new text')
  })
  await flushPromises()

  expect(result.current.input.editing).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.giphyWindow).toBe(false)
  expect(result.current.input.commandMarkdown).toBeUndefined()
  expect(result.current.input.unsentText).toBe('')
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
  const getLastPost = mockPostText()
  const trackGiphy = jest.spyOn(T.RPCChat, 'localTrackGiphySelectRpcPromise').mockResolvedValue({})
  const {result} = renderInputWithThreadActions()
  const giphyResult = makeGiphyResult()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: replyMessageID,
          ordinal: replyOrdinal,
          outboxID: T.Chat.stringToOutboxID('giphy-reply-target'),
        }),
      ],
      {markAsRead: false}
    )
    result.current.input.dispatch.injectIntoInput('/giphy cats')
  })
  notifyInputEngineAction({
    payload: {params: {clearInput: true, convID, show: true}},
    type: 'chat.1.chatUi.chatGiphyToggleResultWindow',
  } as never)
  notifyInputEngineAction({
    payload: {params: {convID, results: {galleryUrl: 'https://giphy.com/search/cats', results: [giphyResult]}}},
    type: 'chat.1.chatUi.chatGiphySearchResults',
  } as never)
  act(() => {
    result.current.input.dispatch.setReplyTo(replyOrdinal)
  })

  expect(result.current.input.giphyWindow).toBe(true)
  expect(result.current.input.unsentText).toBe('')
  expect(result.current.input.giphyResult?.results).toEqual([giphyResult])

  act(() => {
    result.current.input.dispatch.sendGiphyResult(giphyResult)
  })
  await flushPromises()

  expect(trackGiphy).toHaveBeenCalledWith({result: giphyResult})
  expect(getLastPost()?.params.body).toBe(giphyResult.targetUrl)
  expect(getLastPost()?.params.replyTo).toBe(replyMessageID)
  expect(result.current.input.replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.giphyWindow).toBe(false)
  expect(result.current.input.unsentText).toBe('')
})

test('toggleGiphyPrefill toggles the slash command text', () => {
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.toggleGiphyPrefill()
  })
  expect(result.current.unsentText).toBe('/giphy ')

  act(() => {
    result.current.dispatch.setGiphyWindow(true)
    result.current.dispatch.toggleGiphyPrefill()
  })
  expect(result.current.unsentText).toBe('')
})

test('command status and markdown engine events are conversation scoped', () => {
  const input = renderInput()
  const otherInput = renderInput(otherConvID)
  const commandStatus = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'location disabled',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }
  const commandMarkdown = {body: '*formatted* command output', title: 'Command output'}

  notifyInputEngineAction({
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
  notifyInputEngineAction({
    payload: {params: {convID, md: commandMarkdown}},
    type: 'chat.1.chatUi.chatCommandMarkdown',
  } as never)

  expect(input.result.current.commandStatus).toEqual(commandStatus)
  expect(input.result.current.commandMarkdown).toEqual(commandMarkdown)
  expect(otherInput.result.current.commandStatus).toBeUndefined()
  expect(otherInput.result.current.commandMarkdown).toBeUndefined()

  notifyInputEngineAction({
    payload: {params: {convID, md: null}},
    type: 'chat.1.chatUi.chatCommandMarkdown',
  } as never)

  expect(input.result.current.commandMarkdown).toBeUndefined()

  notifyInputEngineAction({
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

  expect(input.result.current.commandStatus).toEqual({
    actions: [],
    displayText: 'no actions',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.status,
  })
})
