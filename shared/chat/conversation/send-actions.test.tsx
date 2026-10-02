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
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {sendTextToConversation, useConversationSendActions} from './send-actions'
import type {PostTextParams} from './chat-rpc'
import {ConversationThreadProvider, useConversationThreadActions, useConversationThreadStore} from './thread-context'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const tlfName = 'testuser,testuser2'

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

let rpc: FakeChatRpc

// Resolves like the service does; `during` runs while the rpc is in flight, the way the
// service calls back into the ui before answering.
const mockPostText = (during?: (p: PostTextParams) => void) => {
  rpc.on('postText', async p => {
    during?.(p)
    await Promise.resolve()
  })
  return () => rpc.params('postText')
}

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
  // the thread provider builds a thread only for a signed-in account
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  rpc = installFakeChatRpc()
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, tlfname: tlfName}], undefined, {
    force: true,
  })
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('sendTextToConversation', () => {
  test('posts plain text with no thread context', async () => {
    const post = mockPostText()
    sendTextToConversation(conversationIDKey, tlfName, 'hello')
    await flushPromises()

    expect(post()).toEqual([
      {
        clientPrev: T.Chat.numberToMessageID(0),
        conversationIDKey,
        ephemeralLifetime: 0,
        onStellarCanceled: expect.any(Function),
        text: 'hello',
        tlfName,
      },
    ])
  })

  test('a failed post is swallowed', async () => {
    rpc.fail('postText', new Error('offline'))
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

    expect(post()[0]).toEqual({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      ephemeralLifetime: 300,
      onStellarCanceled: expect.any(Function),
      replyTo: T.Chat.numberToMessageID(10),
      text: 'hi',
      tlfName,
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
    const params = post()[0]
    expect(params?.clientPrev).toBe(T.Chat.numberToMessageID(0))
    expect(params?.replyTo).toBeUndefined()
    expect(params?.ephemeralLifetime).toBe(0)
  })

  test('with no meta the tlfName is empty', async () => {
    useInboxMetadataState.setState({metas: new Map()})
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('first')
    })
    await act(async () => {
      await flushPromises()
    })
    expect(post()[0]?.tlfName).toBe('')
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
    expect(post()[0]?.unfurlSuppress).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
    expect(remove).toHaveBeenCalledWith(conversationIDKey, ['https://a.com', 'https://b.com'])
    expect(restore).not.toHaveBeenCalled()
  })

  test('a canceled stellar send restores the text and the dismissals and is not a send', async () => {
    mockPostText(p => {
      p.onStellarCanceled?.()
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
    // a completed payment reports nothing back
    mockPostText()
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
      p.onStellarCanceled?.()
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
    rpc.fail('postText', new Error('offline'))
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
  const edits = () => rpc.params('postEdit')

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

    expect(post()).toEqual([])
    expect(result.current.store.getState().messageMap.get(target.ordinal)?.submitState).toBe('editing')
    expect(edits()).toEqual([
      {
        clientPrev: T.Chat.numberToMessageID(11),
        conversationIDKey,
        messageID: T.Chat.numberToMessageID(10),
        messageOutboxID: T.Chat.stringToOutboxID('0a0b'),
        text: 'changed',
        tlfName,
      },
    ])
  })

  test('a target with no outbox id sends none', async () => {
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(edits()[0]).toEqual(
      // a message that never had an outbox entry carries the empty id, which goes out as none
      expect.objectContaining({messageID: T.Chat.numberToMessageID(10), messageOutboxID: ''})
    )
  })

  test('an unchanged text is not an edit', async () => {
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('message 10', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(edits()).toEqual([])
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
    expect(edits()).toEqual([])

    act(() => {
      result.current.send.sendMessage('new title', {editingOrdinal: attachment.ordinal})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(edits()).toEqual([expect.objectContaining({text: 'new title'})])
  })

  test('a missing target is ignored', async () => {
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('x', {editingOrdinal: T.Chat.numberToOrdinal(99)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(edits()).toEqual([])
  })

  test('an edit the service refuses puts the row back as it was and warns', async () => {
    rpc.fail('postEdit', new RPCError('refused', T.RPCGen.StatusCode.scgeneric))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions([textAt(10, {submitState: 'failed'})])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused'))
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBe('failed')
  })

  test('an edit that fails for another reason puts the row back and reaches ignorePromise', async () => {
    rpc.fail('postEdit', new Error('offline'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBeUndefined()
  })

  test('a failed edit leaves a row that moved on since in its new state', async () => {
    let fail: (e: Error) => void = () => {}
    rpc.on('postEdit', async () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject
      })
    )
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    act(() => {
      result.current.actions.setMessageSubmitState(T.Chat.numberToOrdinal(10), 'failed')
    })
    await act(async () => {
      fail(new RPCError('refused', T.RPCGen.StatusCode.scgeneric))
      await flushPromises()
    })
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBe('failed')
  })
})

describe('sendGiphyResult', () => {
  const giphy = {targetUrl: 'https://giphy.com/x.gif'} as T.RPCChat.GiphySearchResult

  test('tracks the pick then sends its url as text', async () => {
    const post = mockPostText()
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendGiphyResult(giphy, T.Chat.numberToOrdinal(10))
    })
    await act(async () => {
      await flushPromises()
    })
    expect(rpc.calls('trackGiphySelect')).toEqual([[giphy]])
    expect(post()[0]).toEqual(
      expect.objectContaining({
        clientPrev: T.Chat.numberToMessageID(10),
        replyTo: T.Chat.numberToMessageID(10),
        text: 'https://giphy.com/x.gif',
        tlfName,
      })
    )
    // no snapshot: the adapter sends an empty suppress list
    expect(post()[0]?.unfurlSuppress).toBeUndefined()
  })

  test('a failed track still sends', async () => {
    rpc.fail('trackGiphySelect', new Error('x'))
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendGiphyResult(giphy)
    })
    await act(async () => {
      await flushPromises()
    })
    expect(post()).toHaveLength(1)
    expect(post()[0]?.replyTo).toBeUndefined()
  })
})

describe('sendAudioRecording', () => {
  const preview = {filename: 'preview.png'} as unknown as T.RPCChat.MakePreviewRes

  test('builds a preview from the amps and posts the file with it', async () => {
    rpc.on('makeAudioPreview', () => preview)
    const result = renderSendActions([textAt(10)])
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1234, [0.1, 0.2])
    })
    expect(rpc.calls('makeAudioPreview')).toEqual([[[0.1, 0.2], 1234]])
    expect(rpc.params('postAttachment')).toEqual([
      {
        callerPreview: preview,
        clientPrev: T.Chat.numberToMessageID(10),
        conversationIDKey,
        ephemeralLifetime: 0,
        filename: '/tmp/audio.m4a',
        outboxID: expect.any(Uint8Array),
        title: '',
        tlfName,
      },
    ])
  })

  test('an exploding conversation carries the lifetime', async () => {
    rpc.on('makeAudioPreview', () => preview)
    const result = renderSendActions()
    act(() => {
      result.current.actions.setExplodingMode(60, true)
    })
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])
    })
    expect(rpc.params('postAttachment')[0]?.ephemeralLifetime).toBe(60)
  })

  test('without a tlfName nothing is sent', async () => {
    useInboxMetadataState.setState({metas: new Map()})
    const result = renderSendActions()
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])
    })
    expect(rpc.calls('makeAudioPreview')).toEqual([])
  })

  test('a failed post is swallowed', async () => {
    rpc.on('makeAudioPreview', () => preview)
    rpc.fail('postAttachment', new RPCError('too big', T.RPCGen.StatusCode.scgeneric))
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
  })

  // the recorder resets once the send resolves, so a failure must not reject
  test('a failed preview is logged, resolves like a failed post, and posts nothing', async () => {
    rpc.fail('makeAudioPreview', new RPCError('no preview', T.RPCGen.StatusCode.scgeneric))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no preview'))
    expect(rpc.calls('postAttachment')).toEqual([])
  })

  test('a send that fails for a reason other than the service is logged as an error and resolves', async () => {
    rpc.fail('makeAudioPreview', new Error('broken'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
    expect(error).toHaveBeenCalledWith(expect.stringContaining('sendAudioRecording'), expect.any(Error))
    expect(rpc.calls('postAttachment')).toEqual([])
  })
})
