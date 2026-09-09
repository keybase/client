/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as ThreadRpc from './thread-rpc'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import {metasReceived} from '@/chat/inbox/metadata'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useShellState} from '@/stores/shell'
import {
  ConversationThreadProvider,
  type ConversationThreadActions,
  type ConversationThreadState,
  useConversationThreadActions,
  useConversationThreadMarkThreadAsRead,
  useConversationThreadMessage,
  useConversationThreadSelector,
  useConversationThreadStore,
} from './thread-context'
import {
  ConversationThreadWindowProvider,
  maxBackPageReloads,
  numMessagesOnScrollback,
  runThreadWindowLoad,
  useRequestWindow,
  useThreadLoadStatus,
  useThreadWindow,
} from './thread-window'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const flushPromises = async () => {
  for (let i = 0; i < 200; i++) {
    await Promise.resolve()
  }
}

const textAt = (n: number) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    timestamp: 100,
  })

const makeTextMessage = () =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(301),
    ordinal: T.Chat.numberToOrdinal(301),
    outboxID: T.Chat.stringToOutboxID('outbox-1'),
    text: new HiddenString('stale message'),
    timestamp: 100,
  })

const makeValidTextUIMessage = (
  serverMsgID: T.Chat.MessageID,
  text: string,
  outboxID = ''
): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
    botUsername: '',
    channelMention: T.RPCChat.ChannelMention.none,
    channelNameMentions: null,
    ctime: 200,
    decoratedTextBody: null,
    etime: 0,
    explodedBy: null,
    hasPairwiseMacs: false,
    isCollapsed: false,
    isDeleteable: true,
    isEditable: true,
    isEphemeral: false,
    isEphemeralExpired: false,
    messageBody: {
      messageType: T.RPCChat.MessageType.text,
      text: {
        body: text,
        payments: null,
        replyTo: null,
        replyToUID: null,
        teamMentions: null,
        userMentions: null,
      },
    },
    messageID: T.Chat.messageIDToNumber(serverMsgID),
    outboxID,
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: 'bob-device',
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: 'bob',
    superseded: false,
    unfurls: null,
  },
})

const threadJSON = (msgIDs: ReadonlyArray<T.Chat.MessageID>, last = true) =>
  JSON.stringify({
    messages: msgIDs.map(id => makeValidTextUIMessage(id, `m${id}`)),
    pagination: {last, next: '', num: 100, previous: ''},
  })

type WindowProviderProps = {
  allowMarkReadOnLoad?: boolean
  skipThreadLoadOnSelection?: boolean
}

const makeWrapper = (p: WindowProviderProps = {}) => {
  const {allowMarkReadOnLoad = true, skipThreadLoadOnSelection = true} = p
  return function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <ConversationThreadProvider id={convID}>
        <ConversationThreadWindowProvider
          allowMarkReadOnLoad={allowMarkReadOnLoad}
          id={convID}
          skipThreadLoadOnSelection={skipThreadLoadOnSelection}
        >
          {children}
        </ConversationThreadWindowProvider>
      </ConversationThreadProvider>
    )
  }
}

// The whole public surface of the module, in one hook, so a test reads as "ask for a window, then
// look at the window".
const useHarness = () => ({
  actions: useConversationThreadActions(),
  markThreadAsRead: useConversationThreadMarkThreadAsRead(),
  requestWindow: useRequestWindow(),
  status: useThreadLoadStatus(),
  window: useThreadWindow(),
})

const renderWindow = (p: WindowProviderProps = {}) => renderHook(useHarness, {wrapper: makeWrapper(p)})

