/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as UnfurlPreview from './unfurl-preview-state'
import HiddenString from '@/util/hidden-string'
import type * as React from 'react'
import logger from '@/logger'
import {act, cleanup, renderHook} from '@testing-library/react'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {holdHandlerTimers, paramsOf} from '@/test/fake-thread-load'
import {flush, settle} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {sendTextToConversation, useConversationSendActions} from './send-actions'
import {ConversationThreadProvider, useConversationThreadActions, useConversationThreadStore} from './thread-context'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const tlfName = 'testuser,testuser2'
const chatGui = T.RPCGen.TLFIdentifyBehavior.chatGui
const postTextMethod = 'chat.1.local.postTextNonblock'
const postEditMethod = 'chat.1.local.postEditNonblock'
const postAttachmentMethod = 'chat.1.local.postFileAttachmentLocalNonblock'
const audioPreviewMethod = 'chat.1.local.makeAudioPreview'
const giphyMethod = 'chat.1.local.trackGiphySelect'
const serviceError = (desc: string) => () => fakeError(T.RPCGen.StatusCode.scgeneric, desc)

let fake: FakeEngine

// The service posts the text. A payment in it makes the service ask the GUI to confirm, which chat
// always declines, and then report the payment done before it answers. `answers` is when the
// service's answer leaves once the GUI acked that report: 'after the handler' waits a timer turn,
// by when the listener has handed the report to its handler; 'at once' holds that timer so the
// answer lands first, as it can when the reply beats the listener's 0ms deferral.
const mockPostText = (opts?: {stellarCanceled: boolean; answers?: 'after the handler' | 'at once'}) => {
  fake.answer(postTextMethod, async (params: {sessionID: number}) => {
    if (opts) {
      const {sessionID} = params
      await fake.push('chat.1.chatUi.chatStellarShowConfirm', {}, {sessionID})
      await fake.push('chat.1.chatUi.chatStellarDataConfirm', {summary: {}}, {sessionID})
      const timers = opts.answers === 'at once' ? holdHandlerTimers() : undefined
      await fake.push('chat.1.chatUi.chatStellarDone', {canceled: opts.stellarCanceled}, {sessionID})
      if (timers) {
        return timers.replyFirst({})
      }
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    return {}
  })
  return () => paramsOf(fake, postTextMethod)
}
// The payment prompts each cross the wire and wait on a handler timer; let them all land
const untilStellarDone = async () => {
  for (let i = 0; i < 6; i++) {
    await act(settle)
  }
}

// What the service decodes for a postText
const postedText = (over: object) => ({
  body: '',
  clientPrev: 0,
  conversationID: convID,
  identifyBehavior: chatGui,
  outboxID: null,
  replyTo: null,
  tlfName,
  tlfPublic: false,
  unfurlSuppress: [],
  ...over,
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

let Nav: ReturnType<typeof navigationWrapper>['wrapper']
const wrapper = ({children}: {children: React.ReactNode}) => (
  <Nav>
    <ConversationThreadProvider id={conversationIDKey}>{children}</ConversationThreadProvider>
  </Nav>
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
  Nav = navigationWrapper({params: {conversationIDKey}, route: 'chatRoot'}).wrapper
  useConfigState.setState({loggedIn: true})
  // the thread provider builds a thread only for a signed-in account
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  fake = installFakeEngine()
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
    await flush()

    // never exploding, so no lifetime at all
    expect(post()).toEqual([postedText({body: 'hello'})])
  })

  test('a failed post is swallowed', async () => {
    fake.answer(postTextMethod, serviceError('offline'))
    const error = jest.spyOn(logger, 'error')
    sendTextToConversation(conversationIDKey, tlfName, 'hello')
    await flush()
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
    await flush()

    expect(post()[0]).toEqual(postedText({body: 'hi', clientPrev: 11, ephemeralLifetime: 300, replyTo: 10}))
  })

  test('an empty thread posts with a zero clientPrev and no reply', async () => {
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('first')
    })
    await flush()
    const params = post()[0]
    expect(params).toEqual(postedText({body: 'first'}))
  })

  test('with no meta the tlfName is empty', async () => {
    useInboxMetadataState.setState({metas: new Map()})
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('first')
    })
    await flush()
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
    await flush()
    expect(post()[0]?.unfurlSuppress).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
    expect(remove).toHaveBeenCalledWith(conversationIDKey, ['https://a.com', 'https://b.com'])
    expect(restore).not.toHaveBeenCalled()
  })

  const sendCanceledPayment = (
    onRestoreText?: (text: string) => void,
    answers: 'after the handler' | 'at once' = 'after the handler'
  ) => {
    mockPostText({answers, stellarCanceled: true})
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('+1xlm@testuser2', {
        onRestoreText,
        unfurlSuppress: {dismissed: ['https://a.com'], failed: []},
      })
    })
  }

  test('a canceled stellar send restores the text and the dismissals', async () => {
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    const onRestoreText = jest.fn()
    sendCanceledPayment(onRestoreText)
    await untilStellarDone()
    expect(restore).toHaveBeenCalledWith(conversationIDKey, ['https://a.com'])
    expect(onRestoreText).toHaveBeenCalledWith('+1xlm@testuser2')
  })

  test('a canceled stellar send is not a send', async () => {
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    sendCanceledPayment(jest.fn())
    await untilStellarDone()
    expect(remove).not.toHaveBeenCalled()
  })

  // sendText reads stellarCanceled as soon as postText resolves. The session acks chatStellarDone at
  // once and the listener runs its handler on a timer, so the service's answer can arrive first;
  // postText still resolves only after that handler has run.
  test('a canceled stellar send the service answers at once is not a send', async () => {
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    sendCanceledPayment(jest.fn(), 'at once')
    await untilStellarDone()
    expect(paramsOf(fake, postTextMethod)).toHaveLength(1)
    expect(remove).not.toHaveBeenCalled()
  })

  test('a completed stellar send is a send', async () => {
    mockPostText({answers: 'after the handler', stellarCanceled: false})
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const onRestoreText = jest.fn()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('+1xlm@testuser2', {onRestoreText})
    })
    await untilStellarDone()
    expect(onRestoreText).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(conversationIDKey, [])
  })

  test('a canceled stellar send with no restore callback restores nothing', async () => {
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    sendCanceledPayment()
    await untilStellarDone()
    expect(restore).not.toHaveBeenCalled()
  })

  test('a failed post neither restores nor drops the dismissals', async () => {
    fake.answer(postTextMethod, serviceError('offline'))
    const remove = jest.spyOn(UnfurlPreview, 'removeDismissals')
    const restore = jest.spyOn(UnfurlPreview, 'restoreDismissals')
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('hi', {unfurlSuppress: {dismissed: ['https://a.com'], failed: []}})
    })
    await flush()
    expect(remove).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
  })
})

