/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as UnfurlPreview from './unfurl-preview-state'
import HiddenString from '@/util/hidden-string'
import RPCError from '@/util/rpcerror'
import type * as React from 'react'
import logger from '@/logger'
import {act, cleanup, renderHook} from '@testing-library/react'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {sendTextToConversation, useConversationSendActions} from './send-actions'
import {ConversationThreadProvider, useConversationThreadActions, useConversationThreadStore} from './thread-context'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const tlfName = 'testuser,testuser2'

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

type PostTextArg = Parameters<typeof T.RPCChat.localPostTextNonblockRpcListener>[0]

// Resolves like the service does; `during` runs while the rpc is in flight, the way the
// service calls back into the ui before answering.
const mockPostText = (during?: (p: PostTextArg) => void) =>
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    during?.(p)
    await Promise.resolve()
    return {} as never
  })

const textAt = (n: number, over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser',
    conversationIDKey,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={conversationIDKey}>{children}</ConversationThreadProvider>
)

const renderSendActions = (messages: ReadonlyArray<T.Chat.Message> = []) => {
  const rendered = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      send: useConversationSendActions(),
      store: useConversationThreadStore(),
    }),
    {wrapper}
  )
  if (messages.length) {
    act(() => {
      rendered.result.current.actions.addMessages(messages)
    })
  }
  return rendered.result
}

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, tlfname: tlfName}], undefined, {
    force: true,
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('sendTextToConversation', () => {
  test('posts plain text with no thread context', async () => {
    const post = mockPostText()
    sendTextToConversation(conversationIDKey, tlfName, 'hello')
    await flushPromises()

    expect(post).toHaveBeenCalledTimes(1)
    const arg = post.mock.calls[0]![0]
    expect(arg.params).toEqual({
      body: 'hello',
      clientPrev: T.Chat.numberToMessageID(0),
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: undefined,
      replyTo: undefined,
      tlfName,
      tlfPublic: false,
      unfurlSuppress: [],
    })
    expect(arg.waitingKey).toBeUndefined()
  })

  test('declines every stellar confirmation from chat', async () => {
    const confirm = jest.fn()
    const dataError = jest.fn()
    mockPostText(p => {
      p.customResponseIncomingCallMap?.['chat.1.chatUi.chatStellarDataConfirm']?.(
        {} as never,
        {error: jest.fn(), result: confirm} as never
      )
      p.customResponseIncomingCallMap?.['chat.1.chatUi.chatStellarDataError']?.(
        {} as never,
        {error: jest.fn(), result: dataError} as never
      )
      p.incomingCallMap['chat.1.chatUi.chatStellarShowConfirm']?.({} as never)
    })
    sendTextToConversation(conversationIDKey, tlfName, 'hello')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(false)
    expect(dataError).toHaveBeenCalledWith(false)
  })

  test('a failed post is swallowed', async () => {
    jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockRejectedValue(new Error('offline'))
    const error = jest.spyOn(logger, 'error')
    sendTextToConversation(conversationIDKey, tlfName, 'hello')
    await flushPromises()
    expect(error).not.toHaveBeenCalled()
  })
})

describe('sendMessage', () => {
  test('posts against the newest sent message, with the reply target and the exploding lifetime', async () => {
    const post = mockPostText()
    const result = renderSendActions([textAt(10), textAt(11), textAt(12, {id: T.Chat.numberToMessageID(0)})])
    act(() => {
      result.current.actions.setExplodingMode(300, true)
    })

    act(() => {
      result.current.send.sendMessage('hi', {replyToOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(post.mock.calls[0]![0].params).toEqual({
      body: 'hi',
      clientPrev: T.Chat.numberToMessageID(11),
      conversationID: convID,
      ephemeralLifetime: 300,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: undefined,
      replyTo: T.Chat.numberToMessageID(10),
      tlfName,
      tlfPublic: false,
      unfurlSuppress: [],
    })
  })

  test('an empty thread posts with a zero clientPrev and no reply', async () => {
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('first')
    })
    await act(async () => {
      await flushPromises()
    })
    const params = post.mock.calls[0]![0].params
    expect(params.clientPrev).toBe(T.Chat.numberToMessageID(0))
    expect(params.replyTo).toBeUndefined()
    expect(params).not.toHaveProperty('ephemeralLifetime')
  })

  test('with no meta the tlfName is empty', async () => {
    resetAllStores()
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('first')
    })
    await act(async () => {
      await flushPromises()
    })
    expect(post.mock.calls[0]![0].params.tlfName).toBe('')
  })

  test('suppresses the snapshotted urls and drops the dismissals once sent', async () => {
    const post = mockPostText()
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('see https://a.com', {
        unfurlSuppress: {dismissed: ['https://a.com', 'https://b.com'], failed: ['https://a.com', 'https://c.com']},
      })
    })
    await act(async () => {
      await flushPromises()
    })
    expect(post.mock.calls[0]![0].params.unfurlSuppress).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
    expect(remove).toHaveBeenCalledWith(conversationIDKey, ['https://a.com', 'https://b.com'])
    expect(restore).not.toHaveBeenCalled()
  })

  test('a canceled stellar send restores the text and the dismissals and is not a send', async () => {
    mockPostText(p => {
      p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true} as never)
    })
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    const onRestoreText = jest.fn()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('+1xlm@testuser2', {
        onRestoreText,
        unfurlSuppress: {dismissed: ['https://a.com'], failed: []},
      })
    })
    await act(async () => {
      await flushPromises()
    })
    expect(restore).toHaveBeenCalledWith(conversationIDKey, ['https://a.com'])
    expect(onRestoreText).toHaveBeenCalledWith('+1xlm@testuser2')
    expect(remove).not.toHaveBeenCalled()
  })

  test('a completed stellar send is a send', async () => {
    mockPostText(p => {
      p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: false} as never)
    })
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const onRestoreText = jest.fn()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('+1xlm@testuser2', {onRestoreText})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(onRestoreText).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(conversationIDKey, [])
  })

  test('a canceled stellar send with no restore callback restores nothing', async () => {
    mockPostText(p => {
      p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true} as never)
    })
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('+1xlm@testuser2', {unfurlSuppress: {dismissed: ['https://a.com'], failed: []}})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(restore).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  test('a failed post neither restores nor drops the dismissals', async () => {
    jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockRejectedValue(new Error('offline'))
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('hi', {unfurlSuppress: {dismissed: ['https://a.com'], failed: []}})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(remove).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
  })
})