beforeEach(() => {
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey: convID, readMsgID: T.Chat.numberToMessageID(0)}],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('requestWindow turns a place in the thread into a load', () => {
  test('a centered anchor drops the window it replaces and pivots the rpc on the message', async () => {
    const loadThread = jest
      .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
      .mockResolvedValue({offline: false})
    const {result} = renderHook(
      () => ({...useHarness(), staleMessage: useConversationThreadMessage(T.Chat.numberToOrdinal(301))}),
      {wrapper: makeWrapper()}
    )

    act(() => {
      result.current.actions.addMessages([makeTextMessage()])
    })
    expect(result.current.staleMessage?.id).toBe(T.Chat.numberToMessageID(301))

    act(() => {
      result.current.requestWindow({
        anchor: {centeredOn: T.Chat.numberToMessageID(999)},
        reason: 'centered',
      })
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.staleMessage).toBeUndefined()
    expect(result.current.window.ordinals).toEqual([])
    expect(loadThread).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({
            messageIDControl: expect.objectContaining({
              mode: T.RPCChat.MessageIDControlMode.centered,
              pivot: T.Chat.numberToMessageID(999),
            }),
          }),
        }),
      })
    )
  })

  test('jump to recent reloads the newest page, reports status and marks the thread read', async () => {
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    const markAsRead = jest
      .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
      .mockResolvedValue({offline: false})
    const msgID = T.Chat.numberToMessageID(202)
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
        status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
      })
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: threadJSON([msgID])})
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'jump to recent'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.status).toBe(T.RPCChat.UIChatThreadStatusTyp.server)
    expect(markAsRead).toHaveBeenCalledWith({
      conversationID: T.Chat.keyToConversationID(convID),
      forceUnread: false,
      msgID,
    })
  })

  test('jump to recent drops the old window instead of merging a disjoint one into it', async () => {
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(9001)]),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    // The reader is deep in old history.
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(101), textAt(102)],
        moreToLoad: true,
        scrollDirection: 'none',
      })
    })

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'jump to recent'})
    })
    await act(async () => {
      await flushPromises()
    })

    // Only the newest window survives. If the old one were merged in, ordinals would read
    // [101, 102, 9001] with an 8899-wide hole.
    expect(result.current.window.ordinals).toEqual([T.Chat.numberToOrdinal(9001)])
  })

  test('an older anchor is refused once the window reaches the oldest message', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
      .mockResolvedValue({offline: false})
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(101)],
        moreToLoad: false,
        scrollDirection: 'back',
      })
    })
    act(() => {
      result.current.requestWindow({anchor: 'older', reason: 'scroll back'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  test('a newer anchor is refused once the window reaches the latest message', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
      .mockResolvedValue({offline: false})
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(101)],
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(result.current.window.moreToLoadForward).toBe(false)
    act(() => {
      result.current.requestWindow({anchor: 'newer', reason: 'scroll forward'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  test('scrollback loads older messages without marking the thread read', async () => {
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(201)], false),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const markAsRead = jest
      .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
      .mockResolvedValue({offline: false})
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [makeTextMessage()],
        moreToLoad: true,
        scrollDirection: 'back',
      })
    })
    act(() => {
      result.current.requestWindow({anchor: 'older', reason: 'scroll back'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(markAsRead).not.toHaveBeenCalled()
  })

  test('a provider that disallows mark read on load does not arm active or explicit mark read', async () => {
    useConfigState.setState({loggedIn: true})
    useShellState.getState().dispatch.setActive(false)
    jest
      .spyOn(Common, 'isUserActivelyLookingAtThisThread')
      .mockImplementation(() => useShellState.getState().active)
    const markAsRead = jest
      .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
      .mockResolvedValue({offline: false})
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(203)]),
      })
      await Promise.resolve()
      return {offline: false}
    })
    // The mount-time selection load is the one allowMarkReadOnLoad governs.
    const {result} = renderWindow({allowMarkReadOnLoad: false, skipThreadLoadOnSelection: false})

    await act(async () => {
      await flushPromises()
    })
    expect(markAsRead).not.toHaveBeenCalled()

    act(() => {
      useShellState.getState().dispatch.setActive(true)
    })
    await act(async () => {
      await flushPromises()
    })
    expect(markAsRead).not.toHaveBeenCalled()

    act(() => {
      result.current.markThreadAsRead()
    })
    await act(async () => {
      await flushPromises()
    })
    expect(markAsRead).not.toHaveBeenCalled()
  })

  test('the mount-time selection load can be skipped for a thread about to be centered', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
      .mockResolvedValue({offline: false})
    renderWindow({skipThreadLoadOnSelection: true})
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).not.toHaveBeenCalled()

    cleanup()
    renderWindow({skipThreadLoadOnSelection: false})
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

// The full jump -> scroll-to-bottom -> stale-reload chain behind normal/container.tsx's
// allowMarkReadOnLoad. Jumping to a highlighted message mounts the thread with
// skipThreadLoadOnSelection (the centered load replaces the select-on-mount load) and blocks
// mark-read. The block is NOT permanent: applyThreadLoad releases it as soon as the user scrolls
// to the latest message ('forward' with no moreToLoad). The stale reload that follows -
// ChatThreadsStale fires on every mobile background -> foreground - must then be free to mark the
// thread read. The stale reload reads allowMarkReadOnLoad through useEffectEvent, i.e. the latest
// render's value, so a caller that derived it from the one-shot highlight and froze it at `false`
// would leave the conversation badged unread for as long as the thread stayed mounted.
const staleThreadUpdate = {
  payload: {
    params: {
      uid: '',
      updates: [
        {convID: T.Chat.keyToConversationID(convID), updateType: T.RPCChat.StaleUpdateType.newactivity},
      ],
    },
  },
  type: 'chat.1.NotifyChat.ChatThreadsStale',
} as never

