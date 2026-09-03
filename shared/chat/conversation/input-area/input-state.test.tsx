/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import type * as React from 'react'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import {Freeze} from 'react-freeze'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {setInputIntent, useInputIntentState} from '../input-intent-store'
import {setThreadInputCommandStatus, setThreadInputEditing, setThreadInputReplyTo} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import {ConversationInputProvider, useConversationInput, type ConversationInputState} from './input-state'
import {ConversationThreadProvider, useConversationThreadActions} from '../thread-context'

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

function ThreadActionsProbe(p: {onActions: (actions: ReturnType<typeof useConversationThreadActions>) => void}) {
  p.onActions(useConversationThreadActions())
  return null
}

function InputStateProbe(p: {onState: (state: ConversationInputState) => void}) {
  p.onState(useConversationInput(s => s))
  return null
}

test('an intent written before the provider mounts is delivered on mount', () => {
  setInputIntent(convID, {text: 'prefill from store', type: 'injectText'})

  const {result} = renderInput(convID)

  expect(result.current.unsentText).toBe('prefill from store')
})

test('a consumed intent does not replay on remount', () => {
  setInputIntent(convID, {text: 'only once', type: 'injectText'})

  const first = renderInput(convID)
  expect(first.result.current.unsentText).toBe('only once')
  first.unmount()

  const second = renderInput(convID)
  expect(second.result.current.unsentText).toBeUndefined()
})

test('an intent for one conversation is not delivered to a different conversation provider', () => {
  setInputIntent(convID, {text: 'for convID only', type: 'injectText'})

  const {result} = renderInput(otherConvID)

  expect(result.current.unsentText).toBeUndefined()
  expect(useInputIntentState.getState().intents.get(convID)).toEqual({
    text: 'for convID only',
    type: 'injectText',
  })
})

test('two setEditing writes before the input provider mounts: the second one applies', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(211)
  const secondOrdinal = T.Chat.numberToOrdinal(212)
  let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
  let inputState: ConversationInputState | undefined

  const {rerender} = render(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
    </ConversationThreadProvider>
  )

  act(() => {
    // Only the second ordinal has a backing message, so a bug that let the first
    // (overwritten) write through would leave editing at its empty default instead
    // of silently reproducing the same result as a correct second-write application.
    threadActions?.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(212),
          ordinal: secondOrdinal,
          outboxID: T.Chat.stringToOutboxID('edit-second-write'),
          text: 'second write text',
        }),
      ],
      {markAsRead: false}
    )
  })

  setInputIntent(convID, {ordinal: firstOrdinal, type: 'setEditing'})
  setInputIntent(convID, {ordinal: secondOrdinal, type: 'setEditing'})

  rerender(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
      <ConversationInputProvider id={convID}>
        <InputStateProbe onState={state => (inputState = state)} />
      </ConversationInputProvider>
    </ConversationThreadProvider>
  )

  expect(inputState?.editing).toBe(secondOrdinal)
  expect(inputState?.unsentText).toBe('second write text')
})

test('an intent that arrives after mount is delivered without a remount', () => {
  const {result} = renderInput(convID)
  expect(result.current.unsentText).toBeUndefined()

  act(() => {
    setInputIntent(convID, {text: 'arrived after mount', type: 'injectText'})
  })

  expect(result.current.unsentText).toBe('arrived after mount')
})

test('commandStatus reaches a mounted provider but is dropped when none is mounted', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'from store',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }

  setInputIntent(convID, {info: commandStatusInfo, type: 'commandStatus'})

  const {result} = renderInput(convID)
  expect(result.current.commandStatus).toBeUndefined()

  act(() => {
    setInputIntent(convID, {info: commandStatusInfo, type: 'commandStatus'})
  })

  expect(result.current.commandStatus).toEqual(commandStatusInfo)
})

test('setThreadInputEditing reaches the store with no provider mounted, then applies on mount', () => {
  const editOrdinal = T.Chat.numberToOrdinal(801)
  let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
  let inputState: ConversationInputState | undefined

  const {rerender} = render(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
    </ConversationThreadProvider>
  )

  act(() => {
    threadActions?.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(801),
          ordinal: editOrdinal,
          outboxID: T.Chat.stringToOutboxID('router-setEditing'),
          text: 'router edit text',
        }),
      ],
      {markAsRead: false}
    )
  })

  setThreadInputEditing(convID, editOrdinal)

  rerender(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
      <ConversationInputProvider id={convID}>
        <InputStateProbe onState={state => (inputState = state)} />
      </ConversationInputProvider>
    </ConversationThreadProvider>
  )

  expect(inputState?.editing).toBe(editOrdinal)
  expect(inputState?.unsentText).toBe('router edit text')
})

test('setThreadInputReplyTo reaches the store with no provider mounted, then applies on mount', () => {
  const replyOrdinal = T.Chat.numberToOrdinal(802)

  setThreadInputReplyTo(convID, replyOrdinal)

  const {result} = renderInput(convID)

  expect(result.current.replyTo).toBe(replyOrdinal)
})

test('setThreadInputCommandStatus reaches a mounted provider', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'from router, mounted',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }

  const {result} = renderInput(convID)

  act(() => {
    setThreadInputCommandStatus(convID, commandStatusInfo)
  })

  expect(result.current.commandStatus).toEqual(commandStatusInfo)
})

test('setThreadInputCommandStatus is dropped when no provider is mounted', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'from router, unmounted',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }

  setThreadInputCommandStatus(convID, commandStatusInfo)

  const {result} = renderInput(convID)

  expect(result.current.commandStatus).toBeUndefined()
})

// The counterfactual to the test above: mounted-but-frozen is not unmounted. react-native-screens
// freezes every screen that is not on top (DelayedFreeze -> react-freeze: a Suspense boundary
// throwing a thenable that never settles), and the location popup is an opaque modal route, so the
// thread underneath is frozen while it is up. Denying location permission writes a commandStatus
// from that modal, and the composer's error banner has to be there when the modal closes.
test('a commandStatus written while the provider is frozen is applied on thaw', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'permission denied, thread frozen',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }
  let inputState: ConversationInputState | undefined
  const tree = (freeze: boolean) => (
    <ConversationThreadProvider id={convID}>
      <Freeze freeze={freeze}>
        <ConversationInputProvider id={convID}>
          <InputStateProbe onState={state => (inputState = state)} />
        </ConversationInputProvider>
      </Freeze>
    </ConversationThreadProvider>
  )

  const {rerender} = render(tree(false))
  act(() => {
    rerender(tree(true))
  })
  // frozen: the provider renders nothing and its layout effects are torn down
  expect(inputState?.commandStatus).toBeUndefined()

  act(() => {
    setThreadInputCommandStatus(convID, commandStatusInfo)
  })
  act(() => {
    rerender(tree(false))
  })

  expect(inputState?.commandStatus).toEqual(commandStatusInfo)
})