describe('editing', () => {
  let postEdit: jest.SpyInstance

  beforeEach(() => {
    postEdit = jest.spyOn(T.RPCChat, 'localPostEditNonblockRpcPromise').mockResolvedValue({} as never)
  })

  test('an edit posts against the target and marks it editing', async () => {
    const post = mockPostText()
    const target = textAt(10, {outboxID: T.Chat.stringToOutboxID('0a0b')})
    const result = renderSendActions([target, textAt(11)])

    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: target.ordinal, unfurlSuppress: {dismissed: ['https://a.com'], failed: []}})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(post).not.toHaveBeenCalled()
    expect(result.current.store.getState().messageMap.get(target.ordinal)?.submitState).toBe('editing')
    expect(postEdit).toHaveBeenCalledWith({
      body: 'changed',
      clientPrev: T.Chat.numberToMessageID(11),
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: expect.any(Uint8Array),
      target: {
        messageID: T.Chat.numberToMessageID(10),
        outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID('0a0b')),
      },
      tlfName,
      tlfPublic: false,
    })
  })

  test('a target with no outbox id sends none', async () => {
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(postEdit.mock.calls[0]?.[0].target).toEqual({messageID: T.Chat.numberToMessageID(10), outboxID: undefined})
  })

  test('an unchanged text is not an edit', async () => {
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('message 10', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(postEdit).not.toHaveBeenCalled()
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBeUndefined()
  })

  test('an attachment edit changes the title, and an unchanged title is not an edit', async () => {
    const attachment = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(20),
      ordinal: T.Chat.numberToOrdinal(20),
      title: 'old title',
    })
    const result = renderSendActions([attachment])
    act(() => {
      result.current.send.sendMessage('old title', {editingOrdinal: attachment.ordinal})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(postEdit).not.toHaveBeenCalled()

    act(() => {
      result.current.send.sendMessage('new title', {editingOrdinal: attachment.ordinal})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(postEdit).toHaveBeenCalledWith(expect.objectContaining({body: 'new title'}))
  })

  test('a missing target is ignored', async () => {
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('x', {editingOrdinal: T.Chat.numberToOrdinal(99)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(postEdit).not.toHaveBeenCalled()
  })

  test('a failed edit is left to ignorePromise and the message stays editing', async () => {
    postEdit.mockRejectedValue(new Error('offline'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBe('editing')
  })
})

describe('sendGiphyResult', () => {
  const giphy = {targetUrl: 'https://giphy.com/x.gif'} as T.RPCChat.GiphySearchResult

  test('tracks the pick then sends its url as text', async () => {
    const track = jest.spyOn(T.RPCChat, 'localTrackGiphySelectRpcPromise').mockResolvedValue({} as never)
    const post = mockPostText()
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendGiphyResult(giphy, T.Chat.numberToOrdinal(10))
    })
    await act(async () => {
      await flushPromises()
    })
    expect(track).toHaveBeenCalledWith({result: giphy})
    expect(post.mock.calls[0]![0].params).toEqual(
      expect.objectContaining({
        body: 'https://giphy.com/x.gif',
        clientPrev: T.Chat.numberToMessageID(10),
        replyTo: T.Chat.numberToMessageID(10),
        tlfName,
        unfurlSuppress: [],
      })
    )
  })

  test('a failed track still sends', async () => {
    jest.spyOn(T.RPCChat, 'localTrackGiphySelectRpcPromise').mockRejectedValue(new Error('x'))
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendGiphyResult(giphy)
    })
    await act(async () => {
      await flushPromises()
    })
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]![0].params.replyTo).toBeUndefined()
  })
})