describe('a stale thread reloads the newest page', () => {
  const renderJumpedThenScrolledToBottom = (allowMarkReadOnLoad: boolean) => {
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    const markAsRead = jest
      .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
      .mockResolvedValue({offline: false})
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(203)]),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow({allowMarkReadOnLoad, skipThreadLoadOnSelection: true})
    // jumping to a highlighted message blocks mark-read
    act(() => {
      result.current.actions.setMarkReadBlocked(true)
    })
    // ...then the user scrolls all the way forward to the latest message, releasing the block
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [makeTextMessage()],
        moreToLoad: false,
        scrollDirection: 'forward',
      })
    })
    return markAsRead
  }

  test('a stale reload after a jump and a scroll to the bottom marks the thread read', async () => {
    const markAsRead = renderJumpedThenScrolledToBottom(true)

    act(() => {
      notifyEngineActionListeners(staleThreadUpdate)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(markAsRead).toHaveBeenCalledTimes(1)
  })

  // The counterfactual: exactly what deriving allowMarkReadOnLoad from the one-shot highlight did.
  test('a stale reload that disallows mark read leaves the thread unread even once the block is gone', async () => {
    const markAsRead = renderJumpedThenScrolledToBottom(false)

    act(() => {
      notifyEngineActionListeners(staleThreadUpdate)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(markAsRead).not.toHaveBeenCalled()
  })

  test('a stale reload reports its thread status through the provider', async () => {
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
        status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    act(() => {
      notifyEngineActionListeners(staleThreadUpdate)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.status).toBe(T.RPCChat.UIChatThreadStatusTyp.server)
  })

  test('a stale thread notification for another conversation is ignored', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
      .mockResolvedValue({offline: false})
    renderWindow()

    act(() => {
      notifyEngineActionListeners({
        payload: {
          params: {
            uid: '',
            updates: [
              {
                convID: T.Chat.keyToConversationID(otherConvID),
                updateType: T.RPCChat.StaleUpdateType.newactivity,
              },
            ],
          },
        },
        type: 'chat.1.NotifyChat.ChatThreadsStale',
      } as never)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  test('an incremental inbox sync carrying this conversation reloads it too', async () => {
    const rpc = jest
      .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
      .mockResolvedValue({offline: false})
    renderWindow()

    act(() => {
      notifyEngineActionListeners({
        payload: {
          params: {
            syncRes: {
              incremental: {
                items: [{conv: {convID: T.Chat.conversationIDKeyToString(convID)}}],
              },
              syncType: T.RPCChat.SyncInboxResType.incremental,
            },
          },
        },
        type: 'chat.1.NotifyChat.ChatInboxSynced',
      } as never)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('a response may only become the window it was fetched against', () => {
  test('a refreshed window does not overwrite reaction updates streamed into it', async () => {
    const targetMsgID = T.Chat.numberToMessageID(301)
    const targetOrdinal = T.Chat.numberToOrdinal(301)
    let incomingCallMap:
      | Parameters<typeof T.RPCChat.localGetThreadNonblockRpcListener>[0]['incomingCallMap']
      | undefined
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      incomingCallMap = p.incomingCallMap
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderHook(
      () => ({...useHarness(), message: useConversationThreadMessage(targetOrdinal)}),
      {wrapper: makeWrapper()}
    )

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: true,
        messages: [makeTextMessage()],
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'tab selected'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(incomingCallMap).toBeDefined()

    act(() => {
      notifyEngineActionListeners({
        payload: {
          params: {
            activity: {
              activityType: T.RPCChat.ChatActivityType.reactionUpdate,
              reactionUpdate: {
                convID: T.Chat.keyToConversationID(convID),
                reactionUpdates: [
                  {
                    reactions: {
                      reactions: {
                        ':+1:': {
                          decorated: ':+1:',
                          users: {
                            alice: {
                              ctime: 300,
                              reactionMsgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(99)),
                            },
                          },
                        },
                      },
                    },
                    targetMsgID: T.Chat.messageIDToNumber(targetMsgID),
                  },
                ],
                userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null},
              },
            },
          },
        },
        type: 'chat.1.NotifyChat.NewChatActivity',
      } as never)
    })

    expect(result.current.message?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['alice'])

    act(() => {
      incomingCallMap?.['chat.1.chatUi.chatThreadFull']?.({
        thread: JSON.stringify({
          messages: [makeValidTextUIMessage(targetMsgID, 'stale server copy')],
          pagination: {last: true, next: '', num: 20, previous: ''},
        }),
      })
    })

    expect(result.current.message?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['alice'])
  })

  test('a stale reload does not merge the newest page into a centered window', async () => {
    // The reader taps a search result and sits on the window around it, with more to load forward.
    // A ChatThreadsStale reload fetches the newest page, which is nowhere near that window: merging
    // the two leaves ordinals with a hole through the middle and then calls the result the latest
    // message, which is the gap this invariant is about.
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(9900), T.Chat.numberToMessageID(9901)], false),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: true,
        enableActiveMarkRead: false,
        messages: [textAt(7000), textAt(7001)],
        moreToLoad: true,
        scrollDirection: 'none',
      })
    })
    expect(result.current.window.moreToLoadForward).toBe(true)

    act(() => {
      notifyEngineActionListeners(staleThreadUpdate)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.window.ordinals).toEqual([7000, 7001])
    // ...and the window still knows it has not reached the latest message.
    expect(result.current.window.moreToLoadForward).toBe(true)
  })

  test('a newest page that reaches the window is still merged', async () => {
    // The other side of the rule. A reader near the bottom gets a page that overlaps what they
    // hold, so there is no hole to open and the refresh must land.
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(9901), T.Chat.numberToMessageID(9902)], false),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: true,
        enableActiveMarkRead: false,
        messages: [textAt(9900), textAt(9901)],
        moreToLoad: true,
        scrollDirection: 'none',
      })
    })

    act(() => {
      notifyEngineActionListeners(staleThreadUpdate)
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.window.ordinals).toEqual([9900, 9901, 9902])
  })

  test('a response arriving after the provider unmounts is not applied', async () => {
    let incomingCallMap:
      | Parameters<typeof T.RPCChat.localGetThreadNonblockRpcListener>[0]['incomingCallMap']
      | undefined
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      incomingCallMap = p.incomingCallMap
      await Promise.resolve()
      return {offline: false}
    })
    let snapshot: (() => ConversationThreadState) | undefined
    const {result, unmount} = renderHook(
      () => {
        const store = useConversationThreadStore()
        snapshot = () => store.getState()
        return useHarness()
      },
      {wrapper: makeWrapper()}
    )

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'focused'})
    })
    await act(async () => {
      await flushPromises()
    })
    expect(incomingCallMap).toBeDefined()

    unmount()

    act(() => {
      incomingCallMap?.['chat.1.chatUi.chatThreadFull']?.({
        thread: threadJSON([T.Chat.numberToMessageID(9001)]),
      })
    })

    expect(snapshot?.().messageOrdinals).toBeUndefined()
  })
})