describe('editing', () => {
  const edits = () => paramsOf(fake, postEditMethod)
  beforeEach(() => {
    fake.answer(postEditMethod, () => ({}))
  })

  test('an edit posts against the target and marks it editing', async () => {
    const post = mockPostText()
    const target = textAt(10, {outboxID: T.Chat.stringToOutboxID('0a0b')})
    const result = renderSendActions([target, textAt(11)])

    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: target.ordinal, unfurlSuppress: {dismissed: ['https://a.com'], failed: []}})
    })
    await flush()

    expect(post()).toEqual([])
    expect(result.current.store.getState().messageMap.get(target.ordinal)?.submitState).toBe('editing')
    expect(edits()).toEqual([
      {
        body: 'changed',
        clientPrev: 11,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: expect.any(Uint8Array),
        target: {messageID: 10, outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID('0a0b'))},
        tlfName,
        tlfPublic: false,
      },
    ])
  })

  test('a target with no outbox id sends none', async () => {
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await flush()
    expect(edits()[0]).toEqual(
      // a message that never had an outbox entry carries the empty id, which goes out as none
      expect.objectContaining({target: {messageID: 10, outboxID: null}})
    )
  })

  test('an unchanged text is not an edit', async () => {
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('message 10', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await flush()
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
    await flush()
    expect(edits()).toEqual([])

    act(() => {
      result.current.send.sendMessage('new title', {editingOrdinal: attachment.ordinal})
    })
    await flush()
    expect(edits()).toEqual([expect.objectContaining({body: 'new title'})])
  })

  test('a missing target is ignored', async () => {
    const result = renderSendActions()
    act(() => {
      result.current.send.sendMessage('x', {editingOrdinal: T.Chat.numberToOrdinal(99)})
    })
    await flush()
    expect(edits()).toEqual([])
  })

  test('an edit the service refuses puts the row back as it was and warns', async () => {
    fake.answer(postEditMethod, serviceError('refused'))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions([textAt(10, {submitState: 'failed'})])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await flush()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused'))
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBe('failed')
  })

  // Every failure the engine reports is a service error, a lost link included
  test('an edit on a lost service link puts the row back and warns', async () => {
    fake.drop()
    await flush()
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    await flush()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('editMessage: failed to edit: '))
    expect(error).not.toHaveBeenCalled()
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBeUndefined()
  })

  test('a failed edit leaves a row that moved on since in its new state', async () => {
    const held = fake.hold(postEditMethod)
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendMessage('changed', {editingOrdinal: T.Chat.numberToOrdinal(10)})
    })
    act(() => {
      result.current.actions.setMessageSubmitState(T.Chat.numberToOrdinal(10), 'failed')
    })
    await flush()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'refused'))
    await flush()
    expect(result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBe('failed')
  })
})