describe('sendAudioRecording', () => {
  const preview = {filename: 'preview.png'} as unknown as T.RPCChat.MakePreviewRes

  test('builds a preview from the amps and posts the file with it', async () => {
    const makePreview = jest.spyOn(T.RPCChat, 'localMakeAudioPreviewRpcPromise').mockResolvedValue(preview)
    const post = jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockResolvedValue({} as never)
    const result = renderSendActions([textAt(10)])
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1234, [0.1, 0.2])
    })
    expect(makePreview).toHaveBeenCalledWith({amps: [0.1, 0.2], duration: 1234})
    expect(post).toHaveBeenCalledWith({
      arg: {
        callerPreview: preview,
        conversationID: convID,
        filename: '/tmp/audio.m4a',
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        metadata: new Uint8Array(),
        outboxID: expect.any(Uint8Array),
        title: '',
        tlfName,
        visibility: T.RPCGen.TLFVisibility.private,
      },
      clientPrev: T.Chat.numberToMessageID(10),
    })
  })

  test('an exploding conversation carries the lifetime', async () => {
    jest.spyOn(T.RPCChat, 'localMakeAudioPreviewRpcPromise').mockResolvedValue(preview)
    const post = jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockResolvedValue({} as never)
    const result = renderSendActions()
    act(() => {
      result.current.actions.setExplodingMode(60, true)
    })
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])
    })
    expect(post.mock.calls[0]?.[0].arg.ephemeralLifetime).toBe(60)
  })

  test('without a tlfName nothing is sent', async () => {
    resetAllStores()
    const makePreview = jest.spyOn(T.RPCChat, 'localMakeAudioPreviewRpcPromise')
    const result = renderSendActions()
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])
    })
    expect(makePreview).not.toHaveBeenCalled()
  })

  test('a failed post is swallowed', async () => {
    jest.spyOn(T.RPCChat, 'localMakeAudioPreviewRpcPromise').mockResolvedValue(preview)
    jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockRejectedValue(new RPCError('too big', T.RPCGen.StatusCode.scgeneric))
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
  })

  test('a failed preview rejects to the caller and posts nothing', async () => {
    jest.spyOn(T.RPCChat, 'localMakeAudioPreviewRpcPromise').mockRejectedValue(new Error('no preview'))
    const post = jest.spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).rejects.toThrow('no preview')
    })
    expect(post).not.toHaveBeenCalled()
  })
})