// The gate rules are the sharpest part of the module and the hardest to reach through a rendered
// list, so they are driven straight at the arbitration entry point - with the real store and the
// real actions behind it, and a real gate record rather than hand-set flags.
describe('the window gate', () => {
  type LoadContext = Omit<Parameters<typeof runThreadWindowLoad>[0], 'load' | 'reload'>
  type WindowLoad = Parameters<typeof runThreadWindowLoad>[0]['load']

  const newestLoad = (over: Partial<WindowLoad> = {}): WindowLoad => ({
    allowMarkAsRead: true,
    numberOfMessagesToLoad: 100,
    reason: 'focused',
    retryCount: 0,
    scrollDirection: 'none',
    ...over,
  })

  const renderContext = () => {
    let mounted = true
    const {result} = renderHook(
      () => ({
        actions: useConversationThreadActions(),
        ordinals: useConversationThreadSelector(s => s.messageOrdinals),
        store: useConversationThreadStore(),
      }),
      {
        wrapper: ({children}: {children: React.ReactNode}) => (
          <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
        ),
      }
    )
    const context: LoadContext = {
      actions: result.current.actions,
      conversationIDKey: convID,
      gate: {nextLoadID: 0, refillOwner: undefined},
      isMounted: () => mounted,
      onThreadLoadStatus: () => {},
      store: result.current.store,
    }
    return {
      context,
      result,
      unmountProvider: () => {
        mounted = false
      },
    }
  }

  const drive = (context: LoadContext, load: WindowLoad) => {
    runThreadWindowLoad({
      ...context,
      load,
      reload: (next: WindowLoad) => {
        drive(context, next)
      },
    })
  }

  test('only the load that claimed the gate may drop it', async () => {
    // The generation cannot separate two loads of the same conversation: it moves once, for the
    // clear both of them started after. The reader taps a search result, messagesClear issues the
    // centered reload, and a ChatThreadsStale notification then fires a second load. If that one
    // settles first - no thread, an error - it would take the gate down while the reload is still
    // in flight, and a push landing in what is left of the gap strands exactly as it did before
    // the gate existed.
    let release: (() => void) | undefined
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(
      async () =>
        new Promise(resolve => {
          release = () => resolve(undefined as never)
        })
    )
    const {context, result} = renderContext()
    act(() => {
      result.current.actions.messagesClear()
    })

    // The reload the clear issued claims the gate...
    drive(context, newestLoad({reason: 'centered'}))
    await act(async () => {
      await flushPromises()
    })
    const owner = release
    release = undefined

    // ...and the stale-thread load behind it loses the race.
    drive(context, newestLoad({reason: 'got stale'}))
    await act(async () => {
      await flushPromises()
    })
    await act(async () => {
      release?.()
      await flushPromises()
    })
    expect(context.store.getState().windowCleared).toBe(true)

    await act(async () => {
      owner?.()
      await flushPromises()
    })
    expect(context.store.getState().windowCleared).toBe(false)
  })

  test('releases the gate when the load bails before the rpc is even made', async () => {
    // The clear issues its reload synchronously, so if that reload is the one bailing there is
    // nothing else coming to take the gate down and the thread stops receiving messages for good.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock')
    const {context, result, unmountProvider} = renderContext()
    act(() => {
      result.current.actions.messagesClear()
    })
    unmountProvider()

    drive(context, newestLoad())
    await act(async () => {
      await flushPromises()
    })

    expect(rpc).not.toHaveBeenCalled()
    expect(context.store.getState().windowCleared).toBe(false)
  })

  test('releases the gate when the load ends without ever applying', async () => {
    // A response that carries no thread: nothing else would take the gate down, and left up it
    // drops every notification for the life of the provider.
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async () => {
      await Promise.resolve()
      return undefined as never
    })
    const {context, result} = renderContext()
    act(() => {
      result.current.actions.messagesClear()
    })

    drive(context, newestLoad())
    await act(async () => {
      await flushPromises()
    })

    expect(context.store.getState().windowCleared).toBe(false)
  })

  test('does not apply a response that arrives after a clear, and leaves the new gate alone', async () => {
    // The back page is in flight when the reader taps jump-to-recent: messagesClear empties the
    // window and starts its own load. Applying this one anyway repopulates the window the clear
    // dropped and lowers the gate the new load is relying on, and the two disjoint pages then
    // merge - the stranded-row bug the gate exists to prevent.
    const {context, result} = renderContext()
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      act(() => {
        result.current.actions.messagesClear()
      })
      p.onFullThread?.(threadJSON([T.Chat.numberToMessageID(7152)], false))
      return undefined as never
    })

    drive(context, newestLoad())
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.ordinals).toBeUndefined()
    expect(context.store.getState().windowCleared).toBe(true)
  })

  test('the load that owns the gate refills the window and drops it', async () => {
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onFullThread?.(threadJSON([T.Chat.numberToMessageID(7152)], false))
      return undefined as never
    })
    const {context, result} = renderContext()
    act(() => {
      result.current.actions.messagesClear()
    })

    drive(context, newestLoad({reason: 'centered'}))
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.ordinals).toEqual([T.Chat.numberToOrdinal(7152)])
    expect(context.store.getState().windowCleared).toBe(false)
  })

  test('an empty pass during a jump-to-recent gap leaves the gate up', async () => {
    // A cold cache sends a cached pass carrying no messages ahead of the full response. Dropping
    // the gate on it reopens the gap: a notification landing before the real page becomes the sole
    // ordinal, and the page that follows is disjoint from it.
    let sendFull: (() => void) | undefined
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onCachedThread?.(JSON.stringify({messages: null, pagination: {last: false, num: 100}}))
      return new Promise(resolve => {
        sendFull = () => {
          p.onFullThread?.(threadJSON([T.Chat.numberToMessageID(9001)], false))
          resolve(undefined as never)
        }
      })
    })
    const {context, result} = renderContext()
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(7152), textAt(7153)],
        moreToLoad: true,
        scrollDirection: 'none',
      })
    })
    act(() => {
      result.current.actions.messagesClear()
    })

    drive(context, newestLoad({reason: 'jump to recent'}))
    await act(async () => {
      await flushPromises()
    })
    expect(context.store.getState().windowCleared).toBe(true)

    // A push landing in the gap cannot install itself as the whole window.
    act(() => {
      result.current.actions.addMessages([textAt(7155)], {liveUpdate: true})
    })
    await act(async () => {
      sendFull?.()
      await flushPromises()
    })

    expect(result.current.ordinals).toEqual([T.Chat.numberToOrdinal(9001)])
  })
})