describe('sendGiphyResult', () => {
  const giphy = {targetUrl: 'https://giphy.com/x.gif'} as T.RPCChat.GiphySearchResult

  test('tracks the pick then sends its url as text', async () => {
    fake.answer(giphyMethod, () => undefined)
    const post = mockPostText()
    const result = renderSendActions([textAt(10)])
    act(() => {
      result.current.send.sendGiphyResult(giphy, T.Chat.numberToOrdinal(10))
    })
    await flush()
    expect(paramsOf(fake, giphyMethod)).toEqual([{result: giphy}])
    // no snapshot: the adapter sends an empty suppress list
    expect(post()).toEqual([postedText({body: 'https://giphy.com/x.gif', clientPrev: 10, replyTo: 10})])
  })

  test('a failed track still sends', async () => {
    fake.answer(giphyMethod, serviceError('x'))
    const post = mockPostText()
    const result = renderSendActions()
    act(() => {
      result.current.send.sendGiphyResult(giphy)
    })
    await flush()
    expect(post()).toHaveLength(1)
    expect(post()[0]?.replyTo).toBeNull()
  })
})

describe('sendAudioRecording', () => {
  const preview = {filename: 'preview.png', mimeType: 'image/png', previewMimeType: 'image/png'}
  beforeEach(() => {
    fake.answer(postAttachmentMethod, () => ({}))
  })

  test('builds a preview from the amps and posts the file with it', async () => {
    fake.answer(audioPreviewMethod, () => preview)
    const result = renderSendActions([textAt(10)])
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1234, [0.1, 0.2])
    })
    expect(paramsOf(fake, audioPreviewMethod)).toEqual([{amps: [0.1, 0.2], duration: 1234}])
    expect(paramsOf(fake, postAttachmentMethod)).toEqual([
      {
        arg: {
          callerPreview: preview,
          conversationID: convID,
          filename: '/tmp/audio.m4a',
          identifyBehavior: chatGui,
          metadata: new Uint8Array(),
          outboxID: expect.any(Uint8Array),
          title: '',
          tlfName,
          visibility: T.RPCGen.TLFVisibility.private,
        },
        clientPrev: 10,
      },
    ])
  })

  test('an exploding conversation carries the lifetime', async () => {
    fake.answer(audioPreviewMethod, () => preview)
    const result = renderSendActions()
    act(() => {
      result.current.actions.setExplodingMode(60, true)
    })
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])
    })
    expect(paramsOf(fake, postAttachmentMethod)[0]?.arg.ephemeralLifetime).toBe(60)
  })

  test('without a tlfName nothing is sent', async () => {
    useInboxMetadataState.setState({metas: new Map()})
    const result = renderSendActions()
    await act(async () => {
      await result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])
    })
    expect(fake.calls).toEqual([])
  })

  test('a failed post is swallowed', async () => {
    fake.answer(audioPreviewMethod, () => preview)
    fake.answer(postAttachmentMethod, serviceError('too big'))
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
  })

  // the recorder resets once the send resolves, so a failure must not reject
  test('a failed preview is logged, resolves like a failed post, and posts nothing', async () => {
    fake.answer(audioPreviewMethod, serviceError('no preview'))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no preview'))
    expect(paramsOf(fake, postAttachmentMethod)).toEqual([])
  })

  // Every failure the engine reports is a service error, a lost link included, so the error-level
  // branch is for a bug in the app's own code and the service cannot reach it
  test('a send on a lost service link is logged as a failed send and resolves', async () => {
    fake.drop()
    await flush()
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const result = renderSendActions()
    await act(async () => {
      await expect(result.current.send.sendAudioRecording('/tmp/audio.m4a', 1, [])).resolves.toBeUndefined()
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sendAudioRecording: failed to send attachment: '))
    expect(error).not.toHaveBeenCalled()
    expect(paramsOf(fake, postAttachmentMethod)).toEqual([])
  })
})