describe('a back page that adds no ordinals reloads itself', () => {
  type LoadContext = Omit<Parameters<typeof runThreadWindowLoad>[0], 'load' | 'reload'>
  type WindowLoad = Parameters<typeof runThreadWindowLoad>[0]['load']

  // A real store seeded with a window, so a page's productivity is judged the way the thread judges
  // it: a `deleted` message adds no ordinal, a renderable one does.
  const contextFor = (store: LoadContext['store'], actions: ConversationThreadActions) => {
    const context: LoadContext = {
      actions,
      conversationIDKey: convID,
      gate: {nextLoadID: 0, refillOwner: undefined},
      isMounted: () => true,
      onThreadLoadStatus: () => {},
      store,
    }
    return context
  }

  const drive = (context: LoadContext, load: WindowLoad) => {
    runThreadWindowLoad({
      ...context,
      load,
      reload: (next: WindowLoad) => {
        drive(context, next)
      },
    })
  }

  // Hidden placeholders are what a DELETE-superseded message arrives as, and what becomes `deleted`
  // on this side. They carry real message IDs, which is what bounds the reload.
  const tombstones = (from: number, to: number) =>
    Array.from({length: from - to + 1}, (_, i) => ({
      placeholder: {hidden: true, messageID: T.Chat.numberToMessageID(from - i)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    }))

  // hidden: false parses to a `placeholder`, which the thread does render and keep an ordinal for.
  const visible = (from: number, to: number) =>
    Array.from({length: from - to + 1}, (_, i) => ({
      placeholder: {hidden: false, messageID: T.Chat.numberToMessageID(from - i)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    }))

  // Each call walks one page further back, exactly as the service does, until it runs out.
  const mockWalkingBack = (oldestOverall: number) => {
    let next = 7151
    return jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      const from = next
      const to = Math.max(oldestOverall, from - numMessagesOnScrollback + 1)
      next = to - 1
      await Promise.resolve()
      p.onFullThread?.(
        JSON.stringify({messages: tombstones(from, to), pagination: {last: to <= oldestOverall, num: 100}})
      )
      return undefined as never
    })
  }

  const seededContext = () => {
    const {result} = renderHook(
      () => ({actions: useConversationThreadActions(), store: useConversationThreadStore()}),
      {
        wrapper: ({children}: {children: React.ReactNode}) => (
          <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
        ),
      }
    )
    const {actions} = result.current
    act(() => {
      actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(7152), textAt(7153)],
        moreToLoad: true,
        scrollDirection: 'back',
      })
    })
    return contextFor(result.current.store, result.current.actions)
  }

  const loadBack = (context: LoadContext) =>
    drive(context, {
      allowMarkAsRead: true,
      numberOfMessagesToLoad: numMessagesOnScrollback,
      reason: 'scroll back',
      retryCount: 0,
      scrollDirection: 'back',
    })

  test('keeps paging through a run of tombstones until the pager says it is done', async () => {
    // 7151 down to 6952 is two pages of 100, so one reload after the first call.
    const rpc = mockWalkingBack(6952)
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('walks a run of tombstones that ends before the cap', async () => {
    const oldest = 6752
    const rpc = mockWalkingBack(oldest)
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(Math.ceil((7151 - oldest + 1) / numMessagesOnScrollback))
  })

  test('stops at the reload cap rather than walking an expunged history', async () => {
    // A channel whose history was largely expunged has far more tombstones than the chain should
    // walk off one gesture. It stops at the cap and hands the thread back; scrolling away and back
    // fires onStartReached again and starts a fresh chain from where this one stopped.
    const rpc = mockWalkingBack(1)
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(maxBackPageReloads + 1)
  })

  test('stops if a page fails to reach further back', async () => {
    // A service that keeps handing back the same window must not spin us forever. Progress in
    // message ID is the only thing permitting another attempt.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onFullThread?.(
        JSON.stringify({messages: tombstones(7151, 7052), pagination: {last: false, num: 100}})
      )
      return undefined as never
    })
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('does not reload when the page actually added ordinals', async () => {
    // Renderable messages, so the store grows and the list will ask for the next page itself.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onFullThread?.(JSON.stringify({messages: visible(7151, 7052), pagination: {last: false, num: 100}}))
      return undefined as never
    })
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('reloads when a warm cache delivers the tombstones', async () => {
    // The reported bug's own shape: the conversation is already in local storage, so PullLocalOnly
    // wins and the cached pass carries the page - which is entirely tombstones. Judging only the
    // full pass, or refusing to judge at all once a cached pass arrived, leaves this inert.
    let next = 7151
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      const from = next
      const to = Math.max(6952, from - numMessagesOnScrollback + 1)
      next = to - 1
      await Promise.resolve()
      p.onCachedThread?.(
        JSON.stringify({messages: tombstones(from, to), pagination: {last: to <= 6952, num: 100}})
      )
      // The full pass is INCREMENTAL once a cached thread has been sent.
      p.onFullThread?.(
        JSON.stringify({messages: tombstones(to, to), pagination: {last: to <= 6952, num: 100}})
      )
      return undefined as never
    })
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('does not reload after a cached pass already delivered the page', async () => {
    // The normal warm-cache sequence: PullLocalOnly wins, the cached pass carries the whole page,
    // and the full pass that follows is INCREMENTAL - only the messages that changed, every one of
    // them already in the window. On ordinal count alone that is indistinguishable from a page of
    // tombstones, and reloading on it walks the client back through the entire conversation.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onCachedThread?.(JSON.stringify({messages: visible(7151, 7052), pagination: {last: false, num: 100}}))
      p.onFullThread?.(JSON.stringify({messages: visible(7052, 7052), pagination: {last: false, num: 100}}))
      return undefined as never
    })
    loadBack(seededContext())
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('stops when the window is cleared under it', async () => {
    // jump to recent and a centered jump both clear then reload. A chain still walking backwards
    // would prepend pages into a window the reader has just left, producing the disjoint ordinals
    // this whole branch exists to prevent.
    let calls = 0
    const {result} = renderHook(
      () => ({actions: useConversationThreadActions(), store: useConversationThreadStore()}),
      {
        wrapper: ({children}: {children: React.ReactNode}) => (
          <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
        ),
      }
    )
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(7152)],
        moreToLoad: true,
        scrollDirection: 'back',
      })
    })
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      calls++
      await Promise.resolve()
      // Someone hits jump-to-recent while the first page is in flight.
      if (calls === 1) {
        act(() => {
          result.current.actions.messagesClear()
        })
      }
      p.onFullThread?.(
        JSON.stringify({messages: tombstones(7151, 7052), pagination: {last: false, num: 100}})
      )
      return undefined as never
    })
    loadBack(contextFor(result.current.store, result.current.actions))
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('does not reload an initial load', async () => {
    const rpc = mockWalkingBack(6152)
    drive(seededContext(), {
      allowMarkAsRead: true,
      numberOfMessagesToLoad: 100,
      reason: 'focused',
      retryCount: 0,
      scrollDirection: 'none',
    })
    await act(async () => {
      await flushPromises()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('only a pass that can account for a whole window reconciles', () => {
  const page = (from: number, to: number) =>
    Array.from({length: from - to + 1}, (_, i) => ({
      placeholder: {hidden: false, messageID: T.Chat.numberToMessageID(from - i)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    }))

  const mockPasses = (cached: string, full: string) =>
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onCachedThread?.(cached)
      p.onFullThread?.(full)
      return undefined as never
    })

  // Whether the last pass of a load was the one that reconciles. What gets pruned is the store's
  // business - addMessagesToThreadState fills the carried set itself - so these tests only check
  // which passes are allowed to ask for it; the thread-context suite covers the pruning.
  const renderRecording = () => {
    const {result} = renderHook(
      () => ({actions: useConversationThreadActions(), store: useConversationThreadStore()}),
      {
        wrapper: ({children}: {children: React.ReactNode}) => (
          <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
        ),
      }
    )
    const applyThreadLoad = jest.spyOn(result.current.actions, 'applyThreadLoad')
    const load = () =>
      runThreadWindowLoad({
        actions: result.current.actions,
        conversationIDKey: convID,
        gate: {nextLoadID: 0, refillOwner: undefined},
        load: {
          allowMarkAsRead: true,
          numberOfMessagesToLoad: 100,
          reason: 'focused',
          retryCount: 0,
          scrollDirection: 'none',
        },
        isMounted: () => true,
        onThreadLoadStatus: () => {},
        reload: () => {},
        store: result.current.store,
      })
    const prunedOnLastPass = () =>
      applyThreadLoad.mock.calls.at(-1)?.[0].reconcile?.prune
    return {applyThreadLoad, load, prunedOnLastPass}
  }

  test('reconciles on a full pass that followed an empty cached one', async () => {
    // First open after a db nuke: PullLocalOnly finds nothing, but its collector suppresses the
    // miss and a cached pass is sent anyway, carrying no messages. INCREMENTAL against an empty
    // local thread filters nothing out, so the full pass really is the whole window - and only a
    // whole window may prune the stale ordinals a cache repair left behind.
    mockPasses(
      JSON.stringify({messages: null, pagination: {last: false, num: 100}}),
      JSON.stringify({messages: page(7153, 7152), pagination: {last: false, num: 100}})
    )
    const {load, prunedOnLastPass} = renderRecording()
    load()
    await act(async () => {
      await flushPromises()
    })

    expect(prunedOnLastPass()).toBe(true)
  })

  test('does not reconcile when the service never reported a cached pass', async () => {
    // The service records the cached thread as sent before it marshals it, so a failure there
    // leaves the full pass INCREMENTAL against a pass we were never shown. The cached callback
    // firing - with a thread, or with the nil a cold cache sends - is the only sign we get that
    // this did not happen.
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onFullThread?.(JSON.stringify({messages: page(7153, 7150), pagination: {last: false, num: 100}}))
      return undefined as never
    })
    const {load, prunedOnLastPass} = renderRecording()
    load()
    await act(async () => {
      await flushPromises()
    })

    expect(prunedOnLastPass()).toBe(false)
  })

  test('reconciles on the full pass of a warm-cache load, against both passes', async () => {
    // The warm-cache sequence: the cached pass carries the page and the full pass behind it is
    // INCREMENTAL, only what changed. Neither is a window on its own - but INCREMENTAL walks the
    // authoritative window and omits only what the cached pass already carried unchanged, so the
    // two together are that window, and the range spans both. Judging the full pass alone would
    // give up pruning on every conversation the cache is warm for, which is all of them after the
    // first open.
    mockPasses(
      JSON.stringify({messages: page(7153, 7052), pagination: {last: false, num: 100}}),
      JSON.stringify({messages: page(7153, 7153), pagination: {last: false, num: 100}})
    )
    const {load, prunedOnLastPass} = renderRecording()
    load()
    await act(async () => {
      await flushPromises()
    })

    expect(prunedOnLastPass()).toBe(true)
  })

  test('does not reconcile when a cached pass arrived but another load owned the window', async () => {
    // The gate-owner guard is the one guard that can turn a cached pass away and still let the full
    // pass behind it through: the owner drops the gate in between. The service counts that cached
    // pass as sent either way, so the full pass is INCREMENTAL - a handful of changed messages -
    // and a span built from those alone covers every row between them with nothing recorded as
    // present. That is not a stale-row cleanup, it is deleting the thread.
    const {result} = renderHook(
      () => ({actions: useConversationThreadActions(), store: useConversationThreadStore()}),
      {
        wrapper: ({children}: {children: React.ReactNode}) => (
          <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
        ),
      }
    )
    act(() => {
      result.current.actions.messagesClear()
    })
    const applyThreadLoad = jest.spyOn(result.current.actions, 'applyThreadLoad')
    // Another load got to the cleared window first and still holds it.
    const gate: {nextLoadID: number; refillOwner: number | undefined} = {nextLoadID: 1, refillOwner: 0}
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onCachedThread?.(JSON.stringify({messages: page(7153, 7052), pagination: {last: false, num: 100}}))
      // The load that owned the gate settles here, so the full pass is no longer refused.
      gate.refillOwner = undefined
      p.onFullThread?.(JSON.stringify({messages: page(7153, 7150), pagination: {last: false, num: 100}}))
      return undefined as never
    })
    runThreadWindowLoad({
      actions: result.current.actions,
      conversationIDKey: convID,
      gate,
      load: {
        allowMarkAsRead: true,
        numberOfMessagesToLoad: 100,
        reason: 'focused',
        retryCount: 0,
        scrollDirection: 'none',
      },
      isMounted: () => true,
      onThreadLoadStatus: () => {},
      reload: () => {},
      store: result.current.store,
    })
    await act(async () => {
      await flushPromises()
    })

    expect(applyThreadLoad).not.toHaveBeenCalled()
  })
})

// End to end: a load reconciles the window it refills. Which passes may ask to reconcile is
// covered above; these are about what the store then does with the answer.
describe('a load reconciles the window it refills', () => {
  test('a warm-cache load prunes against both passes, not either one alone', async () => {
    // Regression: once the service has sent a cached thread it switches the full response to
    // INCREMENTAL, so the full pass only carries what changed. Treating either pass on its own as
    // authoritative deleted real messages that were still in the thread. The two together are the
    // window - INCREMENTAL walks it and omits only what the cached pass already carried - so the
    // range spans both, and everything inside it that either pass carried survives.
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
    const ids = [301, 302, 303, 304].map(T.Chat.numberToMessageID)
    // The cache holds the older three; only 304 changed, so that is all the full pass carries. The
    // span is what makes this the dangerous shape: a range of [301..304] computed from the full pass
    // alone covers 302 and 303, which are absent from it and would be pruned.
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({thread: threadJSON(ids.slice(0, 3))})
      await Promise.resolve()
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: threadJSON([ids[3]!])})
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    // Seed a settled four-message window the way a whole-window full pass would.
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: ids.map(id =>
          Message.makeMessageText({
            author: 'alice',
            conversationIDKey: convID,
            id,
            ordinal: T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(id)),
            outboxID: undefined,
            text: new HiddenString(`m${id}`),
            timestamp: 100,
          })
        ),
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(result.current.window.ordinals).toEqual([301, 302, 303, 304])

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'test'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.window.ordinals).toEqual([301, 302, 303, 304])
  })

  test('a warm-cache load does not prune a message sitting on its outbox ordinal', async () => {
    // A message you sent keeps the fractional ordinal it had in the outbox, so the ordinal it parses
    // with - its server one - is not the ordinal it occupies. The prune walks the window, so what
    // the passes delivered has to be recorded in the window's terms too; recording the parsed
    // ordinal deletes the row it was meant to protect.
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
    const outboxID = T.Chat.stringToOutboxID('sent-1')
    const sentOrdinal = T.Chat.numberToOrdinal(302.001)

    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({
        thread: JSON.stringify({
          messages: [
            makeValidTextUIMessage(T.Chat.numberToMessageID(301), 'm301'),
            makeValidTextUIMessage(T.Chat.numberToMessageID(302), 'm302'),
            makeValidTextUIMessage(T.Chat.numberToMessageID(303), 'mine', 'sent-1'),
          ],
          pagination: {last: true, next: '', num: 100, previous: ''},
        }),
      })
      await Promise.resolve()
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: JSON.stringify({
          messages: [makeValidTextUIMessage(T.Chat.numberToMessageID(301), 'm301 edited')],
          pagination: {last: true, next: '', num: 100, previous: ''},
        }),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    // The window as it stands after the send settled: the message is at its outbox ordinal, indexed
    // under the server ID the service will send it back as.
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [
          Message.makeMessageText({
            author: 'alice',
            conversationIDKey: convID,
            id: T.Chat.numberToMessageID(301),
            ordinal: T.Chat.numberToOrdinal(301),
            outboxID: undefined,
            text: new HiddenString('m301'),
            timestamp: 100,
          }),
          Message.makeMessageText({
            author: 'alice',
            conversationIDKey: convID,
            id: T.Chat.numberToMessageID(302),
            ordinal: T.Chat.numberToOrdinal(302),
            outboxID: undefined,
            text: new HiddenString('m302'),
            timestamp: 100,
          }),
          Message.makeMessageText({
            author: 'testuser',
            conversationIDKey: convID,
            id: T.Chat.numberToMessageID(303),
            ordinal: sentOrdinal,
            outboxID,
            text: new HiddenString('mine'),
            timestamp: 100,
          }),
        ],
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(result.current.window.ordinals).toEqual([301, 302, sentOrdinal])

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'test'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.window.ordinals).toEqual([301, 302, sentOrdinal])
  })

  test('a full pass that changed nothing still reconciles the window', async () => {
    // The ordinary warm reload: the cached pass is the window and the INCREMENTAL full pass behind it
    // carries nothing at all, because nothing changed. That is still an authoritative answer about
    // the span, so a row the service no longer has is still a ghost - skipping the prune for want of
    // messages to add leaves it on screen until the conversation is reopened.
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
    const ids = [301, 302, 303].map(T.Chat.numberToMessageID)

    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({
        thread: JSON.stringify({
          messages: [ids[0]!, ids[2]!].map(id => makeValidTextUIMessage(id, `m${id}`)),
          pagination: {last: true, next: '', num: 100, previous: ''},
        }),
      })
      await Promise.resolve()
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
        thread: JSON.stringify({messages: null, pagination: {last: true, next: '', num: 100, previous: ''}}),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: ids.map(id =>
          Message.makeMessageText({
            author: 'alice',
            conversationIDKey: convID,
            id,
            ordinal: T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(id)),
            outboxID: undefined,
            text: new HiddenString(`m${id}`),
            timestamp: 100,
          })
        ),
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(result.current.window.ordinals).toEqual([301, 302, 303])

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'test'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.window.ordinals).toEqual([301, 303])
  })

  test('a warm-cache load still prunes a row neither pass carries', async () => {
    // The other half of the same rule: a row inside the range that neither pass returned is a ghost -
    // a cache repair left it behind, or it was deleted while we were away - and reconciling it away
    // is what the range is for. Gating on a full pass with no cached one before it would have given
    // this up for every conversation the cache is warm for.
    useConfigState.setState({loggedIn: true})
    jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
    jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
    const ids = [301, 302, 303, 304].map(T.Chat.numberToMessageID)
    // 303 is in neither pass, and it sits inside the span the two of them cover.
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({thread: threadJSON([ids[0]!, ids[1]!])})
      await Promise.resolve()
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: threadJSON([ids[3]!])})
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderWindow()

    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: ids.map(id =>
          Message.makeMessageText({
            author: 'alice',
            conversationIDKey: convID,
            id,
            ordinal: T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(id)),
            outboxID: undefined,
            text: new HiddenString(`m${id}`),
            timestamp: 100,
          })
        ),
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(result.current.window.ordinals).toEqual([301, 302, 303, 304])

    act(() => {
      result.current.requestWindow({anchor: 'newest', reason: 'test'})
    })
    await act(async () => {
      await flushPromises()
    })

    expect(result.current.window.ordinals).toEqual([301, 302, 304])
  })
})
